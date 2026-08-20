import { prisma } from './lib/prisma.js';

async function testOpenRouter() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  console.log("Using model:", settings.modelName);
  
  const systemPrompt = "You have tools. Write a file called opencode-test.txt with content 'hello'.";
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Do it." }
  ];
  
  const tools = [
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Write content to a file. Path should be relative to project root.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string" },
            content: { type: "string" }
          },
          required: ["filePath", "content"]
        }
      }
    }
  ];

  try {
    console.log("Fetching from OpenRouter...");
    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000', 
        'X-Title': 'AI Chat App'
      },
      body: JSON.stringify({
        model: settings.modelName || 'google/gemini-2.5-pro',
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      })
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.substring(0, 500));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    // await prisma.$disconnect();
  }
}

testOpenRouter();
