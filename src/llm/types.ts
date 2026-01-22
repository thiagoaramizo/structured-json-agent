import { ZodSchema } from "zod";
import { ModelConfig } from "../types/index.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ILLMService {
  complete(params: {
    messages: ChatMessage[],
    model: string,
    config?: ModelConfig
    outputFormat?: ZodSchema
 }): Promise<string>;
}
