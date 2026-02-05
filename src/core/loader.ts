/**
 * OpenAPI 명세 로더
 * 파일 경로 또는 URL에서 OpenAPI 명세를 로드합니다.
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPISpec } from '../types/index.js';

export interface LoaderOptions {
  /** OpenAPI 명세 파일 경로 또는 URL */
  source: string;
}

/**
 * OpenAPI 명세를 로드합니다.
 * @param options 로더 옵션
 * @returns 파싱된 OpenAPI 명세
 */
export async function loadSpec(options: LoaderOptions): Promise<OpenAPISpec> {
  const { source } = options;
  
  try {
    // swagger-parser가 자동으로 파일/URL을 감지하고 YAML/JSON을 파싱
    const api = await SwaggerParser.parse(source);
    return api as OpenAPISpec;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`OpenAPI 명세 로드 실패: ${error.message}`);
    }
    throw error;
  }
}

/**
 * OpenAPI 명세를 검증합니다.
 * @param source 명세 경로 또는 URL
 * @returns 유효성 여부
 */
export async function validateSpec(source: string): Promise<boolean> {
  try {
    await SwaggerParser.validate(source);
    return true;
  } catch {
    return false;
  }
}
