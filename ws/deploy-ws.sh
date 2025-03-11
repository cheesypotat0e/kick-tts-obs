#!/bin/bash

REMOTE_USER=$REMOTE_USER
REMOTE_HOST=$REMOTE_HOST
REMOTE_DIR="/home/$REMOTE_USER/kick-tts"
BINARY_NAME="main.py"
SERVICE_NAME="kick-tts"
SSH_KEY=$SSH_KEY

if [ -f ".env" ]; then
  set -o allexport
  source .env
  set +o allexport
fi

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

if ! ssh $SCP_OPTIONS $REMOTE_USER@$REMOTE_HOST << EOF
    set -e

    cd $REMOTE_DIR

    sudo systemctl stop $SERVICE_NAME || true

    if [ -f "$BINARY_NAME" ]; then
        sudo mv $BINARY_NAME ${BINARY_NAME}.backup
    fi
EOF
then
  echo "Error occurred during initial SSH command execution."
  exit 1
fi

scp $SCP_OPTIONS -r $BINARY_NAME requirements.txt $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

# SSH into remote server and perform deployment
echo "Deploying on remote server..."
if ! ssh $SCP_OPTIONS $REMOTE_USER@$REMOTE_HOST << EOF

    set -e

    cd $REMOTE_DIR

    python -m pip install -r requirements.txt

    sudo chmod +x $BINARY_NAME
    
    sudo tee /etc/systemd/system/$SERVICE_NAME.service << 'SERVICEEOF'
[Unit]
Description=WebSocket PubSub Server
After=network.target

[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE
Type=simple
User=$REMOTE_USER
WorkingDirectory=/home/$REMOTE_USER/kick-tts
EnvironmentFile=/home/$REMOTE_USER/kick-tts/.env
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
then
  echo "Error occurred during SSH command execution."
  exit 1
fi

echo "Deployment completed successfully!"
