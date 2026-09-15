# Messaging App — Project Plan

## Progress

- [x] 1. 요구사항 / 서비스 규칙 결정
- [x] 2. UI / 사용자 흐름 설계
- [x] 3. 데이터 모델 + API 설계
- [x] 4. 기술 스택 결정
- [ ] 5. MVP 완성
  - [x] Backend 핵심 기능 구현
  - [x] Frontend 핵심 기능 구현
  - [ ] Frontend 실제 사용자 흐름 / UI 완성
  - [ ] 실제 브라우저 smoke test
- [ ] 6. 배포 전 점검 / 배포

## 1. 요구사항 / 서비스 규칙

### 사용자 / 인증

- `username` + `password`
- `username`은 unique, 계정 식별용
- `displayName`은 표시용 이름
- 로그인한 사용자만 주요 기능 이용

### 사용자 탐색

- `username` 또는 `displayName`으로 검색
- 전체 사용자 목록은 공개하지 않음
- 자기 자신과 대화 시작 불가

### 1:1 대화

- 사용자 2명으로 구성
- 동일한 두 사용자 사이에는 대화 1개만 존재
- 기존 대화가 있으면 재사용
- 대화 목록은 최근 메시지 순
- 상대 `displayName`, 마지막 메시지, 시간 표시
- 대화 삭제 / 나가기 제외

### 메시지

- 텍스트 메시지만
- 빈 메시지 불가
- 메시지 수정 / 삭제 제외
- 읽음 여부 제외
- 참여자만 조회 / 전송 가능
- 메시지 저장 / 조회는 REST
- 새 메시지 실시간 전달은 WebSocket

### 프로필

- `displayName`
- `bio`
- 프로필 이미지
- `username`은 변경 불가
- 프로필 이미지 저장 방식은 추후 결정

### MVP 제외

- 친구 기능
- 온라인 상태
- 그룹 채팅
- 이미지 메시지
- 이메일 인증 / OAuth
- 비밀번호 변경 / 재설정

## 2. UI / 사용자 흐름

### 인증

- 비로그인 사용자의 첫 화면은 로그인
- 회원가입 화면 제공
- 로그인 성공 후 메인 메시징 화면으로 이동

### 메인 화면

- 데스크톱
  - 좌측: 대화 목록
  - 우측: 선택한 채팅
  - 상단: 사용자 검색 / 내 프로필
- 대화 미선택 시 안내 화면
- 모바일은 대화 목록과 채팅 화면을 전환

### 사용자 검색

- `username` 또는 `displayName`으로 검색
- 결과에 `displayName + @username` 표시
- 기존 대화가 있으면 해당 대화 열기
- 없으면 새 1:1 대화 생성 후 열기

### 채팅 화면

- 상단: 상대 프로필 이미지, `displayName`, `@username`
- 중앙: 메시지 목록
- 하단: 입력창 + 전송 버튼
- 내 메시지 / 상대 메시지 구분
- 전송 시간 표시
- 과거 메시지는 REST로 조회
- 새 메시지는 WebSocket으로 즉시 반영
- 최신 메시지부터 일정 개수 조회하고, 위로 스크롤하면 과거 메시지 추가 로드

### 프로필

- 프로필 이미지
- `displayName`
- `@username`
- `bio`
- 수정 가능: 프로필 이미지, `displayName`, `bio`
- `username`은 수정 불가

## 3. 데이터 모델 + API 설계

### 데이터 모델

#### User

- `id`: Int
- `username`: unique, 최대 30자, 변경 불가
- `passwordHash`
- `displayName`: 최대 50자
- `bio`: nullable, 최대 300자
- `profileImage`: nullable
- `createdAt`
- `updatedAt`
- `conversations`
- `messages`

#### Conversation

- `id`: Int
- `participants: User[]` — implicit many-to-many
- `messages: Message[]`
- `createdAt`
- `lastActivityAt`
  - 생성 시 `createdAt`과 같은 값
  - 메시지 생성 시 갱신
  - 대화 목록 정렬 기준
- 동일한 두 사용자 사이에는 하나의 Conversation만 존재

#### Message

- `id`: Int
- `content`: 필수, trim 후 빈 문자열 불가, 최대 1000자
- `senderId`
- `conversationId`
- `createdAt`

#### RefreshSession

