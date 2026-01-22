import { StructuredAgent } from "../dist/index.js"; // Importing from built lib
// In a real project: import { StructuredAgent } from "structured-json-agent";

const inputSchema = {
  type: "object",
  properties: {
    question: { type: "string" }
  },
  required: ["question"]
};

const outputSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "number" }
  },
  required: ["answer", "confidence"]
};

const agent = new StructuredAgent({
  openAiApiKey: process.env.OPENAI_API_KEY || "your-key",
  generatorModel: "gpt-4-turbo",
  reviewerModel: "gpt-3.5-turbo",
  inputSchema,
  outputSchema,
  systemPrompt: "Answer the question with a confidence score."
});

async function run() {
  try {
    const result = await agent.run({ question: "What is 2+2?" });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

run();
