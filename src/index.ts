/**
 * API-RuleSmith
 * Transform OpenAPI specs into AI agent-optimized rules
 */

// Types
export * from './types/index.js';

// Core modules
export {
  loadSpec,
  validateSpec,
  preprocess,
  extractEndpoints,
  generateRules,
} from './core/index.js';

// Re-export option types
export type { LoaderOptions } from './core/loader.js';
export type { PreprocessorOptions } from './core/preprocessor.js';
export type { ExtractorOptions } from './core/extractor.js';
export type { GeneratorOptions } from './core/generator.js';
