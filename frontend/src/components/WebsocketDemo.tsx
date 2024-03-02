"use client"

import { updatePrompt } from '@/server/generate'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useDebounce } from "use-debounce";
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const CLIENT_ID = uuidv4();

export function WebsocketDemo() {
    const [ws, setWs] = useState<WebSocket>()
    const [status, setStatus] = useState("not-connected")
    // log of the current status
    useEffect(() => {
        console.log("status", status)
    }, [status])
    const [promptInput, setPromptInput] = useState('A anime cat');
    const [debouncedPrompt] = useDebounce(promptInput, 200);

    const prompt = useSWR('prompt', () => updatePrompt(debouncedPrompt));

    const [currentLog, setCurrentLog] = useState<string>();

    const [reconnectCounter, setReconnectCounter] = useState(0)

    const canvasRef = useRef<HTMLCanvasElement>(null); // Reference to the canvas element

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

        if (!prompt.data)
            return

        queuePrompt(prompt.data).then((res) => {
            console.log("Prompt queued", res)
        });

        // ws?.send(JSON.stringify(
        //     {
        //         "event": "input",
        //         "inputs": {
        //             "input_text": debouncedPrompt
        //         }
        //     }
        // ))
    }, [ws, debouncedPrompt, status, prompt.data])

    const preStatus = useRef(status)

    useEffect(() => {
        if (preStatus.current != status && status == "ready")
            sendInput();
        preStatus.current = status
    }, [status, sendInput])

    useEffect(() => {
        sendInput();
    }, [debouncedPrompt])

    useEffect(() => {
        setStatus("connecting");
        console.log("connecting to", process.env.NEXT_PUBLIC_COMFY_DEPLOYMENT_WS!);
        const websocket = new WebSocket(`${process.env.NEXT_PUBLIC_COMFY_DEPLOYMENT_WS!}/ws?client_id=${CLIENT_ID}`);
        websocket.binaryType = "arraybuffer";
        websocket.onopen = () => {
            setStatus("connected");
        };
        websocket.onmessage = (event) => {
            if (typeof event.data === "string") {
                const message = JSON.parse(event.data);
                if (message?.type == "status" && message?.data?.sid) {
                    setStatus("ready");
                }
                if (message?.type) {
                    if (message?.type == "executing" && message?.data?.node == null)
                        setCurrentLog("done")
                    else if (message?.type == "live_status")
                        setCurrentLog(`running - ${message.data?.current_node} ${(message.data.progress * 100).toFixed(2)}%`)
                    else if (message?.type == "elapsed_time")
                        setCurrentLog(`elapsed time: ${Math.ceil(message.data?.elapsed_time * 100) / 100}s`)
                }
                console.log("Received message:", message);
            }
            if (event.data instanceof ArrayBuffer) {
                console.log("Received binary message:");
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
                const fileSize = blob.size;
                console.log(`Received image size: ${(fileSize / 1024).toFixed(2)} KB`);

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
            <div className='flex gap-2'>
                <Badge variant={'outline'} className='w-fit'>Status: {status}</Badge>
                {(currentLog || status == "connected" || status == "ready") && <Badge variant={'outline'} className='w-fit'>
                    {currentLog}
                    {status == "connected" && !currentLog && "stating comfy ui"}
                    {status == "ready" && !currentLog && " running"}
                </Badge>}
            </div>

            <div className='relative w-full'>
                <canvas ref={canvasRef} className='rounded-lg ring-1 ring-black/10 w-full aspect-square' width={1024} height={1024}></canvas>
                {/* {
                    <><Skeleton className={
                        cn("absolute top-0 left-0 w-full h-full aspect-square opacity-20 transition-opacity", pending ? "visible" : "invisible opacity-0")
                    } /></>
                } */}
            </div>


            <Input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
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