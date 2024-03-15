if [[ -z $REMOTE_DIR ]]; then
    echo "REMOTE_DIR is not set"
    exit 1
fi
echo "REMOTE_DIR is set to $REMOTE_DIR"
supervisorctl -c $REMOTE_DIR/supervisord.conf restart comfyui
supervisorctl -c $REMOTE_DIR/supervisord.conf tail -f comfyui stderr &
supervisorctl -c $REMOTE_DIR/supervisord.conf tail -f comfyui stdout