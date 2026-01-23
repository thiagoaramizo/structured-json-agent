import { GoogleGenAI } from "@google/genai";
import { ZodSchema } from "zod";
import { ILLMService, ChatMessage, ResponseComplete } from "../types.js";
import { LLMProvider, ModelConfig } from "../../types/index.js";
import { LLMExecutionError } from "../../errors/index.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export class GoogleGenAIAdapter implements ILLMService {
  private client: GoogleGenAI;

  constructor(client: GoogleGenAI) {
    this.client = client;
  }

  public async complete(params: {
    messages: ChatMessage[];
    model: string;
    config?: ModelConfig;
    outputFormat?: ZodSchema;
  }): Promise<ResponseComplete> {
    try {
      // Extract system instruction if present
      const systemMessage = params.messages.find((m) => m.role === "system");
      
      // Filter out system message for the history
      const history = params.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      // New SDK uses client.models.generateContent
      // System instruction is part of the config
      
      const generationConfig = {
        temperature: params.config?.temperature,
        topP: params.config?.top_p,
        maxOutputTokens: params.config?.max_tokens,
        responseMimeType: "application/json",
      };

      const result = await this.client.models.generateContent({
        model: params.model,
        contents: history,
        config: {
          ...generationConfig,
          responseJsonSchema: params.outputFormat ? zodToJsonSchema(params.outputFormat) : undefined,
          systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined
        }
      });

      const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text;

      const meta = {
        provider: LLMProvider.GoogleGenAI,
        model: params.model,
        config: params.config,
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
      };


      if (!text) {
         if (result.candidates && result.candidates.length > 0) {
            const part = result.candidates[0].content?.parts?.[0];
            if (part && 'text' in part) {
              return {
                data: part.text as string,
                meta,
              }
            }
         }
         throw new LLMExecutionError("Received empty response from Google GenAI");
      }

      return {
        data: text,
        meta,
      };
    } catch (error) {
      throw new LLMExecutionError("Failed to execute Google GenAI request", error);
    }
  }
}
