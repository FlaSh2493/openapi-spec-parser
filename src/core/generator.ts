/**
 * Markdown 규칙 파일 생성기
 * 추출된 엔드포인트 정보를 Markdown 파일로 변환합니다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type {
  EndpointInfo,
  SimplifiedSchema,
  RuleOutput,
  BusinessRule,
} from '../types/index.js';

export interface GeneratorOptions {
  /** 출력 디렉토리 */
  outputDir: string;
  /** 태그별 폴더 분리 */
  splitByDomain?: boolean;
  /** 예시 포함 여부 */
  includeExamples?: boolean;
  /** 출력 언어 */
  language?: 'ko' | 'en';
  /** 비즈니스 규칙 */
  businessRules?: Record<string, BusinessRule>;
}

const LABELS = {
  ko: {
    purpose: '🎯 목적',
    interface: '🔗 인터페이스',
    dataGuide: '📦 데이터 가이드',
    businessRules: '⚠️ 비즈니스 지침',
    method: 'Method',
    url: 'URL',
    pathParams: 'Path Parameters',
    queryParams: 'Query Parameters',
    headerParams: 'Header Parameters',
    requestBody: 'Request Body',
    response: 'Response',
    required: '필수',
    optional: '선택',
    preconditions: '선행 조건',
    errorHandling: '에러 처리',
    notes: '참고 사항',
    nestedTypes: '중첩 타입',
  },
  en: {
    purpose: '🎯 Purpose',
    interface: '🔗 Interface',
    dataGuide: '📦 Data Guide',
    businessRules: '⚠️ Business Rules',
    method: 'Method',
    url: 'URL',
    pathParams: 'Path Parameters',
    queryParams: 'Query Parameters',
    headerParams: 'Header Parameters',
    requestBody: 'Request Body',
    response: 'Response',
    required: 'required',
    optional: 'optional',
    preconditions: 'Preconditions',
    errorHandling: 'Error Handling',
    notes: 'Notes',
    nestedTypes: 'Nested Types',
  },
};

/**
 * camelCase를 kebab-case로 변환합니다.
 * 예: getPetById → get-pet-by-id
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * 엔드포인트들을 Markdown 규칙 파일로 생성합니다.
 */
export async function generateRules(
  endpoints: EndpointInfo[],
  options: GeneratorOptions
): Promise<RuleOutput[]> {
  const {
    outputDir,
    splitByDomain = true,
    includeExamples = true,
    language = 'ko',
    businessRules = {},
  } = options;
  
  const labels = LABELS[language];
  const outputs: RuleOutput[] = [];
  
  for (const endpoint of endpoints) {
    const domain = splitByDomain ? (endpoint.tags[0] ?? 'default') : '';
    const kebabName = toKebabCase(endpoint.operationId);
    const filename = `${kebabName}.md`;
    const filepath = splitByDomain
      ? join(outputDir, domain, filename)
      : join(outputDir, filename);
    
    // 비즈니스 규칙 조회 (operationId 또는 method + path로 매칭)
    const ruleKey = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    const businessRule = businessRules[endpoint.operationId] ?? businessRules[ruleKey];
    
    const content = generateMarkdown(endpoint, labels, includeExamples, businessRule);
    
    // 파일 생성
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, content, 'utf-8');
    
    outputs.push({
      operationId: endpoint.operationId,
      domain,
      filename: filepath,
      content,
      method: endpoint.method.toUpperCase(),
      path: endpoint.path,
      summary: endpoint.summary,
      requestSchemaName: endpoint.requestBody?.schemaName,
      responseSchemaName: endpoint.responses.find((r) => r.statusCode.startsWith('2'))?.schemaName,
    });
  }
  
  // 개별 가이드 및 인덱스 파일 생성
  await generateREADME(outputs, outputDir, splitByDomain, language);
  await generateAgentMd(outputs, outputDir, language);
  await generateLlmsTxt(outputs, outputDir, splitByDomain);
  
  return outputs;
}

