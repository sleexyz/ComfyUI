from globals import max_output_id_length
from latent_queue import LatentQueue

class ComfyDeployWebscoketImageOutput:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "output_id": (
                    "STRING",
                    {"multiline": False, "default": "output_id"},
                ),
                "images": ("IMAGE", ),
                "file_type": (["WEBP", "PNG", "JPEG"], ),
                "quality": ("INT", {"default": 80, "min": 1, "max": 100, "step": 1}),
            },
            "optional": {
                    "client_id": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            }
            # "hidden": {"client_id": "CLIENT_ID"},
        }

    OUTPUT_NODE = True

    RETURN_TYPES = ()
    RETURN_NAMES = ("text",)

    FUNCTION = "run"

    CATEGORY = "output"
    
    @classmethod
    def VALIDATE_INPUTS(s, output_id):
        try:
            if len(output_id.encode('ascii')) > max_output_id_length:
                raise ValueError(f"output_id size is greater than {max_output_id_length} bytes")
        except UnicodeEncodeError:
            raise ValueError("output_id is not ASCII encodable")

        return True

    def run(self, output_id, images, file_type, quality, client_id):
        LatentQueue.instance.send_images(images, client_id, output_id, file_type, quality)
        return {"ui": {}}
        


NODE_CLASS_MAPPINGS = {"ComfyDeployWebscoketImageOutput": ComfyDeployWebscoketImageOutput}
NODE_DISPLAY_NAME_MAPPINGS = {"ComfyDeployWebscoketImageOutput": "Image Websocket Output (ComfyDeploy)"}