import OpenAI from "openai";
import { ILLMService } from "../llm/types.js";
import { GoogleGenAI } from "@google/genai";
import { ZodSchema } from "zod";
import Anthropic from "@anthropic-ai/sdk";

export interface ModelConfig {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface LLMInputInstance {
  llmService: OpenAI | GoogleGenAI | Anthropic | ILLMService;
  model: string;
  config?: ModelConfig;
}

export interface AgentConfig {
  generator: LLMInputInstance;
  reviewer?: LLMInputInstance;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  systemPrompt: string;
  maxIterations?: number;
}

export interface AgentRunOptions {
  input: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
