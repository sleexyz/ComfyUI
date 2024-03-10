#!/bin/bash

function get_ssh_command {
  >&2 echo "Getting SSH command from RunPod."
  SSH_CMD=$(./get_ssh_command.ts)
  if [ -z "$SSH_CMD" ]; then
    >&2 echo "No SSH command found. Exiting."
    exit 1
  fi
  echo $SSH_CMD > .ssh_cmd
  echo $SSH_CMD
}

SSH_CMD=$(cat .ssh_cmd)
if [ -z "$SSH_CMD" ]; then
  >&2 echo "No SSH command found. Grabbing from RunPod."
  SSH_CMD=$(get_ssh_command)
fi

# test ssh connection
$SSH_CMD -t "echo 'SSH connection successful'"
if [ $? -ne 0 ]; then
  >&2 echo "SSH connection failed. Grabbing from RunPod."
  SSH_CMD=$(get_ssh_command)
  $SSH_CMD -t "echo 'SSH connection successful'"
  if [ $? -ne 0 ]; then
    >&2 echo "SSH connection failed. Exiting."
    exit 1
  fi
fi

if [ ! -f .cloudflare_demo_key ]; then
  >&2 echo ".cloudflare_demo_key is not set"
  exit 1
fi

CLOUDFLARE_DEMO_KEY=$(cat .cloudflare_demo_key)
SDXL=${SDXL:-false}
if [ "$1" != "--no_provision" ]; then
  $SSH_CMD -t "CLOUDFLARE_DEMO_KEY=$CLOUDFLARE_DEMO_KEY SDXL=$SDXL bash -s" < provisioning/provision.sh
fi

function cleanup {
  >&2 echo ""
  >&2 echo ""
  >&2 echo ""
  >&2 echo "**********"
  >&2 echo "cloudflared is still running in the background."
  >&2 echo "Run 'supervisorctl stop cloudflared' to stop it."
  >&2 echo "Run 'supervisorctl start cloudflared' to start it."
  >&2 echo "Run 'supervisorctl restart cloudflared' to restart it."
  >&2 echo "**********"
}

$SSH_CMD -t "supervisorctl restart cloudflared & supervisorctl tail -f cloudflared stderr & supervisorctl tail -f cloudflared stdout"
# $SSH_CMD -t "(supervisorctl stop cloudflared; cloudflared tunnel run --url http://localhost:8188 --token $CLOUDFLARE_DEMO_KEY)"
