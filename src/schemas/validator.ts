import { ZodSchema } from "zod";
import { SchemaValidationError } from "../errors/index.js";

export class SchemaValidator {
  /**
   * Compiles a schema and returns a validation function.
   * For Zod, the schema itself is the validator.
   */
  public compile(schema: ZodSchema): ZodSchema {
    return schema;
  }

  /**
   * Validates data against a compiled schema validator.
   * Throws SchemaValidationError if invalid.
   */
  public validate(validator: ZodSchema, data: unknown): void {
    const result = validator.safeParse(data);
    if (!result.success) {
      throw new SchemaValidationError(
        "Data validation failed",
        result.error.errors
      );
    }
  }

  /**
   * Helper to format Zod errors into a readable string
   */
  public formatErrors(errors: unknown[]): string {
    return (errors as any[])
      .map((e) => {
        const path = e.path.join(".");
        return path ? `${path}: ${e.message}` : e.message;
      })
      .join("; ");
  }
}
