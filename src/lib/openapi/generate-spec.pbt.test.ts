/**
 * Property-Based Tests for OpenAPI Spec Generation
 * Feature: platform-improvements
 *
 * Properties 47, 48: Zod→OpenAPI conversion, endpoint completeness
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  zodToJsonSchema,
  SCHEMA_REGISTRY,
  V1_ENDPOINT_PATHS,
  generateOpenAPISpec,
} from './generate-spec';

const NUM_RUNS = 100;

// ── Property 47: Zod→OpenAPI produces valid JSON Schema ─────────────

describe('Feature: platform-improvements, Property 47: OpenAPI spec generada desde esquemas Zod', () => {
  /**
   * Validates: Requirements 18.3
   *
   * For any Zod schema registered in SCHEMA_REGISTRY, the generated OpenAPI spec
   * must contain a corresponding JSON Schema with a valid "type" or structural keyword.
   */
  it('every registered Zod schema produces a valid JSON Schema in the OpenAPI spec', () => {
    const schemaNames = Object.keys(SCHEMA_REGISTRY);

    fc.assert(
      fc.property(
        fc.constantFrom(...schemaNames),
        (name: string) => {
          const zodSchema = SCHEMA_REGISTRY[name];
          const jsonSchema = zodToJsonSchema(zodSchema);

          // Must produce an object with structural info
          expect(jsonSchema).toBeDefined();
          expect(typeof jsonSchema).toBe('object');

          // Must have a type or oneOf/anyOf
          const hasType = 'type' in jsonSchema;
          const hasComposite = 'oneOf' in jsonSchema || 'anyOf' in jsonSchema;
          expect(hasType || hasComposite).toBe(true);

          // If it's an object type, it should have properties
          if (jsonSchema.type === 'object' && jsonSchema.properties) {
            expect(typeof jsonSchema.properties).toBe('object');
            expect(Object.keys(jsonSchema.properties as object).length).toBeGreaterThan(0);
          }

          // The full spec must include this schema in components
          const spec = generateOpenAPISpec();
          expect(spec.components.schemas[name]).toBeDefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── Property 48: All v1 endpoints documented ────────────────────────

describe('Feature: platform-improvements, Property 48: OpenAPI documentación completa por endpoint', () => {
  /**
   * Validates: Requirements 18.4
   *
   * For any documented endpoint in the OpenAPI spec, it must include:
   * description, tags, security, and responses with at least a 200 status.
   */
  it('every v1 endpoint path is present in the spec with description, tags, security, and responses', () => {
    const spec = generateOpenAPISpec();

    fc.assert(
      fc.property(
        fc.constantFrom(...V1_ENDPOINT_PATHS),
        (path: string) => {
          const pathItem = spec.paths[path];
          expect(pathItem).toBeDefined();

          // At least one HTTP method defined
          const methods = Object.keys(pathItem);
          expect(methods.length).toBeGreaterThan(0);

          for (const method of methods) {
            const operation = pathItem[method];
            // Must have description
            expect(typeof operation.description).toBe('string');
            expect((operation.description as string).length).toBeGreaterThan(0);

            // Must have tags
            expect(Array.isArray(operation.tags)).toBe(true);
            expect((operation.tags as string[]).length).toBeGreaterThan(0);

            // Must have security
            expect(Array.isArray(operation.security)).toBe(true);

            // Must have responses with at least 200
            const responses = operation.responses as Record<string, unknown>;
            expect(responses).toBeDefined();
            expect(responses['200']).toBeDefined();
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
