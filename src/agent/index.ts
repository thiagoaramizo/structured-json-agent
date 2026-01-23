import { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SchemaValidator } from "../schemas/validator.js";
import { ChatMessage, LLMFactory, ILLMService, ResponseComplete } from "../llm/index.js";
import {
  AgentConfig,
  AgentResult,
  MetadataAgentResult,
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
   * @param ref - An optional reference identifier for the run.
   * 
   * @template TOutput - The type of the output. Defaults to unknown.
   * 
   * @returns A promise that resolves to the AgentRunResult object containing the structured output and execution metadata.
   * {
   *   output: TOutput,
   *   metadata: MetadataAgentResult[],
   *   ref?: string | number,
   * }
   * @example
   * const result = await agent.run({ input: "some data" }, "12345");
   * console.log(result.output); // Typed output matching outputSchema
   * console.log(result.metadata); // Execution steps and token usage
   * console.log(result.ref); // Optional reference ID if provided
   */
  public async run<TOutput = unknown>(inputJson: unknown, ref?: string | number): Promise<AgentResult<TOutput>> {

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
    const metadata: MetadataAgentResult[] = [];
    
    let initalResponse = await this.generateInitialResponse(inputJson);

    let currentJson = this.parseJson(initalResponse.data);
    history.push({ step: "generation", result: currentJson });

    let validationResult = this.validateOutput(currentJson);
    metadata.push({
      ...initalResponse.meta,
      step: "generation",
      validation: validationResult,
    });

    if (validationResult.valid) {
      return {
        output: currentJson as TOutput,
        metadata,
        ref,
      };
    }

    for (let i = 0; i < maxIterations; i++) {
      try {
        const response = await this.reviewResponse(
          currentJson,
          validationResult.errors || [],
          inputJson // Context might be needed
        );
        currentJson = this.parseJson(response.data);
        history.push({ step: `review-${i + 1}`, result: currentJson });

        validationResult = this.validateOutput(currentJson);
        metadata.push({
          ...response.meta,
          step: `review-${i + 1}`,
          validation: validationResult,
        });
        if (validationResult.valid) {
          return {
            output: currentJson as TOutput,
            metadata,
            ref,
          };
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

  private async generateInitialResponse(input: unknown): Promise<ResponseComplete> {
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

    const response = await this.generatorService.complete({
      messages,
      model: this.config.generator.model,
      config: this.config.generator.config,
      outputFormat: this.outputValidator
    });

    return {
      data: response.data,
      meta: response.meta,
    };
  }

  private async reviewResponse(
    invalidJson: unknown,
    errors: string[],
    originalInput: unknown
  ): Promise<ResponseComplete> {
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

    const response= await reviewerService.complete({
      messages,
      model: reviewerConfig.model,
      config: reviewerConfig.config,
      outputFormat: this.outputValidator
    });

    return {
      data: response.data,
      meta: response.meta,
    };
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
