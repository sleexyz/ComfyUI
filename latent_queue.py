from PIL import Image
import numpy as np
import asyncio
import comfy.utils
import comfy.sd
from globals import send_image
from server import PromptServer
from threading import Thread

def run_loop(loop):
    asyncio.set_event_loop(loop)
    loop.run_forever()

class LatentQueue():
    def __init__(self):
        self.loop = asyncio.new_event_loop()
        Thread(target=lambda: run_loop(self.loop)).start()


        self.queue = []
        self.staged = None
        sd = comfy.utils.load_torch_file("models/vae/vae-ft-mse-840000-ema-pruned.safetensors")
        self.vae = comfy.sd.VAE(sd=sd)

    def stage(self, item):
        self.staged = item

    def put_staged(self):
        self.queue.append(self.staged)
        print(f"put_staged: {self.staged.shape}")
        self.staged = None

    def get(self):
        return self.queue.pop(0)

    def empty(self):
        return len(self.queue) == 0

    def get_and_send(self, client_id=None):
        latent = self.get()
        self.encode_and_send(latent, client_id)

    def encode_and_send(self, latent, client_id):
        image = self.vae.decode(latent)
        self.send_images(image, client_id)

    def send_images(self, images, client_id, output_id="output_id", file_type="WEBP", quality=80):
        def schedule_coroutine_blocking(target, *args):
            future = asyncio.run_coroutine_threadsafe(target(*args), self.loop)
            return future.result()  # This makes the call blocking
        
        for tensor in images:
            array = 255.0 * tensor.cpu().numpy()
            image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))
            print(f"client_id: {client_id}")

            schedule_coroutine_blocking(send_image, [file_type, image, None, quality], client_id, output_id)
            print("Image sent")

LatentQueue.instance = LatentQueue()