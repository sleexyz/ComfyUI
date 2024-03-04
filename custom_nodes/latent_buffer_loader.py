from server import PromptServer
import torch
import comfy.model_management

class LatentBufferLoader():
    def __init__(self):
        self.device = comfy.model_management.intermediate_device()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
            },
        }

    FUNCTION = "doit"

    CATEGORY = "Custom"
    OUTPUT_NODE = True

    RETURN_TYPES = ("LATENT",)
    RETURN_NAMES = ("samples",)


    def doit(self, **kwargs):
        batch_size = 1
        height = 512
        width = 512
        samples = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)

        if not PromptServer.instance.latent_queue.empty():
            samples = PromptServer.instance.latent_queue.get()

        print(f"got samples: {samples.shape}")

        samples = {
            'samples': samples
        }

        return {
                # 'ui': {"images": [preview]},
                'result': (samples, )
                }

    @classmethod
    def IS_CHANGED(s):
        if not PromptServer.instance.latent_queue.empty():
            return True
        return False

    @classmethod
    def VALIDATE_INPUTS(s):
        return True


NODE_CLASS_MAPPINGS = {"LatentBufferLoader": LatentBufferLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"LatentBufferLoader": "Latent Buffer Loader"}