function generateMarkdown(
  endpoint: EndpointInfo,
  labels: typeof LABELS.ko,
  includeExamples: boolean,
  businessRule?: BusinessRule
): string {
  const lines: string[] = [];
  
  // 헤더
  lines.push(`# [Rule: ${endpoint.operationId}]`);
  lines.push('');
  
  // 목적
  lines.push(`## ${labels.purpose}`);
  if (endpoint.summary) {
    lines.push(`- ${endpoint.summary}`);
  }
  if (endpoint.description && endpoint.description !== endpoint.summary) {
    lines.push(`- ${endpoint.description}`);
  }
  if (!endpoint.summary && !endpoint.description) {
    lines.push('- (설명 없음)');
  }
  lines.push('');
  
  // 인터페이스
  lines.push(`## ${labels.interface}`);
  lines.push(`- **${labels.method}**: \`${endpoint.method.toUpperCase()}\``);
  lines.push(`- **${labels.url}**: \`${endpoint.path}\``);
  
  // Path Parameters
  const pathParams = endpoint.parameters.filter((p) => p.in === 'path');
  if (pathParams.length > 0) {
    lines.push(`- **${labels.pathParams}**:`);
    for (const param of pathParams) {
      const req = param.required ? labels.required : labels.optional;
      lines.push(`  - \`${param.name}\` (${param.type}, ${req})${param.description ? `: ${param.description}` : ''}`);
    }
  }
  
  // Query Parameters
  const queryParams = endpoint.parameters.filter((p) => p.in === 'query');
  if (queryParams.length > 0) {
    lines.push(`- **${labels.queryParams}**:`);
    for (const param of queryParams) {
      const req = param.required ? labels.required : labels.optional;
      lines.push(`  - \`${param.name}\` (${param.type}, ${req})${param.description ? `: ${param.description}` : ''}`);
    }
  }
  
  // Header Parameters
  const headerParams = endpoint.parameters.filter((p) => p.in === 'header');
  if (headerParams.length > 0) {
    lines.push(`- **${labels.headerParams}**:`);
    for (const param of headerParams) {
      const req = param.required ? labels.required : labels.optional;
      lines.push(`  - \`${param.name}\` (${param.type}, ${req})${param.description ? `: ${param.description}` : ''}`);
    }
  }
  lines.push('');
  
  // 데이터 가이드
  lines.push(`## ${labels.dataGuide}`);
  
  // Request Body
  if (endpoint.requestBody) {
    const schemaLabel = endpoint.requestBody.schemaName 
      ? `${labels.requestBody} (\`${endpoint.requestBody.schemaName}\`)`
      : labels.requestBody;
    lines.push(`### ${schemaLabel}`);
    lines.push(`- **Content-Type**: \`${endpoint.requestBody.contentType}\``);
    lines.push(`- **${labels.required}**: ${endpoint.requestBody.required ? 'Yes' : 'No'}`);
    const requestSchema = endpoint.requestBody.schema;
    const nestedTypes = collectNestedSchemaNames(requestSchema, endpoint.requestBody.schemaName);
    if (nestedTypes.length > 0) {
      lines.push(`- **${labels.nestedTypes}**: ${nestedTypes.map(t => `\`${t}\``).join(', ')}`);
    }

    lines.push('');
    lines.push('```json');
    lines.push(schemaToJsonExample(requestSchema, includeExamples));
    lines.push('```');
    lines.push('');
  }
  
  // Responses
  for (const response of endpoint.responses) {
    const schemaLabel = response.schemaName
      ? `${labels.response} (${response.statusCode}) - \`${response.schemaName}\``
      : `${labels.response} (${response.statusCode})`;
    lines.push(`### ${schemaLabel}`);
    if (response.description) {
      lines.push(`- ${response.description}`);
    }
    if (response.schema) {
      const nestedTypes = collectNestedSchemaNames(response.schema, response.schemaName);
      if (nestedTypes.length > 0) {
        lines.push(`- **${labels.nestedTypes}**: ${nestedTypes.map(t => `\`${t}\``).join(', ')}`);
      }

      lines.push('');
      lines.push('```json');
      lines.push(schemaToJsonExample(response.schema, includeExamples));
      lines.push('```');
    }
    lines.push('');
  }
  
  // 비즈니스 지침
  if (businessRule) {
    lines.push(`## ${labels.businessRules}`);
    
    if (businessRule.preconditions && businessRule.preconditions.length > 0) {
      lines.push(`### ${labels.preconditions}`);
      for (const pre of businessRule.preconditions) {
        lines.push(`- ${pre}`);
      }
      lines.push('');
    }
    
    if (businessRule.errorHandling && Object.keys(businessRule.errorHandling).length > 0) {
      lines.push(`### ${labels.errorHandling}`);
      for (const [code, message] of Object.entries(businessRule.errorHandling)) {
        lines.push(`- **${code}**: "${message}"`);
      }
      lines.push('');
    }
    
    if (businessRule.notes && businessRule.notes.length > 0) {
      lines.push(`### ${labels.notes}`);
      for (const note of businessRule.notes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

function schemaToJsonExample(schema: SimplifiedSchema, useExamples: boolean): string {
  const obj = buildExampleObject(schema, useExamples);
  return JSON.stringify(obj, null, 2);
}

function buildExampleObject(schema: SimplifiedSchema, useExamples: boolean): unknown {
  // 예시가 있으면 사용
  if (useExamples && schema.example !== undefined) {
    return schema.example;
  }
  
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum.join(' | ');
  }
  
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      if (schema.items) {
        return [buildExampleObject(schema.items, useExamples)];
      }
      return [];
    case 'object':
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = buildExampleObject(prop, useExamples);
        }
        return obj;
      }
      return {};
    default:
      return schema.type;
  }
}

