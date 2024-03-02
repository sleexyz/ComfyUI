#This is an example that uses the websockets api to know when a prompt execution is done
#Once the prompt execution is done it downloads the images using the /history endpoint

import websocket #NOTE: websocket-client (https://github.com/websocket-client/websocket-client)
import uuid
import json
import urllib.request
import urllib.parse
import os, glob
from PIL import Image
import io

json_file_path = "/workspace/ComfyUI/custom_workflows/actual_best/actual_best_api_preview.json"
first_batch = True

server_address = "127.0.0.1:8188"

client_id = str(uuid.uuid4())

def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req =  urllib.request.Request("http://{}/prompt".format(server_address), data=data)
    return json.loads(urllib.request.urlopen(req).read())

def get_image(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
        return response.read()

def get_history(prompt_id):
    with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
        return json.loads(response.read())

def get_images(ws, prompt):
    prompt_id = queue_prompt(prompt)['prompt_id']
    output_images = {}
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                if data['node'] is None and data['prompt_id'] == prompt_id:
                    break #Execution is done
        else:
            continue #previews are binary data

    history = get_history(prompt_id)[prompt_id]
    for o in history['outputs']:
        for node_id in history['outputs']:
            node_output = history['outputs'][node_id]
            if 'images' in node_output:
                images_output = []
                for image in node_output['images']:
                    image_data = get_image(image['filename'], image['subfolder'], image['type'])
                    images_output.append(image_data)
            output_images[node_id] = images_output

    return output_images


def update_prompt(prompt:dict, first_batch:bool, input_prompt):
    #set the text prompt for our positive CLIPTextEncode
    prompt["3"]["inputs"]["text"] = input_prompt
    
    if first_batch:
        prompt["65"]["inputs"]["latent"] = "latents/empty_latent_64.latent.png [temp]"
    else:
        img_dir = max(glob.glob('/workspace/ComfyUI/temp/latents/LatentSender_*.latent.png'), key=lambda x: int(x.split('_')[1]))
        # prompt["65"]["inputs"]["latent"] = "latents/LatentSender_00001_.latent.png [temp]"
        prompt["65"]["inputs"]["latent"] = img_dir.replace("/workspace/ComfyUI/temp/","") + " [temp]"

    return prompt


def main(input_prompt="skiing on a snowy mountain"):
    try:
        with open(json_file_path, 'r') as file:
            prompt = json.load(file)
    except FileNotFoundError:
        print(f"The file {json_file_path} was not found.")
    except json.JSONDecodeError:
        print("An error occurred while decoding the JSON data.")
            
    
    ws = websocket.WebSocket()
    print("Finished setting up web socket!!")
    
    ws.connect("ws://{}/ws?clientId={}".format(server_address, client_id))

    first_batch = True
    while True:
        print("Generating", first_batch, end="")
        prompt = update_prompt(prompt, first_batch, input_prompt)
        first_batch = False
        images = get_images(ws, prompt)
        print("Images (dict) keys", images.keys())
        
        # if not os.path.exists("outputs-imgs"):
        #     os.makedirs("outputs-imgs")
        
        for node_id in images:
            for i, image_data in enumerate(images[node_id]):
                image = Image.open(io.BytesIO(image_data))
                image.show()
                # image.save(f"outputs-imgs/frame_{i}_{node_id}.jpeg")

if __name__ == "__main__":
    main()
