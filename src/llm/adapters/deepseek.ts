import OpenAI from "openai";
import { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ILLMService, ChatMessage, ResponseComplete } from "../types.js";
import { LLMProvider, ModelConfig } from "../../types/index.js";
import { LLMExecutionError } from "../../errors/index.js";
import { ChatCompletionCreateParams } from "openai/resources.mjs";

export class DeepSeekAdapter implements ILLMService {
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
      let messages = [...params.messages];

      if (params.outputFormat) {
        const jsonSchema = zodToJsonSchema(params.outputFormat, "output");
        const schemaString = JSON.stringify(jsonSchema, null, 2);
        
        const systemMessageIndex = messages.findIndex(m => m.role === "system");
        const schemaInstruction = `\n\nYou must output a valid JSON object matching this schema:\n${schemaString}`;

        if (systemMessageIndex !== -1) {
            messages[systemMessageIndex] = {
                ...messages[systemMessageIndex],
                content: messages[systemMessageIndex].content + schemaInstruction
            };
        } else {
            messages.unshift({
                role: "system",
                content: schemaInstruction
            });
        }
      }

      const createParams: ChatCompletionCreateParams = {
        messages: messages,
        model: params.model,
        response_format: { type: "json_object" },
        temperature: params.config?.temperature ?? 1,
        top_p: params.config?.top_p,
        max_tokens: params.config?.max_tokens,
        presence_penalty: params.config?.presence_penalty,
        frequency_penalty: params.config?.frequency_penalty,
      }

      const response = await this.client.chat.completions.create(createParams);

      const message = response.choices[0]?.message;
      const content = message?.content;
      
      if (message?.refusal) {
        throw new LLMExecutionError(`Model refused to generate response: ${message.refusal}`);
      }

      if (!content) {
        throw new LLMExecutionError("Received empty response from DeepSeek");
      }

      const meta = {
        provider: LLMProvider.Deepseek,
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
      throw new LLMExecutionError("Failed to execute DeepSeek request", error);
    }
  }
}
