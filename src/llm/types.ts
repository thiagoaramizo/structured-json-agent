import { ZodSchema } from "zod";
import { ModelConfig } from "../types/index.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MetaResponseComplete {
    provider: string;
    model: string;
    config?: ModelConfig;
    inputTokens?: number;
    outputTokens?: number;
}

export interface ResponseComplete {
  data: string;
  meta: MetaResponseComplete;
}

export interface ILLMService {
  complete(params: {
    messages: ChatMessage[],
    model: string,
    config?: ModelConfig
    outputFormat?: ZodSchema
 }): Promise<ResponseComplete>;
}
