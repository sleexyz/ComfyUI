#!/bin/bash

source $(dirname $0)/../pod_config/.pod.env

if [[ -z $SSH_CMD ]]; then
  echo "SSH_CMD is not set"
  exit 1
fi

if [[ -z $REMOTE_DIR ]]; then
  echo "REMOTE_DIR is not set"
  exit 1
fi

function cleanup {
  echo "Cleanup"
}

trap cleanup EXIT

"$(dirname $0)/../pod_config/list_development_files.sh" | entr -crs "$(dirname $0)/sync.sh && $SSH_CMD 'REMOTE_DIR="$REMOTE_DIR" bash -s' < \"$(dirname $0)/../pod_config/on_sync.sh\""
