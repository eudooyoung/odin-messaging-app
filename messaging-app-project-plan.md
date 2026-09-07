# Messaging App — Project Plan

## Progress

- [x] 1. 요구사항 / 서비스 규칙 결정
- [x] 2. UI / 사용자 흐름 설계
- [x] 3. 데이터 모델 + API 설계
- [x] 4. 기술 스택 결정
- [ ] 5. 구현
  - [x] Auth
  - [x] User / Profile
  - [x] Conversation
  - [x] Message
  - [x] WebSocket
  - [ ] Frontend
- [ ] 6. 배포

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

- Node.js
- Express
- PostgreSQL
- Prisma
- JWT 직접 구현
  - Access Token + Refresh Token
  - Passport 미사용
- Argon2id
- `ws`
- Zod
- Vitest + Supertest
- WebSocket integration test는 `ws` client 사용

### Frontend

1. [x] `QueryClientProvider` 구성
2. [x] 공통 `apiFetch`
   - [x] 모든 요청에 `credentials: "include"` 적용
   - [x] `401` 응답 시 refresh 후 원 요청 1회 재시도
   - [x] refresh 실패 및 재시도 후 `401` 처리
   - [x] transport error passthrough
3. [x] auth/me query
   - [x] `200` 응답을 현재 사용자로 반환
   - [x] `401` 응답을 비로그인 상태인 `null`로 변환
   - [x] 기타 실패 응답 throw
   - [x] TanStack Query의 `signal`을 `apiFetch`에 전달
4. [x] `ProtectedRoute` / `GuestOnlyRoute` / 실제 router 연결
   - [x] 로그인 / 비로그인 접근 제어
   - [x] pending loading UI
   - [x] error UI
   - [x] `/login` → `LoginPage` + `GuestOnlyRoute`
   - [x] `/register` → `RegisterPage` + `GuestOnlyRoute`
   - [x] `/` → `UserSearch` + `ConversationList` + `ProtectedRoute`
   - [x] `/conversations/:conversationId` → `ConversationPage` + `ProtectedRoute`
5. [x] Login TDD
   - [x] React Hook Form + Zod validation
   - [x] `POST /auth/login` 성공 요청
   - [x] 로그인 성공 후 auth/me 재조회 완료 뒤 `/` 이동
   - [x] client-side validation 및 요청 차단
   - [x] pending 상태
   - [x] HTTP error / 예상하지 못한 error UI
6. [x] Register TDD
   - [x] React Hook Form + Zod validation
   - [x] `POST /auth/register` 성공 요청
   - [x] 성공 후 `/login` 이동
   - [x] client-side validation
   - [x] 실패 UI
7. [x] User Search
   - [x] `GET /users?query=...` query
   - [x] success / empty / `400` / 기타 HTTP error / transport error
   - [x] TanStack Query의 `signal` 전달
   - [x] 검색 UI: loading / success / empty / user-facing error / fallback error
   - [x] `displayName` + `@username` 표시
   - [x] 실제 `/` 화면에 연결
   - [x] 기능 audit 및 필수 문제 보완
8. [x] Conversation
   - [x] 목록 infinite query
     - [x] `limit=20`을 첫 페이지와 후속 페이지 모두 전달
     - [x] `pageParam → cursor`, `nextCursor → getNextPageParam`
     - [x] success / HTTP error / transport error / signal
   - [x] `ConversationList`
     - [x] loading / success / empty / initial error
     - [x] 다음 페이지 pending / error / success / 마지막 페이지
     - [x] conversation 선택 → `/conversations/:conversationId` 이동
   - [x] conversation 상세 query
     - [x] success / `403` / `404` / 기타 HTTP error / transport error / signal
     - [x] `403`과 `404`를 서로 다른 사용자 메시지로 해석
   - [x] `ConversationPage`
     - [x] success / loading / error / invalid route param
     - [x] 현재 사용자 username으로 상대 participant 식별
     - [x] participant 배열 순서에 의존하지 않음
   - [x] 목록/상세 기능 audit 및 필수 문제 보완
   - [x] `POST /conversations` 생성/재사용 mutation
     - [x] `201` 새 conversation
     - [x] `200` 기존 conversation 재사용
     - [x] `400` / `404` 의미 있는 HTTP error 해석
     - [x] 기타 HTTP error / transport error passthrough
   - [x] 검색 결과 사용자 선택 → 생성/재사용 → `/conversations/:id` 이동
     - [x] mutation pending 동안 선택한 결과 비활성화
     - [x] mutation error UI 및 실패 시 현재 화면 유지
   - [x] 생성/재사용 흐름 audit 완료 — 필수 수정사항 없음
9. [ ] Message REST
10. [ ] WebSocket 실시간 반영
11. [ ] Profile

### Frontend 작업 방식

- query / mutation / UI 같은 단위 구현에서는 주요 상태를 모두 검토하고 TDD로 완료한 뒤 다음 단위로 이동한다.
- 큰 기능 단위가 완료되면 다음 기능으로 넘어가기 전에 기능 전체 audit를 수행한다.
- audit에서는 API 계약, query/mutation/UI 상태, 실제 router/page 연결, 사용자 흐름, 테스트 누락·중복을 확인한다.
- audit에서 발견된 필수 문제를 보완하고 다시 확인한 뒤 다음 큰 기능으로 이동한다.
- GPT 대화 세션을 교체하기 전에는 현재 진행 상황과 다음 시작점을 이 문서에 먼저 반영한다.

### 다음 시작점

- Message REST TDD
  - `GET /conversations/:id/messages` 메시지 목록 query부터 시작
  - 주요 상태를 식별한 뒤 성공 경로 RED → GREEN으로 진행
  - query 단위 완료 후 메시지 목록 UI로 연결

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
