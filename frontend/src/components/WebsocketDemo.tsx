"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from "use-debounce";
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import actual_best_api_preview from "../../../custom_workflows/actual_best/actual_best_api_preview.json";
import sixteen_frames_copy_last from "../../../custom_workflows/sixteen_frames_copy_last/sixteen_frames_copy_last_api.json";
import { useLocalStorageState } from '@/lib/state';
import dynamic from 'next/dynamic';

// TODO: use ssr
const Toggle = dynamic(() => import('./ui/toggle').then((mod) => mod.Toggle), { ssr: false });

const CLIENT_ID = uuidv4();

export function WebsocketDemo() {
    const [infiniteLoop, setInfiniteLoop] = useLocalStorageState('infinite_loop', false);

    const [ws, setWs] = useState<WebSocket>()
    const [status, setStatus] = useState("not-connected")
    // log of the current status
    useEffect(() => {
        console.log("status", status)
    }, [status])
    const [promptInput, setPromptInput] = useLocalStorageState<string>("prompt_input", 'A anime cat');
    // const [debouncedPrompt] = useDebounce(promptInput, 1000);

    const [currentLog, setCurrentLog] = useState<string>();

    const [promptTrigger,setPromptTrigger] = useState({});
    const prePromptTrigger = useRef(promptTrigger)


    const [reconnectCounter, setReconnectCounter] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement>(null); // Reference to the canvas element

    const lastLatent = useRef<string>("empty_latent_16.latent.png");
    const sendInput = useCallback(() => {
        if (status == "reconnecting" || status == "connecting")
            return

        if (ws?.readyState == ws?.CLOSED) {
            setStatus('reconnecting')
            setReconnectCounter(x => x + 1)
            return
        }

        if (status != "ready")
            return

        const prompt = generatePrompt({ client_id: CLIENT_ID, inputPrompt: promptInput, lastLatent: lastLatent.current });

        queuePrompt(prompt).then((res) => {
            console.log("Prompt queued", res)
        });
    }, [ws, status, promptInput])

    const preStatus = useRef(status)

    useEffect(() => {
        if (preStatus.current != status && status == "ready")
            sendInput();
        preStatus.current = status
    }, [status, sendInput,  infiniteLoop]);

    useEffect(() => {
        if (prePromptTrigger.current != promptTrigger) {
            sendInput();
        }
        prePromptTrigger.current = promptTrigger;
    }, [promptTrigger, sendInput])

    useEffect(() => {
        setStatus("connecting");
        console.log("connecting to", process.env.NEXT_PUBLIC_COMFY_DEPLOYMENT_WS!);
        const websocket = new WebSocket(`${process.env.NEXT_PUBLIC_COMFY_DEPLOYMENT_WS!}/ws?clientId=${CLIENT_ID}`);
        websocket.binaryType = "arraybuffer";
        websocket.onopen = () => {
            setStatus("connected");
        };
        websocket.onmessage = (event) => {
            if (typeof event.data === "string") {
                const message = JSON.parse(event.data);
                console.log("Received message:", message);
                if (message?.type == "status" && message?.data?.sid) {
                    setStatus("ready");
                }
                if (message?.type == "execution_start") {
                    setCurrentLog(`generating...`)
                }
                if (message?.type == "progress") {
                    const numerator = message.data?.value || 0;
                    const denominator = message.data?.max || 1;
                    setCurrentLog(`generating... ${(numerator / denominator * 100).toFixed(0)}%`)
                }
                if (message?.type == "latent-send") {
                    lastLatent.current = message.data?.images[0].filename;
                    console.log("updated last latent", lastLatent.current)
                }

                if (message?.type == "executing" && message?.data?.node == null) {
                    setCurrentLog("done")
                    if (infiniteLoop) {
                        console.log("Looping, sending input again");
                        setPromptTrigger({});
                    }
                } else if (message?.type == "live_status") {
                    setCurrentLog(`running - ${message.data?.current_node} ${(message.data.progress * 100).toFixed(2)}%`)
                } else if (message?.type == "elapsed_time") {
                    setCurrentLog(`elapsed time: ${Math.ceil(message.data?.elapsed_time * 100) / 100}s`)
                }
            }
            if (event.data instanceof ArrayBuffer) {
                // console.log("Received binary message:");
                drawImage(event.data);
            }
        };
        websocket.onclose = () => setStatus("closed");
        websocket.onerror = () => setStatus("error");

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, []);

    const drawImage = useCallback((arrayBuffer: ArrayBuffer) => {
        const view = new DataView(arrayBuffer);
        const eventType = view.getUint32(0);
        const buffer = arrayBuffer.slice(4);
        switch (eventType) {
            case 1:
                const imageTypeSize = 4
                const outputIdSize = 24

                // Extract the bytes for the output_id
                let outputIdBytes = new Uint8Array(buffer, imageTypeSize, outputIdSize);
                // Convert the bytes to an ASCII string
                let outputId = new TextDecoder("ascii").decode(outputIdBytes);

                console.log("Extracted output_id:", outputId);

                const view2 = new DataView(arrayBuffer);
                const imageType = view2.getUint32(0)
                let imageMime
                switch (imageType) {
                    case 1:
                    default:
                        imageMime = "image/jpeg";
                        break;
                    case 2:
                        imageMime = "image/png"
                        break;
                    case 3:
                        imageMime = "image/webp"
                }
                const blob = new Blob([buffer.slice(4 + outputIdSize)], { type: imageMime });
                // const fileSize = blob.size;
                // console.log(`Received image size: ${(fileSize / 1024).toFixed(2)} KB`);

                // const blob = new Blob([arrayBuffer], { type: 'image/png' }); // Assuming the image is a JPEG
                const url = URL.createObjectURL(blob);

                const canvas = canvasRef.current;
                const ctx = canvas?.getContext('2d');

                if (ctx) {
                    console.log("drawing");

                    const img = new Image();
                    img.onload = () => {
                        if (canvas) {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        }
                        URL.revokeObjectURL(url); // Clean up
                    };
                    img.src = url;
                }
                // this.dispatchEvent(new CustomEvent("b_preview", { detail: imageBlob }));
                break;
            default:
                throw new Error(`Unknown binary websocket message of type ${eventType}`);
        }
    }, []);

    const pending = (status == "not-connected" || status == "connecting" || status == "reconnecting" || currentLog?.startsWith("running") || (!currentLog && status == "connected"))


    return (
        <div className='flex md:flex-col gap-2 px-2 flex-col-reverse'>
            <div className="flex justify-between">
                <div className='flex gap-2'>
                    <Badge variant={'outline'} className='w-fit'>Status: {status}</Badge>
                    {(currentLog || status == "connected" || status == "ready") && <Badge variant={'outline'} className='w-fit'>
                        {currentLog}
                        {status == "connected" && !currentLog && "stating comfy ui"}
                        {status == "ready" && !currentLog && " running"}
                    </Badge>}
                </div>
                <div>
                    <Toggle
                        pressed={infiniteLoop}
                        aria-pressed={infiniteLoop}
                        onPressedChange={(value) => setInfiniteLoop(value)}
                    >
                        <span>♾️</span>
                    </Toggle>
                </div>
            </div>

            <div className='relative w-full'>
                <canvas ref={canvasRef} className='rounded-lg ring-1 ring-black/10 w-full aspect-square' width={1024} height={1024}></canvas>
                {
                    <><Skeleton className={
                        cn("absolute top-0 left-0 w-full h-full aspect-square opacity-20 transition-opacity", pending ? "visible" : "invisible opacity-0")
                    } /></>
                }
            </div>


            <Input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        sendInput();
                    }
                }}
            />
        </div>
    )
}

