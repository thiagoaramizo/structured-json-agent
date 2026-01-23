import { StructuredAgent } from "./index.js";
import { ILLMService, ChatMessage, ResponseComplete } from "../llm/types.js";
import { ModelConfig, AgentResult } from "../types/index.js";
import { MaxIterationsExceededError } from "../errors/index.js";
import { z } from "zod";

// Mock LLM Service Implementation
class MockLLMService implements ILLMService {
  private responses: string[] = [];
  private callCount = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async complete(params: {
    messages: ChatMessage[];
    model: string;
    config?: ModelConfig;
  }): Promise<ResponseComplete> {
    const response = this.responses[this.callCount];
    this.callCount++;
    return {
      data: response || "{}",
      meta: {
        provider: "mock",
        model: params.model,
      },
    };
  }

  getCallCount() {
    return this.callCount;
  }
}

describe("StructuredAgent", () => {
  const inputSchema = z.object({
    input: z.string(),
  });

  const outputSchema = z.object({
    result: z.string(),
  });

  const baseConfig = {
    systemPrompt: "Test Prompt",
    inputSchema,
    outputSchema,
  };

  it("should return valid JSON on the first attempt", async () => {
    const validJson = JSON.stringify({ result: "success" });
    const mockLLM = new MockLLMService([validJson]);

    const agent = new StructuredAgent({
      ...baseConfig,
      generator: {
        llmService: mockLLM,
        model: "gpt-test",
      },
    });

    const result = await agent.run({ input: "test" });
    expect(result.output).toEqual({ result: "success" });
    expect(mockLLM.getCallCount()).toBe(1);
  });

  it("should pass through the optional ref parameter", async () => {
    const validJson = JSON.stringify({ result: "success" });
    const mockLLM = new MockLLMService([validJson]);

    const agent = new StructuredAgent({
      ...baseConfig,
      generator: {
        llmService: mockLLM,
        model: "gpt-test",
      },
    });

    const ref = "test-ref-123";
    const result = await agent.run({ input: "test" }, ref);
    expect(result.output).toEqual({ result: "success" });
    expect(result.ref).toBe(ref);
  });

  it("should retry and succeed when initial response is invalid", async () => {
    const invalidJson = JSON.stringify({ result: 123 }); // Invalid type
    const validJson = JSON.stringify({ result: "fixed" });
    const mockLLM = new MockLLMService([invalidJson, validJson]);

    const agent = new StructuredAgent({
      ...baseConfig,
      generator: {
        llmService: mockLLM,
        model: "gpt-test",
      },
      reviewer: {
        llmService: mockLLM,
        model: "gpt-reviewer",
      },
    });

    const result = await agent.run({ input: "test" });
    expect(result.output).toEqual({ result: "fixed" });
    expect(mockLLM.getCallCount()).toBe(2); // 1 generation + 1 review
  });

  it("should throw MaxIterationsExceededError when max iterations are reached", async () => {
    const invalidJson = JSON.stringify({ result: 123 });
    // Returns invalid JSON 6 times (1 gen + 5 reviews)
    const mockLLM = new MockLLMService(Array(6).fill(invalidJson));

    const agent = new StructuredAgent({
      ...baseConfig,
      maxIterations: 5,
      generator: {
        llmService: mockLLM,
        model: "gpt-test",
      },
      reviewer: {
        llmService: mockLLM,
        model: "gpt-reviewer",
      },
    });

    await expect(agent.run({ input: "test" })).rejects.toThrow(
      MaxIterationsExceededError
    );
    expect(mockLLM.getCallCount()).toBe(6); // Initial + 5 retries
  });

  it("should handle malformed JSON strings by treating them as invalid", async () => {
    const malformedJson = "{ result: "; // Syntax error
    const validJson = JSON.stringify({ result: "recovered" });
    const mockLLM = new MockLLMService([malformedJson, validJson]);

    const agent = new StructuredAgent({
      ...baseConfig,
      generator: {
        llmService: mockLLM,
        model: "gpt-test",
      },
      reviewer: {
        llmService: mockLLM,
        model: "gpt-reviewer",
      },
    });

    const result = await agent.run({ input: "test" });
    expect(result.output).toEqual({ result: "recovered" });
    expect(mockLLM.getCallCount()).toBe(2);
  });
});
