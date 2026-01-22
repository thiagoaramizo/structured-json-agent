import { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SchemaValidator } from "../schemas/validator.js";
import { ChatMessage, LLMFactory, ILLMService } from "../llm/index.js";
import {
  AgentConfig,
} from "../types/index.js";
import {
  InvalidInputSchemaError,
  InvalidOutputSchemaError,
  SchemaValidationError,
  MaxIterationsExceededError,
  LLMExecutionError,
} from "../errors/index.js";

/**
 * StructuredAgent is a class that implements a structured agent for generating and reviewing JSON outputs.
 * It uses a language model to generate initial responses and, optionally, a reviewer model to validate and improve those responses.
 * 
 * @param config - The configuration object for the agent.
 */
export class StructuredAgent {
  private schemaValidator: SchemaValidator;
  private inputValidator: ZodSchema;
  private outputValidator: ZodSchema;
  private config: AgentConfig;
  private generatorService: ILLMService;
  private reviewerService?: ILLMService;

  /**
   * Creates an instance of StructuredAgent.
   * 
   * @param config - The configuration object for the agent.
   */
  constructor(config: AgentConfig) {
    this.config = config;
    this.schemaValidator = new SchemaValidator();

    try {
      this.inputValidator = this.schemaValidator.compile(config.inputSchema);
    } catch (e) {
      throw new InvalidInputSchemaError("Failed to compile input schema", e);
    }

    try {
      this.outputValidator = this.schemaValidator.compile(config.outputSchema);
    } catch (e) {
      throw new InvalidOutputSchemaError("Failed to compile output schema", e);
    }

    this.generatorService = LLMFactory.create(config.generator.llmService);
    if (config.reviewer) {
      this.reviewerService = LLMFactory.create(config.reviewer.llmService);
    }
  }

  /**
   * Runs the agent with the given input JSON.
   * 
   * @param inputJson - The input JSON to process.
   * @returns A promise that resolves to the processed JSON.
   */
  public async run(inputJson: unknown): Promise<unknown> {

    try {
      this.schemaValidator.validate(this.inputValidator, inputJson);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw error;
      }
      throw error;
    }

    const maxIterations = this.config.maxIterations ?? 1;
    const history: unknown[] = [];
    
    let currentJson = await this.generateInitialResponse(inputJson);
    history.push({ step: "generation", result: currentJson });

    let validationResult = this.validateOutput(currentJson);
    if (validationResult.valid) {
      return currentJson;
    }

    for (let i = 0; i < maxIterations; i++) {
      try {
        currentJson = await this.reviewResponse(
          currentJson,
          validationResult.errors || [],
          inputJson // Context might be needed
        );
        history.push({ step: `review-${i + 1}`, result: currentJson });

        validationResult = this.validateOutput(currentJson);
        if (validationResult.valid) {
          return currentJson;
        }
      } catch (error) {
        if (error instanceof LLMExecutionError) {
          throw error;
        }
      }
    }

    throw new MaxIterationsExceededError(
      `Failed to generate valid JSON after ${maxIterations} review iterations`,
      history
    );
  }

  private async generateInitialResponse(input: unknown): Promise<unknown> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: this.buildSystemPrompt(),
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ];

    const responseText = await this.generatorService.complete({
      messages,
      model: this.config.generator.model,
      config: this.config.generator.config,
      outputFormat: this.outputValidator
    });

    return this.parseJson(responseText);
  }

  private async reviewResponse(
    invalidJson: unknown,
    errors: string[],
    originalInput: unknown
  ): Promise<unknown> {
    const reviewerService = this.reviewerService || this.generatorService;
    const reviewerConfig = this.config.reviewer || this.config.generator;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a strict JSON reviewer. 
Your task is to fix the provided JSON so it adheres to the Schema.
Output ONLY the corrected JSON.`,
      },
      {
        role: "user",
        content: `Original Input Context: ${JSON.stringify(originalInput)}
        
The following JSON is INVALID based on the output schema:
${JSON.stringify(invalidJson)}

Validation Errors:
${errors.join("\n")}

Expected Output Schema:
${JSON.stringify(zodToJsonSchema(this.config.outputSchema))}

Please correct the JSON.`,
      },
    ];

    const responseText = await reviewerService.complete({
      messages,
      model: reviewerConfig.model,
      config: reviewerConfig.config,
      outputFormat: this.outputValidator
    });

    return this.parseJson(responseText);
  }

  private validateOutput(data: unknown): { valid: boolean; errors?: string[] } {
    try {
      this.schemaValidator.validate(this.outputValidator, data);
      return { valid: true };
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        const formattedErrors = this.schemaValidator.formatErrors(error.errors as any[]);
        return { valid: false, errors: [formattedErrors] };
      }
      return { valid: false, errors: ["Unknown validation error"] };
    }
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (e) {
      return text; 
    }
  }

  private buildSystemPrompt(): string {
    const jsonSchema = zodToJsonSchema(this.config.outputSchema);
    return `${this.config.systemPrompt}

IMPORTANT: You must output strict JSON only.
The output must adhere to the following JSON Schema:
${JSON.stringify(jsonSchema)}
`;
  }
}
