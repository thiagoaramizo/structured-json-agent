import { jest } from "@jest/globals";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { LLMFactory } from "./factory.js";
import { OpenAIAdapter } from "./adapters/openai.js";
import { GoogleGenAIAdapter } from "./adapters/google.js";
import { AnthropicAdapter } from "./adapters/anthropic.js";
import { DeepSeekAdapter } from "./adapters/deepseek.js";
import { ILLMService, ChatMessage, ResponseComplete } from "./types.js";

// Mocks
jest.mock("openai");
jest.mock("@google/genai");
jest.mock("@anthropic-ai/sdk");

class MockILLMService implements ILLMService {
  async complete(params: { messages: ChatMessage[], model: string }): Promise<ResponseComplete> {
    return {
      data: "response",
      meta: {
        provider: "mock",
        model: params.model,
      },
    };
  }
}

describe("LLMFactory", () => {
  it("should return the instance if it implements ILLMService", () => {
    const service = new MockILLMService();
    const result = LLMFactory.create(service);
    expect(result).toBe(service);
  });

  it("should return OpenAIAdapter for OpenAI instance", () => {
    const openai = new OpenAI({ apiKey: "test" });
    const result = LLMFactory.create(openai);
    expect(result).toBeInstanceOf(OpenAIAdapter);
  });

  it("should return DeepSeekAdapter for OpenAI instance with deepseek base URL", () => {
    const openai = new OpenAI({ apiKey: "test", baseURL: "https://api.deepseek.com" });
    const result = LLMFactory.create(openai);
    expect(result).toBeInstanceOf(DeepSeekAdapter);
  });

  it("should return AnthropicAdapter for Anthropic instance", () => {
    const anthropic = new Anthropic({ apiKey: "test" });
    const result = LLMFactory.create(anthropic);
    expect(result).toBeInstanceOf(AnthropicAdapter);
  });

  it("should return GoogleGenAIAdapter for GoogleGenAI instance", () => {
    const google = new GoogleGenAI({ apiKey: "test" });
    const result = LLMFactory.create(google);
    expect(result).toBeInstanceOf(GoogleGenAIAdapter);
  });
});
