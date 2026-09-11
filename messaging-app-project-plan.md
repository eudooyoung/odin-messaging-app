# Messaging App — Project Plan

## Progress

- [x] 1. 요구사항 / 서비스 규칙 결정
- [x] 2. UI / 사용자 흐름 설계
- [x] 3. 데이터 모델 + API 설계
- [x] 4. 기술 스택 결정
- [x] 5. MVP 구현
  - [x] Backend
  - [x] Frontend
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
- `content`: 필수, trim 후 빈 문자열 불가, 최대 2000자
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

MVP 기능 구현은 완료했다. 아래는 배포 전 확인하거나 post-MVP hardening으로 남긴 항목이다.

#### 배포 전 확인

- [ ] Backend Message atomicity
  - message 저장과 `Conversation.lastActivityAt` 갱신을 하나의 원자적 작업으로 보장할지 검토 및 필요 시 보완
- [ ] WebSocket deployment security
  - cookie 인증 WebSocket upgrade 요청의 허용 `Origin` 검증

#### Post-MVP Auth hardening

- [ ] refresh 일시 장애(5xx)를 인증 만료(`401`)와 구분
- [ ] 이전 session에서 시작한 pending mutation / refresh가 session 전환 이후 cache, navigation, cookie 상태에 영향을 주지 않도록 방어
- [ ] 로그인 성공 후 auth/me 확인이 반드시 로그인 이후 시작된 fresh 요청임을 보장

### 작업 방식

- query / mutation / UI 단위의 주요 상태를 식별한 뒤 성공 경로부터 RED → GREEN으로 진행한다.
- 한 단위를 시작하면 필요한 주요 상태를 모두 처리한 뒤 다음 단위로 이동한다.
- 큰 기능 완료 후 API/event 계약, 실제 router/page 흐름, cache/lifecycle, 테스트 누락을 audit한다.
- audit의 필수 blocker를 모두 보완한 뒤 다음 큰 기능으로 이동한다.
- GPT 세션 교체 전 이 문서의 진행상황과 다음 시작점을 최신화한다.

### 다음 시작점

- Backend / Frontend의 MVP 기능 구현과 주요 기능 audit을 완료했다.
- Frontend Auth에서 누락됐던 Logout 구현도 완료했다.
- Auth audit에서 MVP blocker로 분류한 항목은 모두 보완했다.
  - 동시 `401` refresh 공유
  - authenticated → null 전환 시 이전 사용자 cache 정리
- 다음 작업은 **배포 전 확인 항목**부터 진행한다.
  1. Backend Message atomicity
  2. WebSocket Origin 검증
- Auth의 남은 race / 장애 semantics는 post-MVP hardening으로 유지한다.
- 배포 전 확인이 끝나면 전체 테스트 / build / 최종 audit 후 배포 단계로 이동한다.


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
