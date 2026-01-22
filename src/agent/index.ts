import { ValidateFunction } from "ajv";
import { SchemaValidator } from "../schemas/validator.js";
import { OpenAILLMService, ILLMService, ChatMessage } from "../llm/index.js";
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

export class StructuredAgent {
  private schemaValidator: SchemaValidator;
  private llmService: ILLMService;
  private inputValidator: ValidateFunction;
  private outputValidator: ValidateFunction;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.schemaValidator = new SchemaValidator();
    
    // Use provided LLM service or default to OpenAI
    this.llmService = config.llmService || new OpenAILLMService(config.openAiApiKey);

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
  }

  public async run(inputJson: unknown): Promise<unknown> {
    // 1. Validate Input
    try {
      this.schemaValidator.validate(this.inputValidator, inputJson);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        // Enhance error message if needed, but the original is good
        throw error;
      }
      throw error;
    }

    const maxIterations = this.config.maxIterations ?? 5;
    const history: unknown[] = [];
    
    // 2. Initial Generation
    let currentJson = await this.generateInitialResponse(inputJson);
    history.push({ step: "generation", result: currentJson });

    let validationResult = this.validateOutput(currentJson);
    if (validationResult.valid) {
      return currentJson;
    }

    // 3. Review Loop
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
        // If LLM fails or parsing fails during review, we record it and continue?
        // Or throw? The requirement says "return exclusively a valid JSON".
        // If we can't continue, we should probably throw or let the loop hit max iterations.
        // For now, let's treat execution errors as fatal or part of the attempt?
        // If it's a parsing error, it's a validation error.
        // If it's an API error, it's an LLMExecutionError.
        if (error instanceof LLMExecutionError) {
          throw error;
        }
        // If JSON parse error in reviewResponse, it might be caught there.
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

    const responseText = await this.llmService.complete(
      messages,
      this.config.generatorModel,
      this.config.modelConfig
    );

    return this.parseJson(responseText);
  }

  private async reviewResponse(
    invalidJson: unknown,
    errors: string[],
    originalInput: unknown
  ): Promise<unknown> {
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
${JSON.stringify(this.config.outputSchema)}

Please correct the JSON.`,
      },
    ];

    const responseText = await this.llmService.complete(
      messages,
      this.config.reviewerModel,
      this.config.modelConfig
    );

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
      // If parsing fails, we return the text (as string) or null?
      // But the flow expects unknown (object).
      // If we return the text, the schema validation will likely fail (unless schema allows string).
      // This allows the reviewer to see the malformed JSON text.
      return text; 
    }
  }

  private buildSystemPrompt(): string {
    return `${this.config.systemPrompt}

IMPORTANT: You must output strict JSON only.
The output must adhere to the following JSON Schema:
${JSON.stringify(this.config.outputSchema)}
`;
  }
}
