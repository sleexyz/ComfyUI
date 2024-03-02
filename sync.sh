#!/bin/bash

set -e

if [ ! -f .ssh_cmd ]; then
  echo ".ssh_cmd is not set"
  echo "Please set .ssh_cmd to the ssh command to use"
  echo "Get this from Runpod (\"SSH over exposed TCP: (Supports SCP & SFTP)\")"
  echo "Example: echo 'ssh root@141.193.30.26 -p 43846 -i ~/.ssh/id_ed25519' > .ssh_cmd"
  exit 1
fi
SSH_CMD=$(cat .ssh_cmd)

tmp_file=$(mktemp)
sed 's/^/+ /' <(./list_files.sh) > $tmp_file
echo "- *" >> $tmp_file

echo "**********************************"
echo "Syncing files to remote workspace"
echo "**********************************"

rsync -avz \
      --no-o --no-g \
      --no-perms --omit-dir-times \
      --include-from=$tmp_file \
      -e "$SSH_CMD" \
      ./ ":/workspace/ComfyUI"
