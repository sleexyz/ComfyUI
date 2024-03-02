if [ ! -f .ssh_cmd ]; then
  echo ".ssh_cmd is not set"
  echo "Please set .ssh_cmd to the ssh command to use"
  echo "Get this from Runpod (\"SSH over exposed TCP: (Supports SCP & SFTP)\")"
  echo "Example: echo 'ssh root@141.193.30.26 -p 43846 -i ~/.ssh/id_ed25519' > .ssh_cmd"
  exit 1
fi
SSH_CMD=$(cat .ssh_cmd)

./list_files.sh | entr -crs "./sync.sh && $SSH_CMD -t '(pkill python; cd /workspace/ComfyUI; python main.py --enable-cors-header http://localhost:3000)'"
