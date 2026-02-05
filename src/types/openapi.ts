/**
 * OpenAPI 관련 타입 정의
 */
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

export type OpenAPISpec = OpenAPIV3.Document | OpenAPIV3_1.Document;
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

export interface ParameterInfo {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description?: string;
  example?: unknown;
}

export interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: SimplifiedSchema;
  schemaName?: string;
  example?: unknown;
}

export interface ResponseInfo {
  statusCode: string;
  description: string;
  schema?: SimplifiedSchema;
  schemaName?: string;
  example?: unknown;
}

export interface SimplifiedSchema {
  type: string;
  schemaName?: string;
  properties?: Record<string, SimplifiedSchema>;
  items?: SimplifiedSchema;
  required?: string[];
  enum?: string[];
  description?: string;
  example?: unknown;
}

export interface EndpointInfo {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParameterInfo[];
  requestBody?: RequestBodyInfo;
  responses: ResponseInfo[];
}
