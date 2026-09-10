# AGENTS.md

이 문서는 `frontend/` 작업에 적용되며, 루트 `AGENTS.md`의 공통 원칙을 보완한다.

## 디렉터리 구조

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
- feature 내부 파일과 하위 디렉터리는 실제로 필요해질 때만 추가한다. 처음부터 깊은 계층이나 추상화를 만들지 않는다.
- `components/`에는 여러 feature에서 실제로 공유하는 컴포넌트만 둔다. 단일 feature에서만 사용하는 컴포넌트는 해당 feature에 둔다.
- `api/`에는 공통 HTTP client와 같은 전역 API 인프라만 둔다. feature별 요청은 해당 feature에 둔다.
- `routes/`는 route 정의와 인증 접근 제어를 포함한 라우팅 구성을 담당한다.

## 라이브러리 API 사용

- 현재 설치된 패키지 버전을 기준으로 API를 사용한다.
- deprecated API는 사용하지 않는다.

## 기능 단위 TDD 진행

- 새 frontend 기능을 시작할 때 구현 전에 해당 기능에서 발생 가능한 주요 상태를 먼저 식별한다.
- 성공 경로는 기존 TDD 원칙대로 먼저 RED → GREEN으로 진행한다.
- 성공 경로 완료 후 바로 다음 기능으로 넘어가지 않고, 현재 기능의 나머지 상태를 모두 검토한다.
- 필요에 따라 pending/loading, 예상 가능한 실패/빈 상태, 예상하지 못한 error, request cancellation 여부를 확인한다.
- 필요한 상태를 모두 RED → GREEN으로 처리하고 해당 기능 전체가 완료된 뒤 다음 기능으로 넘어간다.
- query/mutation 작업을 시작했으면 UI 연결로 넘어가기 전에 해당 query/mutation이 실제로 구현하는 주요 분기와 책임을 테스트로 보장한다.
- query/mutation 테스트에서는 필요에 따라 성공 응답, 의미 있는 HTTP error 해석, transport error passthrough, pagination/pageParam, queryFn `signal` 전달 등을 확인한다.
- 모든 기능과 query/mutation에 모든 상태를 기계적으로 추가하지 않고 실제로 존재하는 분기와 동작만 다룬다.

## 앱 전역 구조와 인증 상태

- 앱 진입점에서 `QueryClientProvider`가 `RouterProvider`를 감싼다.
- 인증 상태의 source of truth는 `GET /auth/me` 응답이다.
- 현재 로그인 사용자는 TanStack Query의 `["auth", "me"]` query로 관리한다.
- 인증 상태를 위한 별도의 `AuthContext`는 만들지 않는다.

## HTTP와 인증

- HTTP 요청에는 공통 `apiFetch`를 사용한다.
- `apiFetch`는 credentials, refresh/retry 같은 공통 HTTP 전송만 담당하고 endpoint별 status 의미를 해석하지 않는다.
- queryFn과 mutationFn은 동일한 error 처리 원칙을 따른다.
- feature의 query/mutation 함수는 HTTP response를 받은 경우 자신의 API 의미에 따라 status를 해석한다.
- Page/component 안에서 API 요청과 HTTP status 해석을 inline queryFn/mutationFn으로 크게 두지 않고, 로직이 독립적인 책임을 가지면 해당 feature의 별도 함수로 분리한다. 컴포넌트는 form/UI 상태, navigation, query/mutation 상태 연결에 집중한다.
- 단순한 한두 줄 요청까지 기계적으로 분리하거나 custom hook을 만들지는 않는다.
- 사용자에게 보여줄 의미가 정해진 HTTP 실패는 공통 `UserFacingError`로 throw한다.
- `apiFetch` 자체가 reject한 network/abort 등 transport error는 새 error로 wrapping하지 않고 원본을 그대로 전달한다.
- 컴포넌트는 가능한 한 raw `Response.status`를 직접 확인하지 않고 query/mutation의 상태와 feature에서 해석된 error를 사용한다.
- `UserFacingError`이면 해당 message를 사용할 수 있고, 그 외 예상하지 못한 error는 feature에 맞는 사용자용 fallback message로 처리한다.
- `auth/me`의 `401` → `null`처럼 해당 feature에서 정상 상태로 의미가 정해진 예외는 명시적으로 변환할 수 있다.
- 모든 인증 관련 요청에는 `credentials: "include"`를 설정한다.
- 일반 요청이 `401`을 반환하면 `POST /auth/refresh`를 시도한다.
- refresh가 성공하면 원래 요청을 한 번만 재시도한다.
- refresh 요청 자체가 실패한 경우 다시 refresh하지 않는다.
- `GET /auth/me`의 `401`도 refresh 대상이다.
- access token과 refresh token은 HttpOnly cookie에 있으므로 frontend에서 직접 저장하거나 읽지 않는다.

## 라우팅과 접근 제어

- guest-only route는 `/login`, `/register`이다.
- protected route는 `/`, `/conversations/:conversationId`, `/profile`이다.
- protected route는 `ProtectedRoute`, guest-only route는 `GuestOnlyRoute`로 접근을 제어한다.
- 두 route guard 모두 인증 query가 확인 중일 때 loading 상태를 처리한다.

## TanStack Query cache

- TanStack Query의 query 요청처럼 취소가 유의미한 fetch에서는 queryFn이 제공하는 `signal`을 HTTP 요청에 전달한다.
- 별도의 `AbortController`를 직접 생성하기보다 라이브러리가 제공하는 signal을 우선 사용한다.
- 로그인 성공 후 `["auth", "me"]`를 다시 조회하여 실제 로그인 사용자 상태를 얻는다.
- `POST /auth/login`은 `204`이므로 로그인 응답에 사용자 정보가 있다고 가정하지 않는다.
- 로그아웃 후에는 이전 사용자의 conversation 및 message 데이터가 남지 않도록 query cache를 비운다.
