from typing import List, Union, Any, Optional

class DebugOptions:
    def __init__(self):
        # TODO: make this a settings object
        # adjustable via websocket / comfy node

        ###########
        # Behavior
        ###########
        self.force_causal = True
        self.force_causal_use_manual_mask = False


        ###########
        # DEBUGGING
        ###########
        self.skip_vanilla_temporal_module = False
        self.save_motion_module = False
        # Prints motion module graph via torchview
        self.print_motion_module = False

        # Prints whole model via torchview
        self.print_model = False

        # BROKEN
        # Offsets position encoding frames by frame step count
        self.offset_positional_encoding = False

        ###########
        # State
        ###########
        self.frame = 0

    def set_from_dict(self, options: dict[str, Any]):
        for key in options:
            setattr(self, key, options[key])
        print(f"Set options: {self.__dict__}")

debug_options = DebugOptions()


class SampleStep:
    def __init__(self):
        self.timestep = 0 # diffusion timesteps

    def get_timestep(self):
        return self.timestep

    def increment(self):
        self.timestep += 1

    def reset(self):
        self.timestep = 0


sample_step = SampleStep()
