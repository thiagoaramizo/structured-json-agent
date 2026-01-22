import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { ILLMService } from "./types.js";
import { OpenAIAdapter } from "./adapters/openai.js";
import { GoogleGenAIAdapter } from "./adapters/google.js";
import { AnthropicAdapter } from "./adapters/anthropic.js";

export type LLMInstance = OpenAI | GoogleGenAI | Anthropic | ILLMService;

export class LLMFactory {
  public static create(instance: LLMInstance): ILLMService {
    if (this.isILLMService(instance)) {
      return instance;
    }

    if (instance instanceof OpenAI) {
      return new OpenAIAdapter(instance);
    }

    if (instance instanceof Anthropic) {
      return new AnthropicAdapter(instance);
    }

    if (instance instanceof GoogleGenAI) {
      return new GoogleGenAIAdapter(instance);
    }

    // Fallback check based on properties if instanceof fails (e.g. different versions or mocked)
    if (this.isOpenAI(instance)) {
       return new OpenAIAdapter(instance as OpenAI);
    }

    if (this.isAnthropic(instance)) {
      return new AnthropicAdapter(instance as Anthropic);
    }

    if (this.isGoogleGenAI(instance)) {
      return new GoogleGenAIAdapter(instance as GoogleGenAI);
    }

    throw new Error("Unknown LLM instance type provided.");
  }

  private static isILLMService(instance: any): instance is ILLMService {
    return typeof instance.complete === "function";
  }

  private static isOpenAI(instance: any): instance is OpenAI {
    return instance?.chat?.completions?.create !== undefined;
  }

  private static isAnthropic(instance: any): instance is Anthropic {
    return instance?.messages?.create !== undefined;
  }

  private static isGoogleGenAI(instance: any): instance is GoogleGenAI {
    // New SDK check
    return instance?.models?.generateContent !== undefined || 
           // Old SDK check just in case
           instance?.getGenerativeModel !== undefined;
  }
}