- refresh token은 서버 저장형 세션으로 관리
- `tokenHash`: refresh token의 SHA-256 hash
- `userId`
- `expiresAt`
- refresh rotation 시 기존 session 삭제 + 새 session 생성을 Prisma transaction으로 처리

### 주요 규칙

- Message sender는 해당 Conversation의 participant여야 함
- Conversation 참여자만 메시지 조회 / 전송 가능
- 사용자와 Conversation은 implicit many-to-many
- 내부 PK는 Int 사용

### API

#### Auth

- `POST /auth/register`
  - request: `{ username, password, displayName }`
  - response: `{ id, username, displayName }`
  - success: `201`
  - error: `400` validation, `409` duplicate username

- `POST /auth/login`
  - request: `{ username, password }`
  - response body: 없음
  - success: `204`
  - 인증 성공 시 `accessToken`, `refreshToken`을 HttpOnly cookie로 설정
  - error: `401`

- `POST /auth/refresh`
  - request body: 없음
  - response body: 없음
  - success: `204`
  - refresh token 검증 후 access/refresh token rotation
  - 기존 RefreshSession 삭제 + 새 RefreshSession 생성을 transaction으로 처리
  - error: `401`

- `POST /auth/logout`
  - request: 없음
  - response: 없음
  - success: `204`
  - 이미 로그아웃 상태여도 `204`

- `GET /auth/me`
  - response: `{ id, username, displayName }`
  - success: `200`
  - error: `401`

#### User / Profile

- `GET /users/{username}`
  - response: `{ username, displayName, bio, profileImage }`
  - success: `200`
  - error: `401`, `404`

- `PATCH /users/me`
  - request: `{ displayName?, bio?, profileImage? }`
  - response: `{ username, displayName, bio, profileImage }`
  - success: `200`
  - error: `400` validation, `401`

- `GET /users?query=...`
  - `username` 또는 `displayName` 검색
  - `query`: trim 후 1~50자
  - response: `[{ username, displayName, profileImage }]`
  - success: `200`
  - error: `400` validation, `401`
  - 검색 결과 없음: `200 []`

#### Conversation

- `POST /conversations`
  - request: `{ targetUsername }`
  - `targetUsername`: trim 후 1~30자
  - response: `{ id, participants, createdAt, lastActivityAt }`
  - 새 대화 생성: `201`
  - 기존 대화 반환: `200`
  - error: `400` validation / 자기 자신, `401`, `404` target user 없음

- `GET /conversations`
  - 현재 사용자의 대화 목록
  - response: `{ conversations: [{ id, otherUser, lastMessage?, lastActivityAt }], nextCursor }`
  - 정렬: `lastActivityAt DESC, id DESC`
  - `cursor`: optional positive integer
  - `limit`: optional positive integer
  - cursor pagination은 repository에서 `limit + 1` 조회 후 service에서 `nextCursor` 계산
  - success: `200`
  - error: `400` pagination query validation, `401`
  - 대화 없음: `{ conversations: [], nextCursor: null }`

- `GET /conversations/{id}`
  - `id`: positive integer
  - response: `{ id, participants, createdAt, lastActivityAt }`
  - success: `200`
  - error: `400` id validation, `401`, `403` participant 아님, `404`

#### Message

- `POST /conversations/{id}/messages`
  - request: `{ content }`
  - response: `{ id, content, sender, createdAt }`
  - success: `201`
  - error: `400` validation, `401`, `403` participant 아님, `404`

- `GET /conversations/{id}/messages`
  - response: `{ messages: [{ id, content, sender, createdAt }], nextCursor }`
  - 정렬: `createdAt DESC, id DESC`
  - cursor: 마지막으로 받은 `messageId`
  - success: `200`
  - error: `401`, `403` participant 아님, `404`

### 인증 / 권한

- 비로그인 사용자는 `register`, `login` 외 API 접근 불가
- `/auth/me`, `/users/*`, `/conversations/*`는 로그인 필요
- Conversation 조회는 participant만 가능
- Message 조회 / 생성은 participant만 가능
- 프로필 수정은 본인만 가능
- 다른 사용자 프로필 조회 / 검색은 로그인 사용자에게 허용

## 4. 기술 스택

### Backend

- Node.js 24
- TypeScript + ESM
- Express 5
- PostgreSQL
- Prisma 7
- JWT Access Token + Refresh Token
- Argon2id
- SHA-256 refresh token hash
- `ws`
- Zod
- Vitest + Supertest
- WebSocket integration test: `ws` client

