#!/bin/sh
git ls-files
git ls-files --others --exclude-standard

# TODO: do same for this repo
find custom_nodes/ComfyUI-AnimateDiff-Evolved | grep '\.py$'
