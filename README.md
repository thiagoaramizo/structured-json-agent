# Structured JSON Agent

A typed and extensible TypeScript library for creating and running Iterative AI Agents that guarantee structured JSON output.

This library orchestrates a **Generator ↔ Reviewer** cycle to ensure that the output from Large Language Models (LLMs) strictly adheres to a defined Zod Schema.

## Features

*   **Guaranteed JSON Output**: Enforces strict adherence to Zod Schemas.
*   **Multi-Provider Support**: Built-in adapters for **OpenAI**, **Google GenAI (Gemini)**, **Anthropic (Claude)**, and **DeepSeek**.
*   **Structured Outputs**: Leverages native structured output capabilities of providers (e.g., OpenAI Structured Outputs, Anthropic Beta) when available.
*   **Iterative Self-Correction**: Automatically detects validation errors and feeds them back to a "Reviewer" model to fix the output.
*   **Type-Safe**: Built with TypeScript and Zod for full type inference and safety.
*   **Flexible Configuration**: Mix and match different providers for generation and review (e.g., generate with GPT-4o, review with Claude 3.5 Sonnet).

## Installation

```bash
npm install structured-json-agent zod openai @anthropic-ai/sdk @google/genai
```

> Note: Install the SDKs for the providers you intend to use.

## Usage

### 1. Import and Configure

```typescript
import { StructuredAgent } from "structured-json-agent";
import { z } from "zod";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// 1. Define your Schemas using Zod
const inputSchema = z.object({
  topic: z.string(),
  depth: z.enum(["basic", "advanced"])
});

const outputSchema = z.object({
  title: z.string(),
  keyPoints: z.array(z.string()),
  summary: z.string()
});

// 2. Initialize Provider Instances
const openAiInstance = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropicInstance = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 3. Initialize the Agent, you can use the same instance for generator and reviewer
const agent = new StructuredAgent({
  // Generator Configuration
  generator: {
    llmService: openAiInstance, // Inject the instance directly
    model: "gpt-5-nano",       // Specify the model
  },
  // Reviewer Configuration (Optional but recommended)
  reviewer: {
    llmService: anthropicInstance,
    model: "claude-sonnet-4-5",
  },
  // Schemas & Prompt
  inputSchema,
  outputSchema,
  systemPrompt: "You are an expert summarizer. Create a structured summary based on the topic.",
});
```

### 2. Run the Agent

To run the agent, use the `run` method with your input data. Optionally, provide a reference (string or number) identifier for tracking in the second parameter.

```typescript
async function main() {
  try {
    const result = await agent.run({
      topic: "Clean Architecture",
      depth: "advanced"
    }, "12345"); // Optional reference for tracking

    console.log("Output:", result.output);
    console.log("Metadata:", result.metadata);
    // Metadata includes provider, model, and iteration count
    console.log("Reference:", result.ref);

    // Result is typed as inferred from outputSchema
  } catch (error) {
    console.error("Agent failed:", error);
  }
}

main();
```

In TypeScript, you can use the `run<T>` method to get a typed result.

```typescript
const result = await agent.run<T>({
  topic: "Clean Architecture",
  depth: "advanced"
}, "12345");
```

The result object is of type `AgentResult<T>`, where `T` is the type inferred from `outputSchema`.

```typescript
type AgentResult<T> = {
  output: T; // Output as per outputSchema
  metadata: {
    provider: string; // e.g., "openai", "deepseek"
    model: string; // e.g., "gpt-4o", "claude-3-5-sonnet"
    inputTokens: number; // Number of tokens in the input
    outputTokens: number; // Number of tokens in the output
    step: string; // Step description ("generation", "review-1", "review-2", etc.)
    validation: {
      valid: boolean; // Whether the output is valid against outputSchema
      errors?: string[]; // Validation errors if any
    }
  }[];
  ref?: string | number; // Optional reference provided for tracking
};
```

## How It Works

1.  **Validation**: The input JSON is validated against the `inputSchema` (Zod).
2.  **Generation**: The `generator` model creates an initial response based on the system prompt and input.
    *   If the provider supports native Structured Outputs (like OpenAI or Anthropic), it is used to maximize reliability.
3.  **Verification Loop**:
    *   The response is parsed and validated against `outputSchema`.
    *   **If Valid**: The result is returned immediately.
    *   **If Invalid**: The `reviewer` model (or generator if no reviewer is set) is invoked with the invalid JSON and specific validation errors. It attempts to fix the output.
4.  **Convergence**: This cycle repeats until a valid JSON is produced or `maxIterations` is reached.

## API Reference

### `AgentConfig`

Configuration object passed to `new StructuredAgent(config)`.

| Property | Type | Description |
| :--- | :--- | :--- |
| `generator` | `LLMConfig` | Configuration for the generation model. |
| `reviewer` | `LLMConfig?` | Configuration for the reviewer model (optional). |
| `inputSchema` | `ZodSchema` | Zod Schema for validating the input. |
| `outputSchema` | `ZodSchema` | Zod Schema for the expected output. |
| `systemPrompt` | `string` | Core instructions for the agent. |
| `maxIterations` | `number?` | Max retries for correction. Default: 5. |

### `LLMConfig`

| Property | Type | Description |
| :--- | :--- | :--- |
| `llmService` | `OpenAI \| GoogleGenAI \| Anthropic \| ILLMService` | The provider instance or custom service. Supports DeepSeek via OpenAI SDK. |
| `model` | `string` | Model ID (e.g., `gpt-4o`, `claude-3-5-sonnet`). |
| `config` | `ModelConfig?` | Optional parameters (temperature, max_tokens, etc.). |

## Architecture

The project is structured by domain:

*   `src/agent`: Core orchestration logic (`StructuredAgent`).
*   `src/schemas`: Validation logic using **Zod**.
*   `src/llm`: Adapters and Factory for LLM providers (`OpenAI`, `Google`, `Anthropic`).
*   `src/errors`: Custom error definitions.
*   `src/types`: Shared interfaces.
