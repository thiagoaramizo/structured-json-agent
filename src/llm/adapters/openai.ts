import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ZodSchema } from "zod";
import { ILLMService, ChatMessage, ResponseComplete } from "../types.js";
import { LLMProvider, ModelConfig } from "../../types/index.js";
import { LLMExecutionError } from "../../errors/index.js";
import { ChatCompletionCreateParams } from "openai/resources.mjs";

export class OpenAIAdapter implements ILLMService {
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  public async complete(params: {
    messages: ChatMessage[];
    model: string;
    config?: ModelConfig;
    outputFormat?: ZodSchema;
  }): Promise<ResponseComplete> {
    try {
      const createParams: ChatCompletionCreateParams = {
        messages: params.messages,
        model: params.model,
        response_format: { type: "json_object" },
        temperature: params.config?.temperature ?? 1,
        top_p: params.config?.top_p,
        max_tokens: params.config?.max_tokens,
        presence_penalty: params.config?.presence_penalty,
        frequency_penalty: params.config?.frequency_penalty,
      }

      if (params.outputFormat) {
        createParams.response_format = zodResponseFormat(params.outputFormat, "response");
      }

      const response = await this.client.chat.completions.create(createParams);

      const message = response.choices[0]?.message;
      const content = message?.content;
      
      if (message?.refusal) {
        throw new LLMExecutionError(`Model refused to generate response: ${message.refusal}`);
      }

      if (!content) {
        throw new LLMExecutionError("Received empty response from LLM");
      }

      const meta = {
        provider: LLMProvider.OpenAI,
        model: params.model,
        config: params.config,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };

      return {
        data: content,
        meta,
      };
    } catch (error) {
      if (error instanceof LLMExecutionError) {
        throw error;
      }
      throw new LLMExecutionError("Failed to execute OpenAI request", error);
    }
  }
}
