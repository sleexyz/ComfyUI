#!/bin/sh

git ls-files -- ':!:frontend' ':!:*.ipynb'
git ls-files --others --exclude-standard -- ':!:frontend' ':!:*.ipynb'

# TODO: do same for this repo
find custom_nodes/ComfyUI-AnimateDiff-Evolved | grep '\.py$'
