import OpenAI from "openai"; 

async function generateTemporalPrompts(promptText: string): Promise<string[]> {
try {
    const openai = new OpenAI(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
    // const openai = new OpenAI(process.env.OPENAI_API_KEY, {
    //     organization: process.env.OPENAI_ORG_ID // Add this line to include your organization ID
    // });
    const completion = await openai.createCompletion({
    model: "text-davinci-003", // Make sure to use the correct model identifier
    prompt: `Given the prompt: "${promptText}", generate a series of temporally consistent and imaginative prompts that 
                    expand the scene in a narrative sequence. Ensure each prompt builds upon the last to create a cohesive storyline. 
                    Separate each prompt with a newline.`,
    temperature: 0.7,
    max_tokens: 150,
    n: 1,
    stop: ["\n\n"],
    });

    // Split the response into an array, assuming prompts are separated by newlines
    const promptsArray = completion.choices[0].text.trim().split('\n').filter(prompt => prompt.length > 0);

    return promptsArray; 
} catch (error) {
    console.error("Error generating temporal prompts:", error);
    return []; 
}
}

// // Example usage
// (async () => {
//     const prompts = await generateTemporalPrompts("A jetpack flying through a futuristic city");
//     console.log("Generated Temporal Prompts:", prompts);
//   })();