/**
 * 에이전트용 지침과 API 인덱스가 통합된 README.md를 생성합니다.
 */
/**
 * 메인 README.md를 생성합니다. (전체 요약 및 주요 파일 안내)
 */
async function generateREADME(
  outputs: RuleOutput[],
  outputDir: string,
  splitByDomain: boolean,
  language: 'ko' | 'en'
): Promise<void> {
  const isKo = language === 'ko';
  const lines: string[] = [];

  if (isKo) {
    lines.push('# API 규칙 저장소');
    lines.push('');
    lines.push('이 폴더는 AI 에이전트를 위한 API 호출 규칙들을 포함하고 있습니다.');
    lines.push('');
    lines.push('## 📄 주요 파일 안내');
    lines.push('- **[agent.md](./agent.md)**: AI 에이전트가 API를 구현할 때 따라야 할 상세 지침서');
    lines.push('- **[llms.txt](./llms.txt)**: LLM이 전체 API 구조를 빠르게 파악하기 위한 토큰 효율적 인덱스');
    lines.push('');
    lines.push('## 🔗 도메인별 규칙');
  } else {
    lines.push('# API Rules Repository');
    lines.push('');
    lines.push('This folder contains API call rules for AI agents.');
    lines.push('');
    lines.push('## 📄 Navigation');
    lines.push('- **[agent.md](./agent.md)**: Detailed instructions for AI agents on how to implement these APIs.');
    lines.push('- **[llms.txt](./llms.txt)**: Token-efficient index for LLMs to grasp the API structure quickly.');
    lines.push('');
    lines.push('## 🔗 API Rules by Domain');
  }

  if (splitByDomain) {
    if (isKo) {
      lines.push('모든 규칙은 도메인별 폴더에 분류되어 저장되어 있습니다.');
      lines.push('전체 API 목록과 파일 경로는 **[llms.txt](./llms.txt)**를 참조하세요.');
    } else {
      lines.push('All rules are categorized into domain-specific folders.');
      lines.push('Refer to **[llms.txt](./llms.txt)** for the full API list and file paths.');
    }
  } else {
    lines.push(isKo ? '모든 규칙 파일이 루트 폴더에 있습니다.' : 'All rule files are in the root folder.');
  }

  await writeFile(join(outputDir, 'README.md'), lines.join('\n'), 'utf-8');
}

/**
 * 상세 지시사항이 포함된 에이전트 가이드 (agent.md)
 */