### Frontend

- React 19
- TypeScript
- Vite 8
- React Router
- TanStack Query
- native WebSocket API
- React Hook Form
- Zod
- Tailwind CSS
- Vitest
- React Testing Library
- `@testing-library/user-event`

## 5. 구현 진행상황

### Backend

- [x] Auth
  - [x] register / login / logout / refresh / me
  - [x] HttpOnly access / refresh cookie
  - [x] refresh session 서버 저장 + SHA-256 token hash
  - [x] refresh rotation transaction
  - [x] Zod env validation / test DB 분리
- [x] User / Profile API
  - [x] 사용자 조회
  - [x] 내 프로필 수정
  - [x] username / displayName 검색
- [x] Conversation
  - [x] 생성 / 기존 1:1 conversation 재사용
  - [x] 목록 cursor pagination
  - [x] 상세 조회 / participant 권한 검사
- [x] Message REST
  - [x] 메시지 생성 / 조회
  - [x] participant 권한 검사
  - [x] cursor pagination
  - [x] message 생성 시 `lastActivityAt` 갱신
- [x] WebSocket
  - [x] cookie access token 인증
  - [x] 사용자별 connection registry
  - [x] `message.created`를 sender 제외 상대 connection들에 publish
  - [x] connection close cleanup
  - [x] connection `error` event 처리
  - [x] frontend REST message shape와 event payload 계약 일치

### Frontend

- [x] 공통 인프라
  - [x] `QueryClientProvider`
  - [x] 공통 `apiFetch`
  - [x] credentials / 401 refresh / 원 요청 1회 retry
  - [x] `VITE_API_URL`
  - [x] transport error passthrough
  - [x] credential 요청용 CORS 설정 — 허용 frontend origin + `credentials: true`
- [x] Auth
  - [x] auth/me query
  - [x] `ProtectedRoute` / `GuestOnlyRoute`
  - [x] Login
  - [x] Register
  - [x] Logout mutation + UI
  - [x] logout 성공 시 cache clear + `/login` 이동
  - [x] 동시 `401` 요청의 refresh 공유로 refresh token rotation 경쟁 방지
  - [x] auth가 authenticated → null로 전환될 때 이전 사용자 cache 정리
  - [x] 인증 query pending / error 상태 처리
  - [x] Auth MVP audit 완료 — MVP blocker 없음
- [x] User Search
  - [x] 검색 query와 주요 상태
  - [x] 사용자 선택 → conversation 생성/재사용 → 이동
- [x] Conversation
  - [x] 목록 infinite query + pagination
  - [x] 목록 loading / empty / error / next-page 상태
  - [x] 상세 query + 403 / 404 구분
  - [x] `ConversationPage`
  - [x] 기능 audit 완료
- [x] Message REST
  - [x] messages infinite query + pagination
  - [x] `MessageList`
  - [x] send mutation + `MessageComposer`
  - [x] 전송 성공 후 cache 즉시 반영
  - [x] GET / POST race, 중복, 정렬, cache 부재/복구 처리
  - [x] 기능 audit 완료
- [x] WebSocket 실시간 반영
  - [x] `message.created` runtime validation + cache sync
  - [x] conversation별 cache 격리 / duplicate 방지
  - [x] protected app-global WebSocket lifecycle
  - [x] router → ConversationPage → MessageList 실시간 반영
  - [x] open 시 REST → WebSocket gap recovery
  - [x] unexpected close reconnect
  - [x] reconnect 전 auth recovery
  - [x] 일시적 auth recovery 실패 retry
  - [x] logout / unmount cleanup
  - [x] POST / WebSocket 도착 순서와 무관하게 `createdAt DESC, id DESC` 유지
  - [x] delayed cache sync가 clear된 이전 사용자 cache를 되살리지 않도록 방어
  - [x] 최종 re-audit 완료 — 필수 WebSocket blocker 없음
- [x] Profile
  - [x] Profile query
  - [x] username path segment 인코딩
  - [x] Profile edit mutation
  - [x] Profile UI / validation / loading / query error / mutation 상태
  - [x] null bio/profileImage 표시 및 submit 변환
  - [x] dirty form의 refetch 입력값 보존
  - [x] PATCH 성공과 profile/auth-me GET 사이 cache race 방어
  - [x] `/profile` protected route + 메인 화면 진입 경로
  - [x] Profile 전체 re-audit 완료 — 필수 blocker 없음

