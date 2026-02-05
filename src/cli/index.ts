#!/usr/bin/env node
/**
 * API-RuleSmith CLI
 */
import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadSpec, preprocess, extractEndpoints, generateRules } from '../core/index.js';
import type { RuleSmithConfig } from '../types/index.js';
import { defaultConfig } from '../types/config.js';

const program = new Command();

program
  .name('api-rulesmith')
  .description('Transform OpenAPI specs into AI agent-optimized rules')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate rule files from an OpenAPI specification')
  .requiredOption('-i, --input <path>', 'OpenAPI spec file path or URL')
  .requiredOption('-o, --output <dir>', 'Output directory for rule files')
  .option('--split-by-domain', 'Split rules by domain/tag (default: true)')
  .option('--no-split-by-domain', 'Do not split rules by domain/tag')
  .option('--language <lang>', 'Output language: ko or en (default: ko)', 'ko')
  .option('--include-examples', 'Include examples in output (default: true)')
  .option('--no-include-examples', 'Exclude examples from output')
  .option('--exclude-tags <tags>', 'Comma-separated list of tags to exclude')
  .option('--exclude-paths <patterns>', 'Comma-separated regex patterns to exclude')
  .option('-c, --config <path>', 'Path to config file (rulesmith.config.ts)')
  .action(async (options) => {
    try {
      let config: Partial<RuleSmithConfig> = { ...defaultConfig };
      
      // 설정 파일 로드
      if (options.config) {
        const configPath = resolve(options.config);
        if (existsSync(configPath)) {
          const configModule = await import(pathToFileURL(configPath).href);
          config = { ...config, ...configModule.default };
        }
      }
      
      // CLI 옵션으로 덮어쓰기
      config.input = options.input ?? config.input;
      config.output = options.output ?? config.output;
      config.splitByDomain = options.splitByDomain ?? config.splitByDomain;
      config.language = (options.language as 'ko' | 'en') ?? config.language;
      config.includeExamples = options.includeExamples ?? config.includeExamples;
      
      if (options.excludeTags) {
        config.excludeTags = options.excludeTags.split(',').map((t: string) => t.trim());
      }
      if (options.excludePaths) {
        config.excludePaths = options.excludePaths.split(',').map((p: string) => p.trim());
      }
      
      if (!config.input) {
        console.error('Error: --input is required');
        process.exit(1);
      }
      if (!config.output) {
        console.error('Error: --output is required');
        process.exit(1);
      }
      
      const outDir = resolve(config.output);
      
      // 출력 디렉토리 초기화 (기존 내용 삭제)
      if (existsSync(outDir)) {
        await rm(outDir, { recursive: true, force: true });
      }
      
      console.log('📖 Loading OpenAPI specification...');
      const spec = await loadSpec({ source: config.input });
      
      // 원본 명세 복사 ($ref 정보 보존용) - preprocess가 원본을 mutate함
      const originalSpec = structuredClone(spec);
      
      console.log('🔧 Preprocessing specification...');
      const processed = await preprocess(spec);
      
      console.log('📊 Extracting endpoints...');
      const endpoints = extractEndpoints(processed, {
        excludeTags: config.excludeTags,
        excludePaths: config.excludePaths,
        originalSpec,
      });
      
      console.log(`  Found ${endpoints.length} endpoints`);
      
      console.log('📝 Generating rule files...');
      const outputs = await generateRules(endpoints, {
        outputDir: outDir,
        splitByDomain: config.splitByDomain,
        includeExamples: config.includeExamples,
        language: config.language,
        businessRules: config.businessRules,
      });
      
      console.log('');
      console.log('✅ Done! Generated files:');
      console.log(`  📁 ${resolve(config.output)}`);
      console.log(`  📄 ${outputs.length} rule files`);
      console.log(`  📑 1 README.md (Guide & Index)`);
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate an OpenAPI specification')
  .argument('<path>', 'OpenAPI spec file path or URL')
  .action(async (path) => {
    try {
      console.log('🔍 Validating OpenAPI specification...');
      const spec = await loadSpec({ source: path });
      await preprocess(spec);
      console.log('✅ Valid OpenAPI specification');
    } catch (error) {
      console.error('❌ Invalid:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
