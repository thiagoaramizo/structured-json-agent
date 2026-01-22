# Structured JSON Agent

A typed and extensible TypeScript library for creating and running Iterative AI Agents that guarantee structured JSON output.

This library orchestrates a **Generator ↔ Reviewer** cycle to ensure that the output from Large Language Models (LLMs) strictly adheres to a defined JSON Schema.

## Features

*   **Guaranteed JSON Output**: Enforces strict adherence to JSON Schemas (Draft-07+).
*   **Iterative Self-Correction**: Automatically detects validation errors and feeds them back to a "Reviewer" model to fix the output.
*   **Type-Safe**: Built with TypeScript for full type inference and safety.
*   **Model Agnostic**: Compatible with OpenAI by default, but extensible for other providers.
*   **Production Ready**: Includes typed errors, extensive validation, and a clean API.

## Installation

```bash
npm install structured-json-agent
```

## Usage

### 1. Import and Configure

```typescript
import { StructuredAgent } from "structured-json-agent";

// Define your Schemas
const inputSchema = {
  type: "object",
  properties: {
    topic: { type: "string" },
    depth: { type: "string", enum: ["basic", "advanced"] }
  },
  required: ["topic", "depth"]
};

const outputSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
    summary: { type: "string" }
  },
  required: ["title", "keyPoints", "summary"]
};

// Initialize the Agent
const agent = new StructuredAgent({
  openAiApiKey: process.env.OPENAI_API_KEY!,
  generatorModel: "gpt-4-turbo",
  reviewerModel: "gpt-3.5-turbo", // Can be a faster/cheaper model for simple fixes
  inputSchema,
  outputSchema,
  systemPrompt: "You are an expert summarizer. Create a structured summary based on the topic.",
  maxIterations: 3 // Optional: Max correction attempts (default: 5)
});
```

### 2. Run the Agent

```typescript
async function main() {
  try {
    const result = await agent.run({
      topic: "Clean Architecture",
      depth: "advanced"
    });

    console.log("Result:", result);
    // Output is guaranteed to match outputSchema
  } catch (error) {
    console.error("Agent failed:", error);
  }
}

main();
```

## How It Works

1.  **Validation**: The input JSON is validated against the `inputSchema`.
2.  **Generation**: The `generatorModel` creates an initial response based on the system prompt and input.
3.  **Verification Loop**:
    *   The response is parsed and validated against `outputSchema`.
    *   **If Valid**: The result is returned immediately.
    *   **If Invalid**: The `reviewerModel` is invoked with the invalid JSON, the specific validation errors, and the expected schema. It attempts to fix the JSON.
4.  **Convergence**: This cycle repeats until a valid JSON is produced or `maxIterations` is reached.

## API Reference

### `StructuredAgent` Config

| Property | Type | Description |
|Col |Col |Col |
| `openAiApiKey` | `string` | Your OpenAI API Key. |
| `generatorModel` | `string` | Model ID for the initial generation (e.g., `gpt-4`). |
| `reviewerModel` | `string` | Model ID for the review/correction phase. |
| `inputSchema` | `object` | JSON Schema for validating the input. |
| `outputSchema` | `object` | JSON Schema for the expected output. |
| `systemPrompt` | `string` | Core instructions for the agent. |
| `maxIterations` | `number?` | Max retries for correction. Default: 5. |
| `modelConfig` | `ModelConfig?` | Optional parameters (temperature, etc.). |
| `llmService` | `ILLMService?` | Optional custom LLM service implementation. |

### Error Handling

The library exports specific error classes for handling failures:

*   `InvalidInputSchemaError`: Input schema is invalid.
*   `InvalidOutputSchemaError`: Output schema is invalid.
*   `SchemaValidationError`: Input data does not match the schema.
*   `MaxIterationsExceededError`: The agent could not produce valid JSON within the limit.
*   `LLMExecutionError`: Failure in communicating with the LLM provider.

## Architecture

The project is structured by domain:

*   `src/agent`: Core orchestration logic.
*   `src/schemas`: Validation logic using AJV.
*   `src/llm`: Interface and implementation for LLM providers.
*   `src/errors`: Custom error definitions.
*   `src/types`: Shared interfaces.

