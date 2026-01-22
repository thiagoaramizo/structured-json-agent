import { SchemaValidator } from "./validator.js";
import { SchemaValidationError } from "../errors/index.js";
import { z } from "zod";

describe("SchemaValidator", () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe("compile", () => {
    it("should return the passed schema", () => {
      const schema = z.object({
        name: z.string(),
      });
      const validate = validator.compile(schema);
      expect(validate).toBe(schema);
    });
  });

  describe("validate", () => {
    const schema = z.object({
      age: z.number().min(18),
    });
    let validateFn: any;

    beforeEach(() => {
      validateFn = validator.compile(schema);
    });

    it("should pass validation for valid data", () => {
      expect(() => validator.validate(validateFn, { age: 20 })).not.toThrow();
    });

    it("should throw SchemaValidationError for invalid data", () => {
      expect(() => validator.validate(validateFn, { age: 10 })).toThrow(
        SchemaValidationError
      );
    });

    it("should contain error details in SchemaValidationError", () => {
      try {
        validator.validate(validateFn, { age: 10 });
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        if (error instanceof SchemaValidationError) {
          expect(error.errors).toBeDefined();
          expect(error.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
