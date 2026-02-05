/**
 * 규칙 파일 관련 타입 정의
 */

export interface BusinessRule {
  preconditions?: string[];
  errorHandling?: Record<string, string>;
  notes?: string[];
}

export interface RuleOutput {
  operationId: string;
  domain: string;
  filename: string;
  content: string;
  method: string;
  path: string;
  summary?: string;
  requestSchemaName?: string;
  responseSchemaName?: string;
}
