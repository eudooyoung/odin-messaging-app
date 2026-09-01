# Backend AGENTS.md

이 파일은 `backend/` 하위 작업에 적용되는 백엔드 전용 규칙만 정의한다.
공통 작업 방식, TDD 진행 규칙, 변경 범위 관리 등은 루트 `AGENTS.md`를 따른다.

## 1. API 계층 구조

기본 흐름:

```text
route
→ validation middleware
→ controller
→ service
→ repository
→ Prisma
```

각 계층의 책임을 섞지 않는다.

### routes

- HTTP method와 path를 선언한다.
- 필요한 middleware와 controller를 연결한다.
- validation, business logic, Prisma query를 직접 작성하지 않는다.

### schemas

- Zod schema로 외부 입력의 runtime validation을 정의한다.
- 허용할 필드가 확정된 요청은 기본적으로 `z.object()`를 사용한다.
- 문자열 trim 여부는 필드 의미에 따라 명시적으로 결정한다.
- password는 임의로 trim하지 않는다.

### validation middleware

- Zod schema로 request data를 검증한다.
- 실패 시 적절한 `CustomError` 하위 에러를 `next(error)`로 전달한다.
- 성공 시 검증/변환된 데이터만 다음 계층으로 전달한다.
- controller에서 같은 validation을 반복하지 않는다.

기본 패턴:

```text
safeParse(req.body)
→ 실패: next(new BadRequestError(...))
→ 성공: req.body = result.data
→ next()
```

### controllers

- Express `Request` / `Response` 경계를 담당한다.
- request data를 읽고 service를 호출한다.
- 성공 status와 response body를 만든다.
- business rule, password hashing, Prisma query를 넣지 않는다.
- service error를 불필요하게 catch하지 않고 Express 5의 async error flow를 따른다.

### services

- 비즈니스 규칙을 담당한다.
- password hashing, 권한 판단, 중복/상태 판단 등 애플리케이션 의미가 있는 로직을 둔다.
- Prisma/infrastructure error를 현재 문맥의 애플리케이션 에러로 해석해야 할 경우 service에서 변환한다.
- Express `Request`, `Response`, `NextFunction`에 의존하지 않는다.

예:

```text
Prisma P2002
→ 현재 service 문맥에서 username unique 충돌로 해석
→ ConflictError로 변환
```

모든 `P2002`를 무조건 같은 비즈니스 에러로 처리하지 않는다.

### repositories

- Prisma query만 담당한다.
- HTTP status, Express type, business rule을 알지 않는다.

## 2. 에러 처리

기본 흐름:

```text
validation middleware → next(error)
service               → throw error
                       ↓
Express 5 error flow
→ global error handler
→ HTTP error response
```

- 예상 가능한 애플리케이션 에러는 `CustomError` 하위 클래스를 사용한다.
- 에러 클래스는 파일당 하나를 두고 `default export`한다.
- middleware/service에서 직접 error response를 만들지 않는다.
- global error handler가 `CustomError`의 `statusCode`, `message`, `code`를 사용해 응답한다.
- 예상하지 못한 에러를 임의로 특정 HTTP status로 변환하지 않는다.

현재 사용하는 예:

- `BadRequestError` → 400
- `ConflictError` → 409

## 3. 타입 규칙

### API 타입

- HTTP request/response shape는 `api.types.ts`에 둔다.
- 테스트 파일에서 API request/response shape를 복제한 로컬 타입을 새로 정의하지 않는다.
- production 코드와 테스트는 `api.types.ts`의 타입을 재사용한다.
- 동일한 의미와 shape의 타입이 이미 있으면 새 타입을 만들지 않는다.

예:

```text
RegisterInput
RegisterResponseBody
UserProfileResponseBody
```

### Handler 타입

Express `RequestHandler` generic alias는 `handler.types.ts`에 둔다.

예:

```text
RegisterHandler
```

### Service / Repository 타입

- 계층마다 기계적으로 새 타입을 만들지 않는다.
- 기존 타입과 의미와 shape가 같으면 재사용한다.
- 의미나 shape가 실제로 달라질 때만 별도 타입을 만든다.
- 테스트 mock의 타입을 위해 production shape를 로컬 타입으로 복제하지 않는다.
- 가능하면 실제 함수 타입(`typeof`), `ReturnType`, `Awaited` 등 기존 타입 정보에서 mock 타입을 파생한다.

예:

```text
RegisterInput
  password
      ↓ hashing
CreateUserData
  passwordHash
```

### Strict typing

- `any`를 추가해 lint/type error를 숨기지 않는다.
- 외부 라이브러리 경계에서 들어오는 `any`는 helper나 명시적 narrowing으로 처리한다.
- type-aware ESLint 규칙을 우회하지 않는다.

## 4. 테스트 / DB 전용 규칙

- API 동작은 endpoint 관점의 integration test를 우선한다.
- 비즈니스 로직이 있는 service는 endpoint integration test와 별도로 unit test를 작성한다.
- service unit test에서는 repository 등 외부 의존성을 mock한다.
- unit test는 실제 DB 연결이나 cleanup에 의존하지 않는다.
- DB integration test는 test DB만 사용한다.
- DB cleanup hook은 전역 `setupFiles`에 두지 않고 DB가 필요한 integration test에서 `integration.setup.ts`를 명시적으로 import한다.
- 테스트 간 DB 상태가 영향을 주지 않도록 cleanup을 유지한다.
- 현재 cleanup 순서: `Message → Conversation → User`
- integration test에서 사전 User가 필요하면 다른 endpoint를 호출하지 않고 기존 `createTestUser` helper를 우선 사용한다. 단, 테스트 대상 endpoint 자체는 직접 호출한다.
- test seed는 두지 않는다. 각 integration test가 필요한 데이터를 직접 준비한다.
- `vitest.config.ts`에서 test 실행 시 `DATABASE_URL`은 `TEST_DATABASE_URL`을 사용한다.
- DB integration test 안정성을 위해 `fileParallelism: false`를 유지한다.
- Supertest `response.body`는 직접 unsafe하게 사용하지 않고 기존 `getBody<T>()` 패턴을 따른다.

테스트 환경 구성 시 다음 연결 상태를 먼저 확인한다.

- `vitest.config.ts`
- TypeScript `types` / `include`
- path alias
- integration setup
- test DB / migration
- cleanup / fixture helper

## 5. Prisma / DB

- Prisma schema, migration, generated client, 실제 DB 상태를 구분해서 확인한다.
- dev DB, test DB, production DB를 혼동하지 않는다.
- `src/generated/`는 직접 수정하지 않는다.

## 6. TypeScript / ESM

- TypeScript + ESM 구조를 유지한다.
- 기존 path alias/import 규칙을 따른다.
- user-written alias import는 현재 프로젝트의 extension 규칙을 따른다.
- `dist/`는 직접 수정하지 않는다.
- VS Code에서 `error typed`나 alias/import 오류가 코드 상태와 맞지 않게 나타나면 실제 타입 오류를 먼저 확인한 뒤 TS Server restart / window reload 가능성을 점검한다.

## 7. Register 구현에서 확정된 현재 패턴

`POST /auth/register` validation 정책:

- `username`: trim, 1~30자
- `password`: 12~128자, trim하지 않음
- `displayName`: trim, 1~50자
- validation failure → 400
- duplicate username → 409

새 API는 이 코드를 기계적으로 복사하지 않는다.
기능 요구사항에 맞춰 같은 책임 분리 원칙을 적용한다.
