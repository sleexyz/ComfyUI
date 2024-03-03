#!/bin/sh

if [ ! -f .ssh_cmd ]; then
  echo ".ssh_cmd is not set"
  echo "Please set .ssh_cmd to the ssh command to use"
  echo "Get this from Runpod (\"SSH over exposed TCP: (Supports SCP & SFTP)\")"
  echo "Example: echo 'ssh root@141.193.30.26 -p 43846 -i ~/.ssh/id_ed25519' > .ssh_cmd"
  exit 1
fi
SSH_CMD=$(cat .ssh_cmd)

if [ ! -f .cloudflare_demo_key ]; then
  echo ".cloudflare_demo_key is not set"
  exit 1
fi
CLOUDFLARE_DEMO_KEY=$(cat .cloudflare_demo_key)


if [ "$1" != "--no_provision" ]; then
  $SSH_CMD -t "CLOUDFLARE_DEMO_KEY=$CLOUDFLARE_DEMO_KEY bash -s" < provisioning/provision.sh 
fi

function cleanup {
  echo ""
  echo ""
  echo ""
  echo "**********"
  echo "cloudflared is still running in the background."
  echo "Run 'supervisorctl stop cloudflared' to stop it."
  echo "Run 'supervisorctl start cloudflared' to start it."
  echo "Run 'supervisorctl restart cloudflared' to restart it."
  echo "**********"
}

$SSH_CMD -t "supervisorctl restart cloudflared & supervisorctl tail -f cloudflared stderr & supervisorctl tail -f cloudflared stdout"
# $SSH_CMD -t "(supervisorctl stop cloudflared; cloudflared tunnel run --url http://localhost:8188 --token $CLOUDFLARE_DEMO_KEY)"