### 남은 후속 작업

Backend / Frontend의 핵심 기능 구현과 기능 단위 audit은 완료했다. 다만 실제 브라우저 기준 사용자 흐름과 UI가 아직 완성되지 않았으므로 MVP 완료로 판정하지 않는다.

#### MVP 사용자 흐름 / UI 완성

- [x] 실제 브라우저 사용자 흐름 audit
  - [x] 비로그인 → Login
  - [x] Login ↔ Register 이동 확인 및 양방향 navigation 보완
  - [x] 회원가입 → 로그인 → 홈
  - [x] 사용자 검색 → conversation 생성/재사용 → 채팅 진입
  - [x] 메시지 조회 / 전송 / 실시간 수신
  - [x] 메시지 UI 표시 순서 수정 — 오래된 메시지 위 / 최신 메시지 아래
  - [x] `Load older messages`를 과거 메시지 방향에 맞게 목록 상단으로 이동
  - [x] Profile 진입 / 수정 및 PATCH 성공 후 즉시 UI 반영
  - [x] Logout
- [x] 필수 navigation 보완
  - [x] Login ↔ Register 양방향 이동
  - [x] Conversation → 대화 목록/홈 복귀 경로
  - [x] Profile → 대화 목록/홈 복귀 경로
- [ ] MVP 기본 UI / CSS
  - Login / Register 폼
  - 데스크톱 메시징 2-column layout
  - ConversationList / ConversationPage / MessageList / MessageComposer
  - User Search / Profile / loading / empty / error 상태
  - 모바일에서 대화 목록 ↔ 채팅 화면 전환이 가능한 기본 responsive 처리
- [ ] frontend + backend 실제 브라우저 smoke test
  - mock 없이 핵심 흐름을 처음부터 끝까지 실행
  - 테스트에서 드러나지 않는 CORS / cookie / routing / WebSocket integration 문제 확인


#### Frontend manual audit / code walkthrough

CSS 작업 전에 프론트 전체 흐름을 코드 기준으로 다시 이해하고, 읽기 어려운 부분과 작은 리팩토링 지점을 정리한다. 기능 추가보다는 기존 구현의 책임과 lifecycle을 파악하는 단계다.

