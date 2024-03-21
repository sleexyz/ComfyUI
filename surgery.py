from typing import List, Union, Any, Optional

class DebugOptions:
    def __init__(self):
        # TODO: make this a settings object
        # adjustable via websocket / comfy node
        self.force_causal = True
        self.extend_context = True
        self.first_frame_16 = True

        self.auto_step_batch_offset = False

        # Prints motion module graph via torchview
        self.print_motion_module = False

        # Prints whole model via torchview
        self.print_model = False

        # Offsets position encoding frames by frame step count
        self.offset_positional_encoding = False

    def set_from_dict(self, options: dict[str, Any]):
        for key in options:
            setattr(self, key, options[key])
        print(f"Set options: {self.__dict__}")

debug_options = DebugOptions()

class SampleStep:
    def __init__(self):
        self.timestep = 0 # diffusion timesteps
        self.frames = 0 # frames generated
        self.last_seed = None
        self.noise = None

    def get_timestep(self):
        return self.timestep

    def get_frame(self):
        return self.frames

    def is_first_run(self, seed: int):
        if self.last_seed != seed:
            self.last_seed = seed
            self.frames = 0
            self.timestep = 0
            return True
        return self.frames == 0

    def increment(self):
        self.timestep += 1

    def reset(self):
        print(f"Resetting timestep, frames: {self.frames}")
        self.timestep = 0

    def increment_frames(self):
        if self.frames == 0:
            self.frames += 16 # we generated 16 frames
            print(f"incrementing frames to: {self.frames}")
        else:
            self.frames += 1 # we generated 1 frames
            print(f"incrementing frames to: {self.frames}")


sample_step = SampleStep()
