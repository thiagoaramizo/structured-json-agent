export class StructuredAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidInputSchemaError extends StructuredAgentError {
  constructor(message: string, public context?: unknown) {
    super(message);
  }
}

export class InvalidOutputSchemaError extends StructuredAgentError {
  constructor(message: string, public context?: unknown) {
    super(message);
  }
}

export class SchemaValidationError extends StructuredAgentError {
  constructor(message: string, public errors: unknown[]) {
    super(message);
  }
}

export class MaxIterationsExceededError extends StructuredAgentError {
  constructor(message: string, public attempts: unknown[]) {
    super(message);
  }
}

export class LLMExecutionError extends StructuredAgentError {
  constructor(message: string, public originalError?: unknown) {
    super(message);
  }
}