- [x] 앱 진입 / 라우팅 / 인증 lifecycle
  - [x] `main.tsx` — `QueryClientProvider` / `RouterProvider` 관계 확인
  - [x] router — protected / guest-only route와 `Outlet` 흐름 확인
  - [x] `ProtectedRoute` — `auth/me`의 `undefined` / `null` / `AuthUser` 상태 의미 확인
  - [x] query error UI 공통 `QueryErrorMessage`로 정리
  - [x] `UserFacingError`와 generic fallback message의 책임 분리
  - [x] `authMeQuery`의 내부 error message와 사용자 fallback message 분리
  - [x] `ClearSessionCacheOnAuthEnd` — logout/unmount 시 non-auth query cache cleanup 확인
  - [x] `AuthenticatedWebSocket` connection lifecycle 구조 확인
    - 기본 WebSocket 연결 / message listener / cleanup과 robustness 보완을 구분해 학습
    - WebSocket open 시 REST message query refetch를 통한 연결 전 gap recovery 확인
    - open 시 initial fetch 중이던 message query의 추가 refetch race 방어 확인
    - unexpected close → auth recovery → reconnect / retry 흐름 확인
    - timeout retry handle과 unmount cleanup 확인
  - [x] 위 범위 관련 테스트 구조 재검토 / 필요한 테스트 리팩토링
    - [x] router 인증 관련 테스트에서 feature/query 구현 세부사항인 `apiFetch` 호출 검증 제거
    - [x] `apiFetch` 구현 walkthrough / manual audit 완료
      - 실제 호출부를 기준으로 입력 계약을 `/`로 시작하는 상대경로 `string`으로 축소
      - absolute URL / `Request` / `URL` 입력 지원과 관련 helper(`resolveRequestInput`, `cloneRequestInput`, `isRefreshRequest`) 제거
      - API URL은 `${API_URL}${path}`로 직접 조합하고 기본 `credentials: "include"` 유지
      - `401`일 때만 refresh, refresh endpoint 자체는 재귀 refresh 제외, shared pending refresh, 원 요청 1회 retry 흐름 확인
      - refresh `401`은 인증 종료로 유지하고, refresh의 non-401 실패는 해당 refresh response를 전달하도록 구분
      - retry가 다시 `401`이어도 추가 refresh하지 않도록 최대 1회 복구 정책 확인
    - [x] `apiFetch.test.ts` 리팩토링 완료
      - 기본 요청 / refresh-retry 테스트의 중복 assertion과 테스트용 path/변수명 정리
      - non-401 초기 응답은 refresh하지 않는 회귀 테스트 추가
      - refresh endpoint 자체 401 / refresh non-401 실패 / refresh 401 / retry 401 분기별 검증 정리
      - concurrent `401` → single refresh 공유 테스트를 행동 단계 기준으로 정리하고 `await Promise.resolve()` 대신 `vi.waitFor` 사용
      - refresh 요청의 `POST` + `credentials: "include"` 계약은 정상 refresh-retry 테스트에 통합
      - 테스트는 `when the initial request returns 401` 범위로 묶고 parameterized test는 적용하지 않기로 결정
    - [x] `authMeQuery.test.ts` 테스트 구조 재검토 / 리팩토링 완료
      - 성공 테스트에 `queryKey`, `/auth/me` 호출 + TanStack Query `signal`, 반환 사용자 검증을 함께 유지
      - 별도 signal 전달 테스트 제거, 중복 `apiFetch` 호출 횟수 검증 제거
      - `401 → null`은 query 성공 상태이므로 불필요한 `retry: false` 제거
      - non-401 HTTP 실패 테스트는 500 response body/header를 제거하고 `Failed to fetch current user` reject만 검증
      - transport error가 원래 Error 객체 그대로 전달되는 passthrough 테스트 추가
      - 테스트는 별도 하위 `describe` 없이 현재 4개 계약을 평평하게 유지
    - [x] `ProtectedRoute.test.tsx`를 auth 상태별 semantic `describe` 구조로 정리
    - [x] `AuthenticatedWebSocket.test.tsx`를 connection/messages, auth recovery/reconnect, cleanup lifecycle 기준으로 정리
- [x] Conversation / Message REST query·cache 흐름 manual audit
  - [x] `conversationQuery.ts` / test audit — queryKey, signal, 403/404/generic HTTP error, transport passthrough 책임 정리
  - [x] `conversationsQuery.ts` / test audit — initial page/cursor pagination 계약과 component 중복 검증 정리
  - [x] `messagesQuery.ts` / test audit — pagination, 403/404/generic error, transport passthrough 계약 정리
  - [x] `ConversationList.tsx` / test audit — loading/error/empty/render/pagination observable behavior 중심으로 정리
  - [x] `ConversationPage.tsx` / test audit — route/page 통합 동작은 유지하고 하위 query/mutation transport 세부 assertion 제거
  - [x] 공통 `FormField` 추출 — Login/Register/MessageComposer의 label/input/error 접근성 wiring 중복 제거
  - [x] `MessageComposer.tsx` / test audit — mutation pending/success/error/validation 책임 정리, 메시지 최대 길이를 backend 계약과 동일한 1000자로 수정
  - [x] `MessageList.tsx` / test audit — newest-first query data를 oldest-to-latest UI 순서로 표시하는 계약 유지, pagination/refetch observable behavior 중심으로 정리
  - [x] frontend 테스트의 반복 `QueryClient` lifecycle 정리
    - 안전한 파일은 `beforeEach`에서 새 client 생성, `afterEach`에서 `clear()`하도록 공통화
    - 특수 옵션/fake timer/일부 테스트만 QueryClient를 사용하는 파일은 local lifecycle 유지
    - assertion 이전 의도적인 `queryClient.clear()`는 유지
    - 전체 frontend 테스트 GREEN 확인
  - [x] `createMessage.ts` / test audit — POST 201 성공, 403/404 status-specific error, generic HTTP error, transport passthrough 계약 확인
  - [x] `syncMessagesToCache.ts` / test audit
    - cache 생성 / pagination 보존 / duplicate 방지 / `createdAt DESC, id DESC` 정렬 계약 확인
    - pending fetch 완료 후 message 재적용과 initial fetch error recovery refetch 테스트 보완
    - cache clear 후 stale async sync가 이전 사용자 cache를 되살리지 않는 lifecycle 방어 유지
    - test를 basic cache sync / ordering / fetch-recovery lifecycle 기준으로 정리
