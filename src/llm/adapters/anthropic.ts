import Anthropic from "@anthropic-ai/sdk";
import { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ILLMService, ChatMessage } from "../types.js";
import { ModelConfig } from "../../types/index.js";
import { LLMExecutionError } from "../../errors/index.js";

export class AnthropicAdapter implements ILLMService {
  private client: Anthropic;

  constructor(client: Anthropic) {
    this.client = client;
  }

  public async complete(params: {
    messages: ChatMessage[];
    model: string;
    config?: ModelConfig;
    outputFormat?: ZodSchema;
  }): Promise<string> {
    try {
      const systemMessage = params.messages.find((m) => m.role === "system");
      const conversationMessages = params.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const requestOptions: any = {
        model: params.model,
        messages: conversationMessages,
        system: systemMessage?.content,
        max_tokens: params.config?.max_tokens ?? 1024,
        temperature: params.config?.temperature ?? 0.7,
        top_p: params.config?.top_p,
      };

      const headers: Record<string, string> = {};

      if (params.outputFormat) {
        requestOptions.output_format = {
          type: "json_schema",
          schema: zodToJsonSchema(params.outputFormat)
        };
        // Enable beta feature
        headers["anthropic-beta"] = "structured-outputs-2025-11-13";
      }

      const response = await this.client.messages.create(
        requestOptions,
        { headers }
      );

      const content = response.content[0];
      if (content.type !== "text") {
         throw new LLMExecutionError("Received non-text response from Anthropic");
      }

      return content.text;
    } catch (error) {
      throw new LLMExecutionError("Failed to execute Anthropic request", error);
    }
  }
}
