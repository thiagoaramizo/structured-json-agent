import { ILLMService } from "../llm/types.js";

export interface ModelConfig {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface AgentConfig {
  openAiApiKey: string;
  generatorModel: string;
  reviewerModel: string;
  inputSchema: object;
  outputSchema: object;
  systemPrompt: string;
  modelConfig?: ModelConfig;
  maxIterations?: number;
  // Optional custom LLM service for testing or other providers
  llmService?: ILLMService;
}

export interface AgentRunOptions {
  input: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
