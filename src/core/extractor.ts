/**
 * OpenAPI 엔드포인트 추출기
 * 각 API 엔드포인트에서 에이전트에게 필요한 정보만 추출합니다.
 */
import type { OpenAPIV3 } from 'openapi-types';
import type {
  OpenAPISpec,
  EndpointInfo,
  HttpMethod,
  ParameterInfo,
  RequestBodyInfo,
  ResponseInfo,
  SimplifiedSchema,
} from '../types/index.js';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

export interface ExtractorOptions {
  /** 제외할 태그 목록 */
  excludeTags?: string[];
  /** 제외할 경로 패턴 (정규식 문자열) */
  excludePaths?: string[];
  /** deprecated 엔드포인트 제외 */
  excludeDeprecated?: boolean;
  /** $ref 정보 추출을 위한 원본 명세 (dereference 전) */
  originalSpec?: OpenAPISpec;
}

/**
 * OpenAPI 명세에서 모든 엔드포인트 정보를 추출합니다.
 */
export function extractEndpoints(
  spec: OpenAPISpec,
  options: ExtractorOptions = {}
): EndpointInfo[] {
  const { excludeTags = [], excludePaths = [], excludeDeprecated = true, originalSpec } = options;
  const endpoints: EndpointInfo[] = [];
  
  const excludePathRegexes = excludePaths.map((p) => new RegExp(p));
  
  const paths = spec.paths ?? {};
  const originalPaths = originalSpec?.paths ?? {};
  
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    
    // 경로 패턴 제외 체크
    if (excludePathRegexes.some((regex) => regex.test(path))) {
      continue;
    }
    
    const originalPathItem = originalPaths[path];
    
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject | undefined;
      if (!operation) continue;
      
      // deprecated 제외
      if (excludeDeprecated && operation.deprecated) {
        continue;
      }
      
      // 태그 제외 체크
      const tags = operation.tags ?? ['default'];
      if (tags.some((tag: string) => excludeTags.includes(tag))) {
        continue;
      }
      
      // 원본 operation에서 $ref 정보 추출
      const originalOperation = (originalPathItem as any)?.[method] as OpenAPIV3.OperationObject | undefined;
      
      const endpoint = extractEndpoint(path, method, operation, pathItem, originalOperation, originalSpec);
      endpoints.push(endpoint);
    }
  }
  
  return endpoints;
}

function extractEndpoint(
  path: string,
  method: HttpMethod,
  operation: OpenAPIV3.OperationObject,
  pathItem: OpenAPIV3.PathItemObject,
  originalOperation?: OpenAPIV3.OperationObject,
  originalSpec?: OpenAPISpec
): EndpointInfo {
  const operationId = operation.operationId ?? generateOperationId(method, path);
  
  // 1. 파라미터 추출
  const { parameters, bodyParam } = extractAllParameters(operation, pathItem);
  
  // 2. Request Body 추출
  const requestBody = extractEndpointRequestBody(operation, bodyParam, originalOperation, originalSpec);
  
  // 3. Response 추출
  const responses = extractEndpointResponses(operation, originalOperation, originalSpec);
  
  return {
    operationId,
    method,
    path,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags ?? ['default'],
    parameters,
    requestBody,
    responses,
  };
}

/**
 * 모든 파라미터(Path, Query 등)를 추출하고 Swagger 2.0용 Body 파라미터를 식별합니다.
 */
function extractAllParameters(
  operation: OpenAPIV3.OperationObject, 
  pathItem: OpenAPIV3.PathItemObject
): { parameters: ParameterInfo[]; bodyParam?: any } {
  const pathParams = (pathItem.parameters ?? []) as OpenAPIV3.ParameterObject[];
  const opParams = (operation.parameters ?? []) as OpenAPIV3.ParameterObject[];
  const allParams = [...pathParams, ...opParams];
  
  const bodyParam = allParams.find((p) => (p as { in: string }).in === 'body');
  const nonBodyParams = allParams.filter((p) => (p as { in: string }).in !== 'body');
  
  return {
    parameters: nonBodyParams.map(extractParameter),
    bodyParam
  };
}

