import { SchemaValidator } from "./validator.js";
import { InvalidInputSchemaError, SchemaValidationError } from "../errors/index.js";

describe("SchemaValidator", () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe("compile", () => {
    it("should compile a valid schema", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const validate = validator.compile(schema);
      expect(typeof validate).toBe("function");
    });

    it("should throw InvalidInputSchemaError for an invalid schema", () => {
      const schema = {
        type: "invalid-type", // Invalid JSON Schema type
      };
      expect(() => validator.compile(schema)).toThrow(InvalidInputSchemaError);
    });
  });

  describe("validate", () => {
    const schema = {
      type: "object",
      properties: {
        age: { type: "number", minimum: 18 },
      },
      required: ["age"],
    };
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
