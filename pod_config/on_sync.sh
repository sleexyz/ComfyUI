if [[ -z $REMOTE_ROOT ]]; then
    echo "REMOTE_ROOT is not set"
    exit 1
fi

supervisorctl -c $REMOTE_ROOT/supervisord.conf restart comfyui
supervisorctl -c $REMOTE_ROOT/supervisord.conf tail -f comfyui stderr &
supervisorctl -c $REMOTE_ROOT/supervisord.conf tail -f comfyui stdout