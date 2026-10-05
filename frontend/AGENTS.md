# Frontend AGENTS.md

이 파일은 `frontend/` 하위 작업에 적용되는 프론트엔드 전용 규칙만 정의한다.
공통 작업 방식, TDD 진행, 테스트 일반 원칙, 변경 범위 관리는 루트 `AGENTS.md`를 따른다.

## 1. 기술 스택

- React
- Vite
- TypeScript + ESM
- React Router
- TanStack Query
- native WebSocket API
- React Hook Form
- Zod
- Tailwind CSS
- Vitest
- React Testing Library
- `@testing-library/user-event`

현재 설치된 패키지 버전을 기준으로 API를 사용한다.
deprecated API는 사용하지 않는다.

---

## 2. 디렉터리 구조

프론트엔드는 feature 중심 구조를 사용한다.

```text
src/
├── features/
│   ├── auth/
│   ├── users/
│   ├── conversations/
│   └── messages/
├── components/
├── api/
└── routes/
```

- 각 feature에는 해당 기능의 컴포넌트, hook, schema, query 등 기능 전용 코드를 둔다.
- feature 내부 파일과 하위 디렉터리는 실제로 필요해질 때만 추가한다.
- `components/`에는 여러 feature에서 실제로 공유하는 컴포넌트만 둔다.
- 단일 feature에서만 사용하는 컴포넌트는 해당 feature에 둔다.
- `api/`에는 공통 HTTP client 같은 전역 API 인프라만 둔다.
- feature별 요청은 해당 feature에 둔다.
- `routes/`는 route 정의와 인증 접근 제어를 포함한 라우팅 구성을 담당한다.
- 불필요한 컴포넌트/폴더 추상화를 만들지 않는다.

---

## 3. 기능 단위 TDD / audit

새 frontend 기능을 시작할 때 구현 전에 실제로 발생 가능한 주요 상태를 먼저 식별한다.

- 성공 경로를 먼저 RED → GREEN으로 진행한다.
- 성공 경로 완료 후 바로 다음 기능으로 넘어가지 않는다.
- 필요에 따라 pending/loading, empty, 예상 가능한 실패, 예상하지 못한 error, cancellation을 검토한다.
- query/mutation 단위를 시작했으면 그 단위의 주요 계약을 먼저 마친 뒤 UI로 넘어간다.
- 모든 기능에 모든 상태를 기계적으로 추가하지 않는다.

Frontend audit에서는 특히 다음을 확인한다.

- query / mutation / UI의 주요 상태 누락 여부
- router / page 연결과 실제 사용자 흐름
- TanStack Query cache와 lifecycle
- WebSocket 실시간 상태와 REST 서버 상태의 경계
- query/mutation 단위 테스트와 component/router 테스트 사이의 중복 검증

---

## 4. Frontend 테스트 규칙

루트의 공통 테스트 원칙에 더해 다음을 적용한다.

### Query / mutation 테스트

- query/mutation 자체가 책임지는 계약을 직접 검증한다.
- 실제 분기에 따라 success, 의미 있는 HTTP 오류 해석, transport error passthrough, pagination/pageParam, cancellation/signal 전달 등을 확인한다.
- TanStack Query queryFn이 제공하는 `signal`은 요청 취소가 유의미한 query에서 HTTP 계층에 전달한다.
- `signal`, endpoint path, endpoint별 status 해석처럼 query/mutation 자체의 책임은 해당 단위 테스트에서 검증한다.

### Component / route 테스트

- 사용자에게 보이는 결과와 route/component 수준의 상태 전이를 중심으로 검증한다.
- 하위 query/mutation 또는 공통 HTTP client가 이미 보장하는 transport 세부사항을 상위 테스트에서 반복 검증하지 않는다.
- 단순히 하위 구현을 확인하기 위한 `apiFetch` 호출 옵션, listener 등록 방식 같은 assertion을 추가하지 않는다.

### 비동기 / lifecycle 테스트

- React 상태 갱신을 기다릴 때 필요한 범위에서 `waitFor`와 `act`를 사용한다.
- race/retry 테스트에서는 동작 순서가 읽히도록 필요한 시점 검증을 유지한다.
- Act와 Assert가 여러 번 교차하는 시나리오는 짧은 단계 주석을 사용할 수 있다.
- 호출 횟수는 순서/중복 요청 방지/retry 정책처럼 그 횟수 자체가 계약일 때만 검증한다.

### Test helper / stub

