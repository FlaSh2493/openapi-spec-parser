# [Rule: createPet]

## 🎯 목적
- Create a new pet

## 🔗 인터페이스
- **Method**: `POST`
- **URL**: `/pets`

## 📦 데이터 가이드
### Request Body (`Cat`)
- **Content-Type**: `application/json`
- **필수**: Yes
- **중첩 타입**: `Owner`

```json
{
  "id": 0,
  "name": "string",
  "owner": {
    "name": "string",
    "email": "string"
  },
  "huntingSkill": "clueless | lazy | adventurous | lethal"
}
```

### Response (200) - `PetResponse`
- Successful response
- **중첩 타입**: `Cat`, `Owner`

```json
{
  "pet": {
    "id": 0,
    "name": "string",
    "owner": {
      "name": "string",
      "email": "string"
    },
    "huntingSkill": "clueless | lazy | adventurous | lethal"
  },
  "status": "string"
}
```
