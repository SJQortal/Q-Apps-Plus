#!/bin/bash

# CONFIGURATION
REMOTE_USER=phil
REMOTE_HOST=devnet-nodes.qortal.link
QAPP_PORT=22393
CORE_API_PORT=22391
EDITOR_PORT=5174

# Start reverse tunnel in background
echo "Starting SSH tunnel to $REMOTE_HOST..."

ssh -p22221 -o ServerAliveInterval=30 \
  -L $QAPP_PORT:127.0.0.1:$QAPP_PORT \
  -L $CORE_API_PORT:127.0.0.1:$CORE_API_PORT \
  -R $EDITOR_PORT:127.0.0.1:$EDITOR_PORT \
  $REMOTE_USER@$REMOTE_HOST 
 


