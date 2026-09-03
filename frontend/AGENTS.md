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

## 앱 전역 구조와 인증 상태

- 앱 진입점에서 `QueryClientProvider`가 `RouterProvider`를 감싼다.
- 인증 상태의 source of truth는 `GET /auth/me` 응답이다.
- 현재 로그인 사용자는 TanStack Query의 `["auth", "me"]` query로 관리한다.
- 인증 상태를 위한 별도의 `AuthContext`는 만들지 않는다.

## HTTP와 인증

- HTTP 요청에는 공통 `apiFetch`를 사용한다.
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