/**
 * 엔드포인트의 Request Body 정보를 추출합니다 (OAI 3.x / Swagger 2.0 지원).
 */
function extractEndpointRequestBody(
  operation: OpenAPIV3.OperationObject,
  bodyParam?: any,
  originalOperation?: OpenAPIV3.OperationObject,
  originalSpec?: OpenAPISpec
): RequestBodyInfo | undefined {
  let originalRequestBody = originalOperation?.requestBody as any;
  if (originalRequestBody?.$ref) {
    originalRequestBody = resolveRef(originalRequestBody, originalSpec);
  }
  
  const originalBodyParam = (originalOperation?.parameters as OpenAPIV3.ParameterObject[] | undefined)
    ?.find((p) => (p as { in: string }).in === 'body');

  if (operation.requestBody) {
    return extractRequestBody(operation.requestBody as OpenAPIV3.RequestBodyObject, originalRequestBody, originalSpec);
  } else if (bodyParam) {
    return extractSwagger2BodyParam(bodyParam, originalBodyParam, originalSpec);
  }
  return undefined;
}

/**
 * 엔드포인트의 응답 정보를 추출합니다.
 */
function extractEndpointResponses(
  operation: OpenAPIV3.OperationObject,
  originalOperation?: OpenAPIV3.OperationObject,
  originalSpec?: OpenAPISpec
): ResponseInfo[] {
  let originalResponses = originalOperation?.responses as any;
  if (originalResponses?.$ref) {
    originalResponses = resolveRef(originalResponses, originalSpec);
  }
  return extractResponses(
    operation.responses as OpenAPIV3.ResponsesObject,
    originalResponses,
    originalSpec
  );
}

