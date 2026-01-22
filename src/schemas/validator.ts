import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import { SchemaValidationError, InvalidInputSchemaError } from "../errors/index.js";

export class SchemaValidator {
  private ajv: any;

  constructor() {
    // @ts-ignore: Ajv import structure compatibility
    this.ajv = new Ajv({ allErrors: true, strict: false });
  }

  /**
   * Compiles a schema and returns a validation function.
   * Throws InvalidInputSchemaError if the schema is invalid.
   */
  public compile(schema: object): ValidateFunction {
    try {
      return this.ajv.compile(schema);
    } catch (error) {
      throw new InvalidInputSchemaError("Invalid JSON Schema provided", error);
    }
  }

  /**
   * Validates data against a compiled schema validator.
   * Returns true if valid.
   * Throws SchemaValidationError if invalid.
   */
  public validate(validator: ValidateFunction, data: unknown): void {
    const valid = validator(data);
    if (!valid) {
      throw new SchemaValidationError(
        "Data validation failed",
        validator.errors || []
      );
    }
  }

  /**
   * Helper to format AJV errors into a readable string
   */
  public formatErrors(errors: any[]): string {
    return this.ajv.errorsText(errors);
  }
}
