#!/bin/bash

if [[ -z $REMOTE_DIR ]]; then
    echo "REMOTE_DIR is not set"
    exit 1
fi

set -e

if [[ -z $SSH_CMD ]]; then
    echo "SSH_CMD is not set"
    exit 1
fi

tmp_file=$(mktemp)
sed 's/^/+ /' <($(dirname $0)/../pod_config/list_development_files.sh) > $tmp_file
echo "- *" >> $tmp_file

# cat $tmp_file


echo "**********************************"
echo "Syncing files to remote workspace"
echo "**********************************"

set -x

rsync -avz \
      --no-o --no-g \
      --no-perms --omit-dir-times \
      --include="**/" \
      --include-from=$tmp_file \
      -e "$SSH_CMD" \
      ./ ":$REMOTE_DIR"