- [x] User Search / Conversation 생성 흐름 manual audit
  - [x] `usersQuery.ts` / test — queryKey, URL query encoding, signal, 400/generic HTTP error, transport passthrough 정리
  - [x] `UserSearch.tsx` / test — trim된 검색값과 원본 input 분리, whitespace-only query 비활성화
  - [x] conversation mutation pending 동안 전체 사용자 버튼 disabled로 중복 생성/navigation race 방지
  - [x] search / conversation creation 기준 semantic test 구획과 fixture 중복 정리
  - [x] `createConversation.ts` / test — 200/201 success, 400/404 status-specific error, generic HTTP error, transport passthrough 정리
- [x] Profile query / mutation / page 흐름 manual audit
  - [x] `userProfileQuery.ts` / test — queryKey, username path encoding, signal, 404/generic HTTP error, transport passthrough 정리
  - [x] `updateUserProfile.ts` / test — PATCH 계약, 400/generic HTTP error, transport passthrough 정리
  - [x] `ProfilePage.tsx` — input field에 기존 `FormField` 재사용, profile cache 동기화 helper로 성공 lifecycle 가독성 개선
  - [x] profile form의 `bio` / `profileImage` 빈 문자열 → `null` 변환을 명시적으로 정리
  - [x] `ProfilePage.test.tsx` — 하위 query/mutation transport 중복 검증 제거 및 component observable behavior 중심으로 정리
  - [x] profile loading/form state / validation / successful update / update lifecycle 기준 semantic test 구획
  - [x] profile/auth 이전 refetch와 PATCH 성공 cache race 방어 테스트 유지
  - [x] 반복 fixture, query key, render wrapper, form interaction helper 정리

#### Backend refactor TODO

- [ ] 사용자 검색에서 현재 로그인 사용자 제외
  - `GET /users?query=...`가 대화 상대 탐색 용도로 사용되므로 DB 조회 단계에서 현재 사용자 제외 검토
  - `POST /conversations`의 자기 자신과 대화 시작 방지 검증은 그대로 유지
  - backend 적용 시 frontend의 별도 본인 필터링은 두지 않음

#### 배포 전 확인

- [ ] Backend Message atomicity
  - message 저장과 `Conversation.lastActivityAt` 갱신을 하나의 원자적 작업으로 보장할지 검토 및 필요 시 보완
- [ ] WebSocket deployment security
  - cookie 인증 WebSocket upgrade 요청의 허용 `Origin` 검증

#### Post-MVP Auth hardening

- [x] refresh 일시 장애(non-401 failure, 예: 5xx)를 인증 만료(`401`)와 구분
- [ ] 이전 session에서 시작한 pending mutation / refresh가 session 전환 이후 cache, navigation, cookie 상태에 영향을 주지 않도록 방어
- [ ] 로그인 성공 후 auth/me 확인이 반드시 로그인 이후 시작된 fresh 요청임을 보장

### 작업 방식

- query / mutation / UI 단위의 주요 상태를 식별한 뒤 성공 경로부터 RED → GREEN으로 진행한다.
- 한 단위를 시작하면 필요한 주요 상태를 모두 처리한 뒤 다음 단위로 이동한다.
- 큰 기능 완료 후 API/event 계약, 실제 router/page 흐름, cache/lifecycle, 테스트 누락을 audit한다.
- audit의 필수 blocker를 모두 보완한 뒤 다음 큰 기능으로 이동한다.
- GPT 세션 교체 전 이 문서의 진행상황과 다음 시작점을 최신화한다.

### 다음 시작점

