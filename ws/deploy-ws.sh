#!/bin/bash
REMOTE_USER=$REMOTE_USER
REMOTE_HOST=$REMOTE_HOST
REMOTE_DIR="/home/ec2-user/kick-tts"
BINARY_NAME="main.py"
REQUIREMENTS_NAME="requirements.txt"
SERVICE_NAME="kick-tts"
SSH_KEY=$SSH_KEY

# Ensure binary exists
if [ ! -f "$BINARY_NAME" ]; then
    echo "Binary $BINARY_NAME not found!"
    exit 1
fi

echo "Copying files to remote server..."

if [ -n "$SSH_KEY" ]; then
  echo "Using SSH key for file transfer..."
  SCP_OPTIONS="-o StrictHostKeyChecking=no -i $SSH_KEY"
else
  echo "Using ssh-agent for file transfer..."
  SCP_OPTIONS="-o StrictHostKeyChecking=no"
fi

scp $SCP_OPTIONS $BINARY_NAME $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/$BINARY_NAME.new
scp $SCP_OPTIONS $REQUIREMENTS_NAME $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

# SSH into remote server and perform deployment
echo "Deploying on remote server..."
ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST << EOF
    set -e # Exit on any error
    cd $REMOTE_DIR
    python -m pip install -r $REQUIREMENTS_NAME
    
    # Stop the existing service
    sudo systemctl stop $SERVICE_NAME || true # Don't fail if service doesn't exist
    
    # Replace the binary
    if [ -f "$BINARY_NAME" ]; then
        sudo mv $BINARY_NAME ${BINARY_NAME}.backup
    fi
    sudo mv $BINARY_NAME.new $BINARY_NAME
    sudo chmod +x $BINARY_NAME
    
    # Create systemd service file if it doesn't exist
    sudo tee /etc/systemd/system/$SERVICE_NAME.service << 'SERVICEEOF'
[Unit]
Description=WebSocket PubSub Server
After=network.target

[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/kick-tts
EnvironmentFile=/home/ec2-user/kick-tts/.env
ExecStart=/usr/bin/python3 main.py
Restart=always

[Install]
WantedBy=multi-user.target
SERVICEEOF

    # Reload systemd to pick up new service file
    sudo systemctl daemon-reload
    
    # Enable and start the service
    sudo systemctl enable $SERVICE_NAME
    sudo systemctl start $SERVICE_NAME
    
    # Check service status
    # --no-pager prevents systemctl from piping output through a pager like 'less'
    # This ensures the status output is directly printed to the console
    sudo systemctl status $SERVICE_NAME --no-pager
EOF

echo "Deployment completed successfully!"
