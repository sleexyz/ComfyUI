#!/bin/bash

# This script runs after project provisioning script.

set -e

if [ -n "$SSH_CLIENT" ] || [ -n "$SSH_TTY" ]; then
  SESSION_TYPE=remote/ssh
else
  case $(ps -o comm= -p "$PPID") in
    sshd|*/sshd) SESSION_TYPE=remote/ssh;;
  esac
fi

if [ "$SESSION_TYPE" = "remote/ssh" ]; then
  echo "Running in a remote SSH session"
else
  echo "Running in a local terminal"
  echo "ERROR: This script is meant to be run on the runpod"
  exit 1
fi

if [[ -z $REMOTE_ROOT ]]; then
    echo "REMOTE_ROOT is not set"
    exit 1
fi

mkdir -p $REMOTE_ROOT/logs

USER=$(whoami)

cat <<EOF > $REMOTE_ROOT/supervisord.conf
[supervisord]
user=$USER
logfile=$REMOTE_ROOT/logs/supervisord.log

[unix_http_server]
file=$REMOTE_ROOT/supervisord.sock

[supervisorctl]
serverurl=unix://$REMOTE_ROOT/supervisord.sock

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface
EOF


# Concat all files supervisord-*.fragment.conf into supervisord.conf
for f in $REMOTE_ROOT/supervisord-*.fragment.conf; do
  cat $f >> $REMOTE_ROOT/supervisord.conf
done


# start supervisord if not already running
# silent check if supervisord is running
FOUND=$(ps aux | grep supervisord | grep -v grep | wc -l)
if [ $FOUND -eq 0 ]; then
  echo "Starting supervisord"
  supervisord -c $REMOTE_ROOT/supervisord.conf
fi
supervisorctl -c $REMOTE_ROOT/supervisord.conf update
supervisorctl -c $REMOTE_ROOT/supervisord.conf start all

echo "*********************"
echo "Services started"
echo "*********************"

supervisorctl -c $REMOTE_ROOT/supervisord.conf status