- Backend / Frontend의 핵심 기능 구현과 기능 단위 audit은 완료했다.
- 실제 브라우저 사용자 흐름 audit과 필수 navigation 보완도 완료했다.
- UI audit에서 발견한 메시지 표시 순서, older-message navigation, profile 즉시 반영 문제를 보완했다.
- 사용자 검색에서 본인 제외는 frontend 필터링 대신 Backend refactor TODO로 유지한다.
- 현재는 CSS 작업을 잠시 보류하고 **Frontend manual audit / code walkthrough**를 진행 중이다.
  1. `main.tsx → router → ProtectedRoute` 흐름은 확인 완료
  2. query error 표현과 auth error/fallback 책임을 정리 완료
  3. `ClearSessionCacheOnAuthEnd`와 `AuthenticatedWebSocket` lifecycle을 확인 완료
  4. router 인증 테스트의 불필요한 `apiFetch` 구현 세부 검증을 제거
  5. `apiFetch` manual audit 완료 — 실제 사용 범위에 맞게 상대경로 string 전용 계약으로 축소하고 불필요한 Request/URL 지원 제거
  6. refresh `401`과 non-401 실패를 구분하고, refresh endpoint 재귀 방지 / 1회 retry / concurrent refresh 공유 정책 확인
  7. `apiFetch.test.ts` 리팩토링 완료 — 중복 assertion 정리, non-401 회귀 테스트 추가, concurrent 테스트 `vi.waitFor` 개선, refresh 요청 옵션 검증 통합
  8. `authMeQuery.test.ts` 재검토 완료 — signal 검증을 성공 케이스에 통합하고 중복 호출 검증 제거, 401/null·non-401 error·transport error 계약을 간결하게 정리
  9. `ProtectedRoute.test.tsx` / `AuthenticatedWebSocket.test.tsx` 테스트 구조 재검토 완료 — 상태/lifecycle 기준 semantic `describe`로 정리
  10. Conversation / Message query 및 component 테스트 audit 진행 — query/mutation 단위 계약과 상위 UI 테스트의 중복 transport assertion 분리
  11. `FormField` 공통 컴포넌트 추출 및 Login/Register/MessageComposer 적용 완료
  12. `MessageComposer` 메시지 최대 길이를 backend 계약과 동일한 1000자로 수정하고 validation 테스트 갱신
  13. `MessageList` ordering/pagination/refetch 테스트 정리 완료 — 오래된 메시지 위 / 최신 메시지 아래 표시 계약 유지
  14. 반복 `QueryClient` 생성/`clear()`를 안전한 frontend 테스트 16개 파일에서 `beforeEach`/`afterEach` lifecycle로 공통화했고 전체 테스트 GREEN 확인
  15. `createMessage.ts` / test audit 완료
  16. `syncMessagesToCache.ts` / test audit 완료 — fetch/recovery/cache clear race까지 정리
  17. User Search 흐름 audit 완료 — 검색값 trim, whitespace 비활성화, conversation mutation 중복 방지 및 테스트 구조 정리
  18. `createConversation.ts` / test audit 완료
  19. Profile query / mutation / page audit 완료 — path encoding, cache sync, form reset/dirty lifecycle, stale refetch race와 테스트 중복 정리
  20. **다음 세션은 남은 Auth form/mutation manual audit부터 시작 (`LoginPage.tsx` / test 우선 확인)**
- 프론트 흐름이 충분히 정리되면 MVP 기본 CSS / 2-column layout / responsive UI 작업으로 복귀한다.
- 그 뒤 frontend + backend 전체 smoke test를 진행한다.
- 이후 Backend Message atomicity, WebSocket Origin 검증 등 배포 전 확인을 마치고 전체 테스트 / build / 최종 audit 후 배포 단계로 이동한다.
- Auth의 남은 race / 장애 semantics는 post-MVP hardening으로 유지한다.


## 6. 배포 / 인증 쿠키 정책

### 배포 구조

- Frontend: Netlify
- Backend: Render
- frontend와 backend는 서로 다른 site로 배포
- production에서는 cross-site credential 요청을 전제로 구성

### JWT cookie

#### Access Token

- HttpOnly: `true`
- Secure: production `true`
- SameSite: production `None`
- Path: `/`
- 만료: 15분

#### Refresh Token

- HttpOnly: `true`
- Secure: production `true`
- SameSite: production `None`
- Path: `/auth`
- 만료: 7일

### 환경별 정책

- development: `Secure=false`, `SameSite=Lax`
- production: `Secure=true`, `SameSite=None`
- JWT `exp`와 cookie `Max-Age`는 같은 수명으로 맞춤

### Cross-origin credential

- Backend CORS: Netlify frontend origin을 명시하고 `credentials: true`
- Frontend HTTP 요청: `credentials: "include"`
- credential 요청에서는 `Access-Control-Allow-Origin: *`를 사용하지 않음