- fixture와 helper는 반복을 줄이되 테스트에서 중요한 값과 상태 차이를 숨기지 않는다.
- Response 생성 같은 반복 boilerplate는 작은 test helper로 줄일 수 있다.
- TanStack Query `mutationFn` mock은 라이브러리 context 인자를 추가로 받을 수 있다. 테스트 계약이 variables 인자만이라면 전체 호출 인자를 고정하지 말고 호출 횟수를 먼저 보장한 뒤 필요한 인자만 검증한다.
- 호출 횟수를 먼저 보장한 경우 `mock.calls[0]?.[0]`처럼 optional chaining으로 호출 부재를 숨기지 않는다. 필요한 호출이 존재함을 명시적으로 보장한 뒤 해당 호출의 필요한 인자만 구조분해해 검증한다.
- 테스트 파일에서 대부분의 테스트가 하나의 `QueryClient`를 생성하고 마지막에 `clear()`하는 패턴을 반복하면, 파일 단위 `beforeEach`에서 새 client를 생성하고 `afterEach`에서 `clear()`하는 lifecycle로 통합한다.
- 여러 `QueryClient`가 필요하거나 특정 옵션/생성 시점/instance identity가 테스트 의미에 중요하거나 `clear()` 자체가 assertion 시나리오의 일부인 경우에는 local lifecycle을 유지한다.
- WebSocket 등 test stub은 현재 테스트가 사용하는 API만 구현한다.
- 테스트가 listener 등록 방식 자체를 검증하지 않는다면 stub의 `addEventListener`/`removeEventListener`를 불필요하게 spy로 만들지 않는다.
- 테스트에서는 가능하면 stub의 `emitOpen`, `emitMessage`, `emitClose`처럼 행동 중심 API를 통해 이벤트를 발생시킨다.

---

## 5. 앱 전역 구조와 인증 상태

- 앱 진입점에서 `QueryClientProvider`가 `RouterProvider`를 감싼다.
- 인증 상태의 source of truth는 `GET /auth/me` 응답이다.
- 현재 로그인 사용자는 TanStack Query의 `["auth", "me"]` query로 관리한다.
- 인증 상태를 위한 별도의 `AuthContext`는 만들지 않는다.

---

## 6. HTTP와 인증

- HTTP 요청에는 공통 `apiFetch`를 사용한다.
- `apiFetch`는 credentials, refresh/retry 같은 공통 HTTP 전송만 담당한다.
- endpoint별 status 의미는 feature의 query/mutation 함수가 해석한다.
- 실패 응답은 TanStack Query가 error 상태로 관리할 수 있도록 throw한다.
- 컴포넌트는 가능한 한 raw `Response.status`를 직접 확인하지 않는다.
- `auth/me`의 `401 → null`처럼 feature에서 정상 상태로 의미가 정해진 예외는 명시적으로 변환할 수 있다.
- 구체적인 error class나 공통 추상화는 실제로 여러 feature에서 필요해질 때 도입한다.
- 모든 인증 관련 요청에는 `credentials: "include"`를 설정한다.
- 일반 요청이 `401`을 반환하면 `POST /auth/refresh`를 시도한다.
- refresh가 성공하면 원래 요청을 한 번만 재시도한다.
- refresh 요청 자체가 실패한 경우 다시 refresh하지 않는다.
- `GET /auth/me`의 `401`도 refresh 대상이다.
- access token과 refresh token은 HttpOnly cookie에 있으므로 frontend에서 직접 저장하거나 읽지 않는다.

---

## 7. 라우팅과 접근 제어

- guest-only route는 `/login`, `/register`이다.
- protected route는 `/`, `/conversations/:conversationId`, `/profile`이다.
- protected route는 `ProtectedRoute`, guest-only route는 `GuestOnlyRoute`로 접근을 제어한다.
- 두 route guard 모두 인증 query가 확인 중일 때 loading 상태를 처리한다.

---

## 8. TanStack Query cache

- query 요청처럼 취소가 유의미한 fetch에서는 queryFn의 `signal`을 HTTP 요청에 전달한다.
- 별도의 `AbortController`를 직접 생성하기보다 라이브러리가 제공하는 signal을 우선한다.
- 로그인 성공 후 `["auth", "me"]`를 다시 조회하여 실제 로그인 사용자 상태를 얻는다.
- `POST /auth/login`은 `204`이므로 로그인 응답에 사용자 정보가 있다고 가정하지 않는다.
- 로그아웃 후에는 이전 사용자의 conversation/message 데이터가 남지 않도록 query cache를 비운다.
- WebSocket 이벤트를 TanStack Query cache에 반영할 때 기존 query key와 pagination 구조를 존중한다.

---

## 9. UI / 접근성

- semantic HTML과 접근성을 유지한다.
- 사용자에게 보이는 loading, empty, error 상태를 실제 기능 요구사항에 맞게 처리한다.
- CSS/Tailwind 시각 스타일 자체는 TDD 대상으로 보지 않는다. interaction, validation, submit payload, 접근성 semantics처럼 observable behavior가 바뀌면 기존 TDD 흐름을 적용한다.
- 동일한 간격 목적이면 `space-x-*` / `space-y-*`보다 일반 CSS `gap`과 직접 대응되는 `flex/grid + gap-*`를 우선한다.
- 한두 곳에서만 쓰는 class는 component에 직접 두고, 길고 반복되는 className부터 상수화한다. 스타일 중복만을 이유로 React wrapper component를 성급하게 추가하지 않는다.
- 명시적인 요청 없이 백엔드 API 또는 WebSocket event 계약을 변경하거나 새 동작을 가정하지 않는다.
