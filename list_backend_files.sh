#!/bin/sh
git ls-files -- ':!:frontend'
git ls-files --others --exclude-standard -- ':!:frontend'


# TODO: do same for this repo
find custom_nodes/ComfyUI-AnimateDiff-Evolved | grep '\.py$'
