
"server-only"

import {glob} from 'glob';
import basePrompt from "../../../custom_workflows/actual_best/actual_best_api_preview.json";
// const fs = require('fs');

// const client = new ComfyDeployClient({
//     apiBase: process.env.COMFY_API_URL,
//     apiToken: process.env.COMFY_API_TOKEN!,
// })

// export async function generate(prompt: string) {
//     return await client.run({
//         deployment_id: process.env.COMFY_DEPLOYMENT_ID!,
//         inputs: {
//             "input_text": prompt
//         }
//     })
// }

// export async function generate_img(input_image: string) {
//     return await client.run({
//         deployment_id: process.env.COMFY_DEPLOYMENT_ID_IMG_2_IMG!,
//         inputs: {
//             "input_image": input_image
//         }
//     })
// }

// export async function generate_img_with_controlnet(input_openpose_url: string, prompt: string) {
//     return await client.run({
//         deployment_id: process.env.COMFY_DEPLOYMENT_ID_CONTROLNET!,
//         inputs: {
//             "positive_prompt": prompt,
//             "openpose": input_openpose_url
//         }
//     })
// }

// export async function checkStatus(run_id: string) {
//     return await client.getRun(run_id)
// }

// export async function getUploadUrl(type: string, file_size: number) {
//     try {
//         return await client.getUploadUrl(type, file_size)
//     } catch (error) {
//         console.log(error)
//     }
// }

function clone(prompt: any) {
    return JSON.parse(JSON.stringify(prompt));
}

// export async function updatePrompt(firstBatch: boolean, inputPrompt: string) {
export async function updatePrompt(inputPrompt: string) {
    const prompt = clone(basePrompt);
    // Set the text prompt for our positive CLIPTextEncode
    prompt["3"]["inputs"]["text"] = inputPrompt;

    // if (firstBatch) {
    prompt["65"]["inputs"]["latent"] = "latents/empty_latent_64.latent.png [temp]";
    // } else {
    //     try {
    //         const files = await glob('/workspace/ComfyUI/temp/latents/LatentSender_*.latent.png');
    //         const imgDir = files.reduce((a, b) => {
    //             return parseInt(a.split('_')[1]) > parseInt(b.split('_')[1]) ? a : b;
    //         });
    //         prompt["65"]["inputs"]["latent"] = imgDir.replace("/workspace/ComfyUI/temp/", "") + " [temp]";
    //     } catch (err) {
    //         console.error("Error finding latent images:", err);
    //     }
    // }

    return prompt;
}