import { ModelConfig } from "../types/index.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ILLMService {
  complete(
    messages: ChatMessage[],
    model: string,
    config?: ModelConfig
  ): Promise<string>;
}
