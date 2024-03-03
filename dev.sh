if [ ! -f .ssh_cmd ]; then
  echo ".ssh_cmd is not set"
  echo "Please set .ssh_cmd to the ssh command to use"
  echo "Get this from Runpod (\"SSH over exposed TCP: (Supports SCP & SFTP)\")"
  echo "Example: echo 'ssh root@141.193.30.26 -p 43846 -i ~/.ssh/id_ed25519' > .ssh_cmd"
  exit 1
fi
SSH_CMD=$(cat .ssh_cmd)


function cleanup {
  echo ""
  echo ""
  echo ""
  echo "**********"
  echo "ComfyUI is still running in the background."
  echo "Run 'supervisorctl stop comfyui' to stop it."
  echo "Run 'supervisorctl start comfyui' to start it."
  echo "Run 'supervisorctl restart comfyui' to restart it."
  echo "**********"
}

trap cleanup EXIT

./list_backend_files.sh | entr -crs "./sync.sh && $SSH_CMD -t 'supervisorctl restart comfy && supervisorctl tail -f comfyui stderr & supervisorctl tail -f comfyui stdout'"
