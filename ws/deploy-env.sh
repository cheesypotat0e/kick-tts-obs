#!/bin/bash

REMOTE_USER=$REMOTE_USER
REMOTE_HOST=$REMOTE_HOST
REMOTE_DIR=$REMOTE_DIR
SSH_KEY=$SSH_KEY

if [ -f ".env" ]; then
  set -o allexport
  source .env
  set +o allexport
else
  echo "No .env file found"
  exit 1
fi

SCP_OPTIONS="-o StrictHostKeyChecking=no -i $SSH_KEY"

scp $SCP_OPTIONS .env $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "Deployed .env to $REMOTE_DIR"
