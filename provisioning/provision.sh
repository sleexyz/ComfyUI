#!/bin/bash

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


# This file will be sourced in init.sh

printf "\n##############################################\n#                                            #\n#          Provisioning container            #\n#                                            #\n#         This will take some time           #\n#                                            #\n# Your container will be ready on completion #\n#                                            #\n##############################################\n\n"
function download() {
    wget -q --show-progress -e dotbytes="${3:-4M}" -O "$2" "$1"
}


### Load development dependencies
apt-get update
apt-get -y install ranger entr vim tmux rsync supervisor



# Install comfyui
git clone http://github.com/sleexyz/ComfyUI /workspace/ComfyUI
(cd /workspace/ComfyUI; pip install -r requirements.txt)

# install cloudflared
if [[ ! -e /usr/local/bin/cloudflared ]]; then
    (wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb;dpkg -i cloudflared-linux-amd64.deb)
fi


## Set paths
nodes_dir=/workspace/ComfyUI/custom_nodes
disabled_nodes_dir=/workspace/ComfyUI/custom_nodes
models_dir=/workspace/ComfyUI/models
animatediff_models_dir=/workspace/ComfyUI/models/animatediff_models
mkdir -p $animatediff_models_dir
checkpoints_dir=${models_dir}/checkpoints
vae_dir=${models_dir}/vae
controlnet_dir=${models_dir}/controlnet
loras_dir=${models_dir}/loras
upscale_dir=${models_dir}/upscale_models


### Load in comfyui fork

# function load_comfyui_fork() {
#   git remote add upstream https://github.com/comfyanonymous/ComfyUI
#   git remote set-url origin https://github.com/sleexyz/ComfyUI
#   git fetch
#   git reset --hard origin/master
# }

# (cd /opt/ComfyUI; load_comfyui_fork)


### Install custom nodes

# ComfyUI-Manager
this_node_dir=${nodes_dir}/ComfyUI-Manager
if [[ ! -d $this_node_dir ]]; then
    git clone https://github.com/ltdrdata/ComfyUI-Manager $this_node_dir
else
    (cd $this_node_dir && git pull)
fi

# # ComfyUI-AnimateDiff-Evolved
# this_node_dir=${nodes_dir}/ComfyUI-AnimateDiff-Evolved
# if [[ ! -d $this_node_dir ]]; then
#     git clone https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved $this_node_dir
# else
#     (cd $this_node_dir && git pull)
# fi

# comfyui-animatediff
# this_node_dir=${nodes_dir}/comfyui-animatediff
# if [[ ! -d $this_node_dir ]]; then
#     git clone https://github.com/sleexyz/comfyui-animatediff $this_node_dir
# else
#     (cd $this_node_dir && git pull)
# fi


# impact
this_node_dir=${nodes_dir}/ComfyUI-Impact-Pack
if [[ ! -d $this_node_dir ]]; then
    git clone https://github.com/ltdrdata/ComfyUI-Impact-Pack.git $this_node_dir
else
    (cd $this_node_dir && git pull)
fi

# ComfyUI-VideoHelperSuite
this_node_dir=${nodes_dir}/ComfyUI-VideoHelperSuite
if [[ ! -d $this_node_dir ]]; then
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite $this_node_dir
    pip install -r ${this_node_dir}/requirements.txt
else
    (cd $this_node_dir && git pull)
fi

this_node_dir=${nodes_dir}/ComfyUI-sampler-lcm-alternative
if [[ ! -d $this_node_dir ]]; then
    git clone https://github.com/jojkaart/ComfyUI-sampler-lcm-alternative $this_node_dir
else
    (cd $this_node_dir && git pull)
fi

### Download checkpoints

## Animated
# mm_sd_v15_v2
model_file=${animatediff_models_dir}/mm_sd_v15_v2.ckpt
model_url=https://huggingface.co/guoyww/animatediff/resolve/main/mm_sd_v15_v2.ckpt
if [[ ! -e ${model_file} ]]; then
    printf "mm_sd_v15_v2.ckpt...\n"
    download ${model_url} ${model_file}
fi

## Standard
# v1-5-pruned-emaonly
model_file=${checkpoints_dir}/v1-5-pruned-emaonly.ckpt
model_url=https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt

if [[ ! -e ${model_file} ]]; then
    printf "Downloading Stable Diffusion 1.5...\n"
    download ${model_url} ${model_file}
