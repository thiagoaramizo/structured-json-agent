import OpenAI from "openai";
import { ILLMService, ChatMessage } from "./types.js";
import { ModelConfig } from "../types/index.js";
import { LLMExecutionError } from "../errors/index.js";

export class OpenAILLMService implements ILLMService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  public async complete(
    messages: ChatMessage[],
    model: string,
    config?: ModelConfig
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        messages: messages,
        model: model,
        response_format: { type: "json_object" }, // Force JSON mode
        temperature: config?.temperature ?? 0.7,
        top_p: config?.top_p,
        max_tokens: config?.max_tokens,
        presence_penalty: config?.presence_penalty,
        frequency_penalty: config?.frequency_penalty,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new LLMExecutionError("Received empty response from LLM");
      }

      return content;
    } catch (error) {
      throw new LLMExecutionError("Failed to execute LLM request", error);
    }
  }
}