async function generateAgentMd(
  outputs: RuleOutput[],
  outputDir: string,
  language: 'ko' | 'en'
): Promise<void> {
  const isKo = language === 'ko';
  const content = isKo ? `# AI 에이전트 API 구현 지침

> 당신은 이 폴더의 규칙 파일(.md)을 참조하여 API 클라이언트를 구현하는 에이전트입니다.

## 🛠️ 구현 원칙
1. **규칙 참조**: API를 호출하기 전에 반드시 해당 엔드포인트의 \`.md\` 파일을 읽으세요.
2. **파일명 규칙**: 파일은 \`kebab-case.md\` 형식을 따릅니다.
3. **타입 준수**: 백틱(\`)으로 강조된 타입명은 프로젝트에 정의된 실제 TypeScript 타입입니다.
4. **중첩 구조 처리**: 
   - JSON 구조 내의 객체가 어떤 타입인지 궁금하다면 섹션 하단의 **"중첩 타입"** 목록을 확인하세요.
   - 예: \`Pet\` 내부에 \`category\` 객체가 있고 중첩 타입에 \`Category\`가 있다면, \`category\` 속성은 \`Category\` 타입입니다.
5. **체크리스트**:
   - 필수 파라미터 유무 확인
   - Request Body/Response 스키마 타입 확인 및 Import
   - 비즈니스 규칙(선행 조건, 에러 처리) 준수
` : `# AI Agent API Implementation Instructions

> You are an agent implementing API clients by referencing the rule files (.md) in this folder.

## 🛠️ Implementation Principles
1. **Reference Rules**: Always read the corresponding \`.md\` file for an endpoint before implementing a call.
2. **Naming Convention**: Files follow the \`kebab-case.md\` format.
3. **Type Adherence**: Type names in backticks correspond to actual TypeScript types defined in the project.
4. **Handling Nested Structures**:
   - If you need to identify the type of a nested object in JSON, check the **"Nested Types"** list at the bottom of the section.
   - Example: If \`Pet\` contains a \`category\` object and \`Category\` is in the nested types list, then the \`category\` property is of type \`Category\`.
5. **Checklist**:
   - Verify required parameters.
   - Check and import Request Body/Response schema types.
   - Adhere to Business Rules (preconditions, error handling).
`;

  await writeFile(join(outputDir, 'agent.md'), content, 'utf-8');
}

/**
 * 스키마 내에서 사용된 모든 중첩된 스키마 이름을 재귀적으로 수집합니다.
 */
function collectNestedSchemaNames(schema: SimplifiedSchema, rootSchemaName?: string): string[] {
  const names = new Set<string>();

  function traverse(s: SimplifiedSchema) {
    if (s.schemaName && s.schemaName !== rootSchemaName) {
      names.add(s.schemaName);
    }
    if (s.properties) {
      for (const prop of Object.values(s.properties)) {
        traverse(prop);
      }
    }
    if (s.items) {
      traverse(s.items);
    }
  }

  traverse(schema);
  return Array.from(names).sort();
}

/**
 * LLM을 위한 토큰 효율적 인덱스 (llms.txt)
 */
async function generateLlmsTxt(
  outputs: RuleOutput[],
  outputDir: string,
  splitByDomain: boolean
): Promise<void> {
  const lines: string[] = [];
  lines.push('# API Rules Index');
  lines.push('');

  const byDomain = new Map<string, RuleOutput[]>();
  for (const output of outputs) {
    const domain = output.domain || 'default';
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(output);
  }

  for (const [domain, rules] of byDomain) {
    lines.push(`## ${domain}`);
    for (const rule of rules) {
      const kebabName = toKebabCase(rule.operationId);
      const filePath = splitByDomain ? `${domain}/${kebabName}.md` : `${kebabName}.md`;
      
      let entry = `- ${rule.method} ${rule.path} -> ${filePath}`;
      const types: string[] = [];
      if (rule.requestSchemaName) types.push(`req:${rule.requestSchemaName}`);
      if (rule.responseSchemaName) types.push(`res:${rule.responseSchemaName}`);
      
      if (types.length > 0) {
        entry += ` [${types.join(',')}]`;
      }
      lines.push(entry);
    }
    lines.push('');
  }

  await writeFile(join(outputDir, 'llms.txt'), lines.join('\n'), 'utf-8');
}
