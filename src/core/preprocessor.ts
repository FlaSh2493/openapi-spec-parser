/**
 * OpenAPI 명세 전처리기
 * $ref 참조를 치환하고 스키마를 평탄화합니다.
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPISpec } from '../types/index.js';

export interface PreprocessorOptions {
  /** 사용하지 않는 스키마 제거 */
  removeUnusedSchemas?: boolean;
  /** x-internal 등 내부 확장 필드 제거 */
  removeInternalExtensions?: boolean;
}

/**
 * OpenAPI 명세의 모든 $ref를 치환합니다.
 * @param spec OpenAPI 명세
 * @param options 전처리 옵션
 * @returns Dereferenced 명세
 */
export async function preprocess(
  spec: OpenAPISpec,
  options: PreprocessorOptions = {}
): Promise<OpenAPISpec> {
  const { removeInternalExtensions = true } = options;
  
  // $ref 치환 (순환 참조 허용)
  const dereferenced = await SwaggerParser.dereference(spec as never, {
    dereference: {
      circular: 'ignore', // 순환 참조는 무시
    },
  }) as OpenAPISpec;
  
  if (removeInternalExtensions) {
    removeExtensions(dereferenced);
  }
  
  return dereferenced;
}

/**
 * x- 확장 필드 중 내부용 필드를 재귀적으로 제거합니다.
 */
function removeExtensions(obj: unknown): void {
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach(removeExtensions);
    return;
  }
  
  const record = obj as Record<string, unknown>;
  const keysToDelete: string[] = [];
  
  for (const key of Object.keys(record)) {
    // x-internal, x-hidden 등 내부용 확장 필드 제거
    if (key.startsWith('x-internal') || key.startsWith('x-hidden')) {
      keysToDelete.push(key);
    } else {
      removeExtensions(record[key]);
    }
  }
  
  for (const key of keysToDelete) {
    delete record[key];
  }
}