function generateOperationId(method: HttpMethod, path: string): string {
  // /api/v1/users/{id} -> GET_API_V1_USERS_ID
  const cleanPath = path
    .replace(/[{}]/g, '')
    .replace(/\//g, '_')
    .replace(/^_/, '')
    .toUpperCase();
  return `${method.toUpperCase()}_${cleanPath}`;
}

function extractParameter(param: OpenAPIV3.ParameterObject): ParameterInfo {
  const schema = param.schema as OpenAPIV3.SchemaObject | undefined;
  
  return {
    name: param.name,
    in: param.in as ParameterInfo['in'],
    required: param.required ?? false,
    type: getSchemaType(schema),
    description: param.description,
    example: param.example ?? schema?.example,
  };
}

/**
 * Swagger 2.0의 body 파라미터를 RequestBodyInfo로 변환합니다.
 */
function extractSwagger2BodyParam(
  bodyParam: OpenAPIV3.ParameterObject & { schema?: unknown },
  originalBodyParam?: OpenAPIV3.ParameterObject & { schema?: unknown },
  originalSpec?: OpenAPISpec
): RequestBodyInfo | undefined {
  const rawSchema = bodyParam.schema as OpenAPIV3.SchemaObject & { $ref?: string } | undefined;
  if (!rawSchema) return undefined;
  
  // 원본에서 $ref 추출
  const originalSchema = originalBodyParam?.schema as { $ref?: string; type?: string; items?: unknown } | undefined;
  const schemaName = extractSchemaName(originalSchema) ?? extractSchemaName(rawSchema);
  
  return {
    required: bodyParam.required ?? false,
    contentType: 'application/json',
    schema: simplifySchema(rawSchema, originalSchema, schemaName, originalSpec),
    schemaName,
    example: rawSchema?.example,
  };
}

function extractRequestBody(
  body: OpenAPIV3.RequestBodyObject,
  originalBody?: OpenAPIV3.RequestBodyObject,
  originalSpec?: OpenAPISpec
): RequestBodyInfo | undefined {
  const content = body.content;
  if (!content) return undefined;
  
  // application/json 우선, 없으면 첫 번째 content-type 사용
  const contentType = content['application/json']
    ? 'application/json'
    : Object.keys(content)[0];
  
  if (!contentType) return undefined;
  
  const mediaType = content[contentType];
  const rawSchema = mediaType?.schema as OpenAPIV3.SchemaObject & { $ref?: string } | undefined;
  
  // 원본에서 $ref 추출
  const originalMediaType = originalBody?.content?.[contentType];
  const originalSchema = originalMediaType?.schema as { $ref?: string; type?: string; items?: unknown } | undefined;
  const schemaName = extractSchemaName(originalSchema) ?? extractSchemaName(rawSchema);
  
  return {
    required: body.required ?? false,
    contentType,
    schema: simplifySchema(rawSchema, originalSchema, schemaName, originalSpec),
    schemaName,
    example: mediaType?.example ?? rawSchema?.example,
  };
}

function extractResponses(
  responses: OpenAPIV3.ResponsesObject,
  originalResponses?: OpenAPIV3.ResponsesObject,
  originalSpec?: OpenAPISpec
): ResponseInfo[] {
  const result: ResponseInfo[] = [];
  
  // 성공 응답(2xx)과 주요 에러(4xx)만 추출
  const importantCodes = ['200', '201', '204', '400', '401', '403', '404', '500'];
  
  for (const statusCode of importantCodes) {
    const response = responses[statusCode] as OpenAPIV3.ResponseObject & { schema?: unknown } | undefined;
    if (!response) continue;
    
    // OpenAPI 3.x: response.content['application/json'].schema
    // Swagger 2.0: response.schema (직접)
    const content = response.content?.['application/json'];
    const rawSchema = (content?.schema ?? response.schema) as OpenAPIV3.SchemaObject & { $ref?: string } | undefined;
    
    // 원본에서 $ref 추출 (Swagger 2.0과 OpenAPI 3.x 모두 지원)
    const originalResponse = originalResponses?.[statusCode] as OpenAPIV3.ResponseObject & { schema?: unknown } | undefined;
    const originalContent = originalResponse?.content?.['application/json'];
    const originalSchema = (originalContent?.schema ?? originalResponse?.schema) as { $ref?: string; type?: string; items?: unknown } | undefined;
    const schemaName = extractSchemaName(originalSchema) ?? extractSchemaName(rawSchema);
    
    result.push({
      statusCode,
      description: response.description ?? '',
      schema: rawSchema ? simplifySchema(rawSchema, originalSchema, schemaName, originalSpec) : undefined,
      schemaName,
      example: content?.example ?? rawSchema?.example,
    });
  }
  
  return result;
}

/**
 * $ref에서 스키마 이름을 추출합니다.
 */
function extractSchemaName(schema?: any): string | undefined {
  if (!schema) return undefined;
  
  // 1. 직접적인 $ref가 있는 경우
  if (schema.$ref && typeof schema.$ref === 'string') {
    const parts = schema.$ref.split('/');
    return parts[parts.length - 1];
  }
  
  // 2. allOf, anyOf, oneOf 내부에 $ref가 있는 경우
  const composites = ['allOf', 'anyOf', 'oneOf'];
  for (const key of composites) {
    if (Array.isArray(schema[key])) {
      for (const item of schema[key]) {
        const found = extractSchemaName(item);
        if (found) return found;
      }
    }
  }
  
  // 3. 배열인 경우 items 확인
  if (schema.type === 'array' && schema.items) {
    const itemName = extractSchemaName(schema.items);
    if (itemName) return itemName.endsWith('[]') ? itemName : `${itemName}[]`;
  }
  
  return undefined;
}

function getSchemaType(schema?: OpenAPIV3.SchemaObject): string {
  if (!schema) return 'unknown';
  
  if (schema.type === 'array' && schema.items) {
    const itemType = getSchemaType(schema.items as OpenAPIV3.SchemaObject);
    return `${itemType}[]`;
  }
  
  if (schema.enum) {
    return schema.enum.map((v: any) => JSON.stringify(v)).join(' | ');
  }
  
  return schema.type ?? 'object';
}

/**
 * JSON Pointer를 참조하여 실제 객체를 찾습니다. (원본 명세용)
 */
function resolveRef(schema: any, spec: OpenAPISpec | undefined): any {
  if (!schema || !spec || typeof schema.$ref !== 'string') return schema;
  
  const ref = schema.$ref;
  if (!ref.startsWith('#/')) return schema;

  const parts = ref.split('/').slice(1);
  let current: any = spec;
  
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = current[part === 'definitions' ? 'definitions' : part];
    } else {
      return schema;
    }
  }
  
  // 재귀적 해결 (Alias 지원)
  return current ? resolveRef(current, spec) : schema;
}

