/**
 * 설정 파일 타입 정의
 */
import type { BusinessRule } from './rule.js';

export interface RuleSmithConfig {
  /** OpenAPI 명세 파일 경로 또는 URL */
  input: string;
  
  /** 규칙 파일 출력 디렉토리 */
  output: string;
  
  /** 도메인(태그)별로 폴더 분리 */
  splitByDomain?: boolean;
  
  /** 출력 언어 */
  language?: 'ko' | 'en';
  
  /** 예시 포함 여부 */
  includeExamples?: boolean;
  
  /** 엔드포인트별 비즈니스 규칙 */
  businessRules?: Record<string, BusinessRule>;
  
  /** 제외할 태그 목록 */
  excludeTags?: string[];
  
  /** 제외할 경로 패턴 (정규식) */
  excludePaths?: string[];
}

export const defaultConfig: Partial<RuleSmithConfig> = {
  splitByDomain: true,
  language: 'ko',
  includeExamples: true,
};
