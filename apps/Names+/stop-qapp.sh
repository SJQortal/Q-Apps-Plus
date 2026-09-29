#!/bin/bash

PID_FILE=".qapp-tunnel.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "Tunnel PID file not found."
  exit 1
fi

TUNNEL_PID=$(cat "$PID_FILE")

if ps -p $TUNNEL_PID > /dev/null; then
  echo "Stopping SSH tunnel with PID $TUNNEL_PID..."
  kill $TUNNEL_PID
  rm "$PID_FILE"
  echo "Tunnel stopped."
else
  echo "No active tunnel with PID $TUNNEL_PID. Removing stale PID file."
  rm "$PID_FILE"
fi