/**
 * allOf을 포함한 스키마에서 유효한 프로퍼티와 정보를 추출합니다.
 */
function getEffectiveSchema(schema: any, spec?: OpenAPISpec): any {
  if (!schema) return {};
  
  const resolved = resolveRef(schema, spec);
  const result: any = { 
    properties: { ...(resolved.properties || {}) },
    type: resolved.type,
    enum: resolved.enum,
    items: resolved.items,
    required: resolved.required ? [...resolved.required] : []
  };

  if (Array.isArray(resolved.allOf)) {
    for (const sub of resolved.allOf) {
      const subEffective = getEffectiveSchema(sub, spec);
      result.properties = { ...result.properties, ...(subEffective.properties || {}) };
      if (!result.type && subEffective.type) result.type = subEffective.type;
      if (!result.enum && subEffective.enum) result.enum = subEffective.enum;
      if (!result.items && subEffective.items) result.items = subEffective.items;
      if (subEffective.required) {
        result.required = Array.from(new Set([...result.required, ...subEffective.required]));
      }
    }
  }

  return result;
}

/**
 * 스키마를 단순화된 형태로 변환하며, 재귀적으로 중첩된 스키마 이름을 수집합니다.
 */
function simplifySchema(
  schema?: any,
  originalSchema?: any,
  schemaName?: string,
  originalSpec?: OpenAPISpec
): SimplifiedSchema {
  if (!schema) {
    return { type: 'unknown' };
  }

  // 1. 메타데이터 결정 (이름, 설명 등)
  const resolvedName = schemaName ?? extractSchemaName(originalSchema) ?? extractSchemaName(schema);
  const description = schema.description ?? originalSchema?.description;
  const example = schema.example ?? originalSchema?.example;

  // 2. 유효 스키마 정보 추출 (allOf 병합 등 처리)
  const effective = getEffectiveSchema(schema, originalSpec);
  const effectiveOriginal = originalSchema ? getEffectiveSchema(originalSchema, originalSpec) : undefined;

  // 3. 기본 정보 구성
  const type = effective.type || (Object.keys(effective.properties || {}).length > 0 ? 'object' : 'unknown');
  const simplified: SimplifiedSchema = {
    type,
    schemaName: resolvedName,
    description,
    example,
    enum: effective.enum,
    required: effective.required
  };

  // 4. 객체 프로퍼티 처리
  if (effective.properties) {
    simplified.properties = {};
    for (const [key, prop] of Object.entries(effective.properties)) {
      const originalProp = effectiveOriginal?.properties?.[key];
      const propName = extractSchemaName(originalProp) ?? extractSchemaName(prop);
      simplified.properties[key] = simplifySchema(prop, originalProp, propName, originalSpec);
    }
  }

  // 5. 배열 아이템 처리
  if (type.includes('array') && (effective.items || schema.items)) {
    const items = effective.items || schema.items;
    const originalItems = effectiveOriginal?.items || (originalSchema as any)?.items;
    const itemName = extractSchemaName(originalItems) ?? extractSchemaName(items);
    simplified.items = simplifySchema(items, originalItems, itemName, originalSpec);
  }

  return simplified;
}
