#!/bin/sh

pod push ../AnimateDiff-MotionDirector/outputs/2024-03-13/biking_my_video-08-51-52/lora/temporal/500_biking_temporal_unet.safetensors models/animatediff_motion_lora

pod push ../AnimateDiff-MotionDirector/outputs/2024-03-13/biking_my_video-08-51-52/lora/spatial/500_biking_spatial_unet.safetensors models/loras

