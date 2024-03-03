// usePromptQueue.js
import { useState, useCallback, useRef } from 'react';
import OpenAI from "openai"; 
import { useRefState } from '@/lib/state';

async function generateTemporalPrompts(promptText: string): Promise<string[]> {
    try {
        // const openai = new OpenAI(process.env.OPENAI_API_KEY);
        const openai = new OpenAI({
            apiKey: (process.env.NEXT_PUBLIC_OPENAI_API_KEY),
            dangerouslyAllowBrowser: true
          })
        // const openai = new OpenAI(process.env.OPENAI_API_KEY, {
        //     organization: process.env.OPENAI_ORG_ID // Add this line to include your organization ID
        // });

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are an expert scene writer" },
                    { role: "user", content: `Given the prompt: "${promptText}", generate a series of 5 temporally consistent and imaginative short prompts that 
                    expand the scene in a narrative sequence. Each prompt must only differ from each other by one or two words. Add objects, actions, and emotion word swaps to the scene.
                    Separate each prompt with a newline.` },],
            model: "gpt-4-0613",
          });

        // Split the response into an array, assuming prompts are separated by newlines
        console.log("completion:", completion.choices[0].message.content);
        const promptsArray = completion.choices[0].message.content.trim().split('\n').filter(prompt => prompt.length > 0);

        return promptsArray; 
    } catch (error) {
        console.error("Error generating temporal prompts:", error);
        return []; 
    }
}

export const usePromptQueue = () => {
    // const [promptQueue, setPromptQueue, promptQueueRef] = useRefState([]);
    const promptQueueRef = useRef<string[]>([]);

    const getPromptQueue = useCallback(() => promptQueueRef.current, []);

    const addPromptToQueue = useCallback((userPrompt) => {
        // setPromptQueue(currentQueue => [userPrompt, ...currentQueue]);
        promptQueueRef.current = [userPrompt, ...promptQueueRef.current];
    }, []);


    const removeFirstPromptFromQueue = useCallback(() => {
        // Correctly slice the array from the second element onwards
        // debugger;
        console.log("promptQueueRef.current bef:", promptQueueRef.current); //length 5
        promptQueueRef.current = promptQueueRef.current.slice(1);
        console.log("promptQueueRef.current aft:", promptQueueRef.current); // length 1
    }, []);

    
    // const removeFirstPromptFromQueue = useCallback(() => {
    //     // setPromptQueue(currentQueue => currentQueue.slice(1));
    //     const [, tempQueue] = promptQueueRef.current;
    //     promptQueueRef.current = tempQueue;
    // }, []);

    const refillQueueWithGeneratedPrompts = useCallback(async (basePrompt) => {
        if (promptQueueRef.current.length === 0) {
            try {
                // Assuming generateTemporalPrompts is defined elsewhere and imported
                const generatedPrompts = await generateTemporalPrompts(basePrompt);
                promptQueueRef.current = generatedPrompts;
            } catch (error) {
                console.error("Error generating prompts:", error);
            }
        }
    }, []);

    return {
        addPromptToQueue,
        removeFirstPromptFromQueue,
        refillQueueWithGeneratedPrompts,
        getPromptQueue,
    };
};
