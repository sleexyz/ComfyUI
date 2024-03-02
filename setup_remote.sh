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
  $SSH_CMD -t 'bash -s' < provisioning/provision.sh 
fi
$SSH_CMD -t "cloudflared tunnel run --url http://localhost:8188 --token $CLOUDFLARE_DEMO_KEY"
