import { StructuredAgent } from "./index.js";
import { ILLMService, ChatMessage } from "../llm/types.js";
import { ModelConfig } from "../types/index.js";
import { MaxIterationsExceededError } from "../errors/index.js";

// Mock LLM Service Implementation
class MockLLMService implements ILLMService {
  private responses: string[] = [];
  private callCount = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async complete(
    _messages: ChatMessage[],
    _model: string,
    _config?: ModelConfig
  ): Promise<string> {
    const response = this.responses[this.callCount];
    this.callCount++;
    return response || "{}";
  }

  getCallCount() {
    return this.callCount;
  }
}

describe("StructuredAgent", () => {
  const inputSchema = {
    type: "object",
    properties: {
      input: { type: "string" },
    },
    required: ["input"],
  };

  const outputSchema = {
    type: "object",
    properties: {
      result: { type: "string" },
    },
    required: ["result"],
  };

  const config = {
    openAiApiKey: "dummy-key",
    generatorModel: "gpt-test",
    reviewerModel: "gpt-reviewer",
    inputSchema,
    outputSchema,
    systemPrompt: "Test Prompt",
  };

  it("should return valid JSON on the first attempt", async () => {
    const validJson = JSON.stringify({ result: "success" });
    const mockLLM = new MockLLMService([validJson]);

    const agent = new StructuredAgent({
      ...config,
      llmService: mockLLM,
    });

    const result = await agent.run({ input: "test" });
    expect(result).toEqual({ result: "success" });
    expect(mockLLM.getCallCount()).toBe(1);
  });

  it("should retry and succeed when initial response is invalid", async () => {
    const invalidJson = JSON.stringify({ result: 123 }); // Invalid type
    const validJson = JSON.stringify({ result: "fixed" });
    const mockLLM = new MockLLMService([invalidJson, validJson]);

    const agent = new StructuredAgent({
      ...config,
      llmService: mockLLM,
    });

    const result = await agent.run({ input: "test" });
    expect(result).toEqual({ result: "fixed" });
    expect(mockLLM.getCallCount()).toBe(2); // 1 generation + 1 review
  });

  it("should throw MaxIterationsExceededError when max iterations are reached", async () => {
    const invalidJson = JSON.stringify({ result: 123 });
    // Returns invalid JSON 6 times (1 gen + 5 reviews)
    const mockLLM = new MockLLMService(Array(6).fill(invalidJson));

    const agent = new StructuredAgent({
      ...config,
      llmService: mockLLM,
      maxIterations: 5,
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
      ...config,
      llmService: mockLLM,
    });

    const result = await agent.run({ input: "test" });
    expect(result).toEqual({ result: "recovered" });
    expect(mockLLM.getCallCount()).toBe(2);
  });
});
