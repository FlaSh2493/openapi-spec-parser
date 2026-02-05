# openapi-spec-parser

OpenAPI 명세를 AI 에이전트 최적화 규칙으로 변환하는 도구입니다.

## 특징

- 🔍 **Smart Parsing**: `$ref` 자동 치환 및 스키마 평탄화
- 📜 **Agent-Optimized Rules**: 에이전트가 읽기 쉬운 Markdown 규칙 파일 생성
- 🗂️ **Domain Fragmentation**: 태그별 폴더 분리로 `@` 컨텍스트 참조 최적화

## 설치

```bash
npm install openapi-spec-parser
```

## 사용법

### CLI

```bash
# 기본 사용법
npx openapi-parse generate -i ./openapi.json -o ./rules

# URL에서 로드
npx openapi-parse generate -i https://petstore.swagger.io/v2/swagger.json -o ./rules

# 옵션
npx openapi-parse generate \
  --input ./openapi.json \
  --output ./rules \
  --language ko \
  --split-by-domain
```

## 📁 출력 구조

생성된 폴더는 다음과 같은 구조를 가집니다:

```text
output/
├── DomainA/                # 태그(도메인)별 폴더
│   ├── operation-id-1.md   # 개별 API 규칙 파일
│   └── operation-id-2.md
├── README.md               # 인간을 위한 가이드 및 도메인 안내
├── agent.md                # AI 에이전트를 위한 구현 지침
└── llms.txt                # LLM을 위한 토큰 효율적 API 인덱스
```

## 📄 규칙 파일 형식 (.md)

각 API 규칙 파일은 에이전트가 코드를 즉시 작성할 수 있도록 정밀하게 구성됩니다:

### [Rule: createPet]

#### 🎯 목적

- Create a new pet

#### 🔗 인터페이스

- **Method**: `POST`
- **URL**: `/pets`

#### 📦 데이터 가이드

- **Request Body (`Cat`)**: 중첩 타입 `Owner` 포함
- **Response (200) (`PetResponse`)**: 중첩 타입 `Cat`, `Owner` 포함

```json
{
  "pet": {
    "id": 0,
    "name": "string",
    "owner": { "name": "string", "email": "string" },
    "huntingSkill": "clueless | lazy | adventurous | lethal"
  },
  "status": "string"
}
```

## 라이선스

MIT