fi

# model_file=${checkpoints_dir}/cardosAnime_v20.safetensors	
# model_url="https://civitai.com/api/download/models/43825?type=Model&format=SafeTensor&size=pruned&fp=fp16"	
# if [[ ! -e ${model_file} ]]; then	
#     printf "Downloading cardosAnime_v20.safetensors...\n"	
#     download ${model_url} ${model_file}	
# fi	

# save https://huggingface.co/latent-consistency/lcm-lora-sdv1-5/resolve/main/pytorch_lora_weights.safetensors
# model_file=${loras_dir}/pytorch_lora_weights.safetensors
# model_url=https://huggingface.co/latent-consistency/lcm-lora-sdv1-5/resolve/main/pytorch_lora_weights.safetensors
# if [[ ! -e ${model_file} ]]; then
#     printf "Downloading pytorch_lora_weights.safetensors...\n"
#     download ${model_url} ${model_file}
# fi

# AnimateLCM_sd15_t2v.ckpt
model_file=${animatediff_models_dir}/AnimateLCM_sd15_t2v.ckpt
model_url=https://huggingface.co/wangfuyun/AnimateLCM/resolve/main/AnimateLCM_sd15_t2v.ckpt?download=true
if [[ ! -e ${model_file} ]]; then
    printf "Downloading AnimateLCM_sd15_t2v.ckpt...\n"
    download ${model_url} ${model_file}
fi

model_file=${loras_dir}/AnimateLCM_sd15_t2v_lora.safetensors
model_url=https://huggingface.co/wangfuyun/AnimateLCM/resolve/main/AnimateLCM_sd15_t2v_lora.safetensors
if [[ ! -e ${model_file} ]]; then
    printf "Downloading AnimateLCM_sd15_t2v_lora.safetensors...\n"
    download ${model_url} ${model_file}
fi

model_file=${checkpoints_dir}/dreamshaper_8.safetensors
model_url=https://huggingface.co/autismanon/modeldump/resolve/main/dreamshaper_8.safetensors
if [[ ! -e ${model_file} ]]; then
    printf "Downloading dreamshaper_8.safetensors...\n"
    download ${model_url} ${model_file}
fi

model_file=${vae_dir}/vae-ft-mse-840000-ema-pruned.safetensors
model_url=https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors
if [[ ! -e ${model_file} ]]; then
    printf "Downloading vae-ft-mse-840000-ema-pruned.safetensors...\n"
    download ${model_url} ${model_file}
fi

model_file=${animatediff_models_dir}/v3_sd15_mm.ckpt
model_url=https://huggingface.co/guoyww/animatediff/resolve/main/v3_sd15_adapter.ckpt
if [[ ! -e ${model_file} ]]; then
    printf "Downloading v3_sd15_mm.ckpt...\n"
    download ${model_url} ${model_file}
fi

model_file=${loras_dir}/v3_sd15_adapter.ckpt
model_url=https://huggingface.co/conrevo/AnimateDiff-A1111/resolve/main/lora/mm_sd15_v3_adapter.safetensors?download=true
if [[ ! -e ${model_file} ]]; then
    printf "Downloading v3_sd15_adapter.ckpt...\n"
    download ${model_url} ${model_file}
fi

# Error if $CLOUDFLARE_DEMO_KEY is not set
if [[ -z $CLOUDFLARE_DEMO_KEY ]]; then
    echo "CLOUDFLARE_DEMO_KEY is not set"
    exit 1
fi

cat << EOF > /etc/supervisor/conf.d/supervisord.conf
[program:comfyui]
command=/bin/bash -c "cd /workspace/ComfyUI && python main.py --enable-cors-header http://localhost:3000"
autostart=true
autorestart=true
stderr_logfile=/var/log/comfyui.err.log
stdout_logfile=/var/log/comfyui.out.log

[program:cloudflared]
command=/usr/local/bin/cloudflared tunnel run --url http://localhost:8188 --token $CLOUDFLARE_DEMO_KEY
autostart=true
autorestart=true
stderr_logfile=/var/log/cloudflared.err.log
stdout_logfile=/var/log/cloudflared.out.log
EOF

supervisord -c /etc/supervisor/supervisord.conf
supervisorctl update
supervisorctl start all

echo "*********************"
echo "Provisioning complete"