async function queuePrompt(prompt: any): Promise<any> {
    const p = { prompt, client_id: CLIENT_ID };
    const response = await fetch(`${process.env.NEXT_PUBLIC_COMFY_DEPLOYMENT_HTTP!}/prompt`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(p),
    });
    return response.json();
}

function clone(prompt: any) {
    return JSON.parse(JSON.stringify(prompt));
}

type Prompt = Record<string, PromptNode>;
interface PromptNode {
    class_type: string;
    inputs: Record<string, any>;
    _meta?: Record<string, any>;
}

function getNodeWithClassType(prompt: Prompt, classType: string): string | undefined {
    for (const [key, value] of Object.entries(prompt)) {
        if (value.class_type === classType) {
            return key;
        }
    }
    return undefined;
}

function getNodeWithTitle(prompt: Prompt, title: string): string {
    for (const [key, value] of Object.entries(prompt)) {
        if (value._meta?.title === title) {
            return key;
        }
    }
    throw new Error(`No node with title ${title} found in the prompt`);
}

// export async function updatePrompt(firstBatch: boolean, inputPrompt: string) {
export function generatePrompt({ client_id, inputPrompt, lastLatent }: { client_id: string, inputPrompt: string, lastLatent: string }) {
    const prompt = clone(sixteen_frames_copy_last);

    // Set the text prompt for our positive CLIPTextEncode
    const clipTextEncodeNodeId = getNodeWithTitle(prompt, "CLIP Text Encode (Prompt)");
    if (!clipTextEncodeNodeId) {
        throw new Error("No CLIP Text Encode (Prompt) node found in the prompt");
    }
    prompt[clipTextEncodeNodeId]["inputs"]["text"] = inputPrompt;

    // if (firstBatch) {
    const latentRecieverNodeId = getNodeWithClassType(prompt, "LatentReceiver");
    if (!latentRecieverNodeId) {
        throw new Error("No LatentReceiver node found in the prompt");
    }
    prompt[latentRecieverNodeId]["inputs"]["latent"] = `latents/${lastLatent} [temp]`;

    const wsNodeId = getNodeWithClassType(prompt, "ComfyDeployWebscoketImageOutput");
    if (!wsNodeId) {
        throw new Error("No ComfyDeployWebscoketImageOutput node found in the prompt");
    }
    prompt[wsNodeId]["inputs"]["client_id"] = client_id;

    return prompt;
}