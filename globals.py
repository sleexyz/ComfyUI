import struct

import aiohttp

from typing import List, Union, Any, Optional
from PIL import Image, ImageOps
from io import BytesIO
from server import PromptServer

from pydantic import BaseModel as PydanticBaseModel

print_model = False
force_causal = False
debug_options: dict[str, Any] = {}

debug_options["print_motion_module"] = True


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
        if self.frames == 0:
            self.frames += 16 # we generated 16 frames
        else:
            self.frames += 1 # we generated 1 frames
        self.timestep = 0


sample_step = SampleStep()


class BaseModel(PydanticBaseModel):
    class Config:
        arbitrary_types_allowed = True


class StreamingPrompt(BaseModel):
    workflow_api: Any
    auth_token: str
    inputs: dict[str, Union[str, bytes, Image.Image]]
    running_prompt_ids: set[str] = set()
    status_endpoint: str
    file_upload_endpoint: str


streaming_prompt_metadata: dict[str, StreamingPrompt] = {}


class BinaryEventTypes:
    PREVIEW_IMAGE = 1
    UNENCODED_PREVIEW_IMAGE = 2


max_output_id_length = 24


async def send_image(image_data, sid=None, output_id: str = None):
    max_length = max_output_id_length
    output_id = output_id[:max_length]
    padded_output_id = output_id.ljust(max_length, "\x00")
    encoded_output_id = padded_output_id.encode("ascii", "replace")

    image_type = image_data[0]
    image = image_data[1]
    max_size = image_data[2]
    quality = image_data[3]
    if max_size is not None:
        if hasattr(Image, "Resampling"):
            resampling = Image.Resampling.BILINEAR
        else:
            resampling = Image.ANTIALIAS

        image = ImageOps.contain(image, (max_size, max_size), resampling)
    type_num = 1
    if image_type == "JPEG":
        type_num = 1
    elif image_type == "PNG":
        type_num = 2
    elif image_type == "WEBP":
        type_num = 3

    bytesIO = BytesIO()
    header = struct.pack(">I", type_num)
    # 4 bytes for the type
    bytesIO.write(header)
    # 10 bytes for the output_id
    position_before = bytesIO.tell()
    bytesIO.write(encoded_output_id)
    position_after = bytesIO.tell()
    bytes_written = position_after - position_before
    print(f"Bytes written: {bytes_written}")

    image.save(bytesIO, format=image_type, quality=quality, compress_level=1)
    preview_bytes = bytesIO.getvalue()
    await send_bytes(BinaryEventTypes.PREVIEW_IMAGE, preview_bytes, sid=sid)


async def send_socket_catch_exception(function, message):
    try:
        await function(message)
    except (
        aiohttp.ClientError,
        aiohttp.ClientPayloadError,
        ConnectionResetError,
    ) as err:
        print("send error:", err)


def encode_bytes(event, data):
    if not isinstance(event, int):
        raise RuntimeError(f"Binary event types must be integers, got {event}")

    packed = struct.pack(">I", event)
    message = bytearray(packed)
    message.extend(data)
    return message


async def send_bytes(event, data, sid=None):
    message = encode_bytes(event, data)

    print("sending image to ", event, sid)

    sockets = PromptServer.instance.sockets
    print(f"Sockets, {sockets.keys()}")
    # TODO: see why sids don't match up
    if sid is None:
        # if True:
        _sockets = list(sockets.values())
        for ws in _sockets:
            await send_socket_catch_exception(ws.send_bytes, message)
    elif sid in sockets:
        await send_socket_catch_exception(sockets[sid].send_bytes, message)
