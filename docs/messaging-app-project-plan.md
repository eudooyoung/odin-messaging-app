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

- `username` + `password`로 로그인
- `username`은 unique, 변경 불가인 로그인 전용 비공개 식별자
- `username`에 이메일 형식을 강제하지 않음
- `handle`은 공개 unique 식별자이며 `@handle`로 표시
- `handle`은 변경 가능하며 사용자 URL / 검색 / 대화 시작에 사용
- `displayName`은 중복 가능한 표시용 이름
- 로그인한 사용자만 주요 기능 이용

### 사용자 탐색

- `handle` 또는 `displayName`으로 검색
- 전체 사용자 목록은 공개하지 않음
- 자기 자신과 대화 시작 불가
- 공개 사용자 URL은 `/users/:handle` 사용

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

- `handle`
- `displayName`
- `bio`
- 프로필 이미지
- `handle`은 변경 가능
- `username`은 로그인 전용이며 변경 불가 / 다른 사용자에게 비공개
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

- `handle` 또는 `displayName`으로 검색
- 결과에 `displayName + @handle` 표시
- 검색 결과 선택 시 `/users/:handle`의 read-only 사용자 프로필로 이동
- 최근 선택한 사용자는 로컬 recent list로 보관하고 빈 검색창 focus 시 표시
- 다른 사용자의 프로필에서 `Message`를 선택하면 기존 1:1 대화를 재사용하거나 새 대화를 생성한 뒤 채팅으로 이동
- 현재 로그인 사용자의 read-only 프로필에서는 `Message`를 표시하지 않고, 본인 프로필 편집은 기존 `/profile`에서 처리

### 채팅 화면

- 상단: 상대 프로필 이미지, `displayName`, `@handle`
- 중앙: 메시지 목록
- 하단: 입력창 + 전송 버튼
- 내 메시지 / 상대 메시지 구분
- 전송 시간 표시
- 과거 메시지는 REST로 조회
- 새 메시지는 WebSocket으로 즉시 반영
- 최신 메시지부터 일정 개수 조회하고, 위로 스크롤하면 과거 메시지 추가 로드

### 프로필

- 다른 사용자: `/users/:handle`에서 read-only 프로필 표시
  - 프로필 이미지
  - `displayName`
  - `@handle`
  - `bio`
  - 다른 사용자에게 `Message` 진입점 제공
- 현재 사용자: `/profile`에서 편집
  - 수정 가능: 프로필 이미지, `handle`, `displayName`, `bio`
  - `username`은 로그인 전용이며 수정 불가

## 3. 데이터 모델 + API 설계

### 데이터 모델

#### User

- `id`: Int
- `username`: unique, 최대 30자, 변경 불가, 로그인 전용 비공개 식별자
- `handle`: required, unique, 최대 30자, 변경 가능, 공개 식별자
  - 3~30자
  - lowercase `a-z`, `0-9`, `_`, `.`만 허용
  - `_`는 처음 / 끝 허용
  - `.`은 처음 / 끝 불가
  - 연속 `..` 불가
  - 가입 시 서버가 `user_` + random lowercase alphanumeric 8자로 자동 생성
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
- 사용자 URL / 검색에는 내부 `id`를 사용하지 않고 `handle`을 사용
- authenticated API에서 본인 / 상대 / sender의 안정적인 identity 비교가 필요한 payload에는 사용자 `id`를 포함
- 다른 사용자에게 노출되는 payload에서는 `username`을 제거
- 변경 전 handle은 별도 alias / redirect를 유지하지 않으며 `/users/:oldHandle`은 `404`

### API

#### Auth

- `POST /auth/register`
  - request: `{ username, password, displayName }`
  - response: `{ id, username, handle, displayName }`
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
  - response: `{ id, username, handle, displayName }`
  - success: `200`
  - error: `401`

#### User / Profile

- `GET /users/{handle}`
  - response: `{ id, handle, displayName, bio, profileImage }`
  - success: `200`
  - error: `401`, `404`

- `PATCH /users/me`
  - request: `{ handle?, displayName?, bio?, profileImage? }`
  - response: `{ username, handle, displayName, bio, profileImage }`
  - success: `200`
  - error: `400` validation, `401`, `409` duplicate handle

- `GET /users?query=...`
  - `handle` 또는 `displayName` 검색
  - `query`: trim 후 1~50자
  - response: `[{ handle, displayName, profileImage }]`
  - success: `200`
  - error: `400` validation, `401`
  - 검색 결과 없음: `200 []`

#### Conversation

- `POST /conversations`
  - request: `{ targetHandle }`
  - `targetHandle`: handle validation 규칙 적용
  - response: `{ id, participants, createdAt, lastActivityAt }`
  - `participants` user shape: `{ id, handle, displayName, profileImage }`
  - 새 대화 생성: `201`
  - 기존 대화 반환: `200`
  - error: `400` validation / 자기 자신, `401`, `404` target user 없음

- `GET /conversations`
  - 현재 사용자의 대화 목록
  - response: `{ conversations: [{ id, otherUser, lastMessage?, lastActivityAt }], nextCursor }`
  - `otherUser` shape: `{ id, handle, displayName, profileImage }`
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
  - `participants` user shape: `{ id, handle, displayName, profileImage }`
  - success: `200`
  - error: `400` id validation, `401`, `403` participant 아님, `404`

#### Message

- `POST /conversations/{id}/messages`
  - request: `{ content }`
  - response: `{ id, content, sender, createdAt }`
  - `sender` shape: `{ id, handle, displayName, profileImage }`
  - success: `201`
  - error: `400` validation, `401`, `403` participant 아님, `404`

- `GET /conversations/{id}/messages`
  - response: `{ messages: [{ id, content, sender, createdAt }], nextCursor }`
  - `sender` shape: `{ id, handle, displayName, profileImage }`
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
- WebSocket `message.created.message.sender`는 REST message sender와 동일한 `{ id, handle, displayName, profileImage }` shape 사용

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
  - [x] register initial handle 자동 생성 + unique collision retry(max 5)
  - [x] register / auth-me self payload에 `handle` 포함
- [x] User / Profile API
  - [x] `GET /users/:handle` 공개 사용자 조회
  - [x] `GET /users?query=...` handle / displayName 검색
  - [x] `PATCH /users/me` handle 변경 + validation + duplicate handle `409`
  - [x] 공개 payload에서 `username` 제거
- [x] Conversation
  - [x] 생성 / 기존 1:1 conversation 재사용
  - [x] 생성 요청 `targetHandle` 전환
  - [x] participants / otherUser를 `{ id, handle, displayName, profileImage }`로 전환
  - [x] 목록 cursor pagination
  - [x] 상세 조회 / participant 권한 검사
- [x] Message REST
  - [x] 메시지 생성 / 조회
  - [x] sender를 `{ id, handle, displayName, profileImage }`로 전환
  - [x] participant 권한 검사
  - [x] cursor pagination
  - [x] message 생성 시 `lastActivityAt` 갱신
- [x] WebSocket
  - [x] cookie access token 인증
  - [x] 사용자별 connection registry
  - [x] `message.created`를 sender 제외 상대 connection들에 publish
  - [x] `message.created.message.sender`를 REST와 동일한 handle 기반 shape로 전환
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
  - [x] 사용자 선택 → read-only profile 이동 — 기존 `/users/:username`, handle refactor 예정
- [x] User Profile / Conversation 시작 흐름
  - [x] `UserProfilePage` read-only profile 조회 / loading / 404 / generic error
  - [x] `UserProfileNotFoundError`로 profile 404 상태 구분
  - [x] 다른 사용자 profile의 `Message` → conversation 생성/재사용 → 이동
  - [x] Message mutation success / pending / error 상태
  - [x] 현재 사용자 자신의 read-only profile에서는 `Message` 숨김
  - [x] conversation 생성 성공 시 목록 invalidate를 시작하되 refetch 완료를 기다리지 않고 즉시 navigation
  - [x] read-only profile route를 `MessagingLayout` child protected route로 연결 — 현재 `/users/:username`, `/users/:handle`로 refactor 예정
  - [x] 검색 → profile → Message → conversation → persistent sidebar 갱신 router integration
  - [x] 기능 audit / re-audit 완료 — 필수 blocker 없음
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
  - [x] profile path segment 인코딩 — 현재 username 기준, handle 기준으로 refactor 예정
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
  - [x] 사용자 검색 → read-only profile → `Message` → conversation 생성/재사용 → 채팅 진입
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
  - [x] 스타일 기초 토큰 합의
    - Tailwind CSS v4 + `@tailwindcss/vite` 유지
    - 전역 `index.css`에서 `@theme` / `@theme inline`으로 디자인 토큰 정의
    - primary palette: Forest Green (`primary-500 = #2e7d5a`)
    - neutral palette: 거의 중성에 가까운 warm/green-gray scale
    - semantic palette: `success → teal`, `danger → red`, `warning → amber`, `info → blue`
    - typography: heading `Pretendard Variable`, body `SUIT Variable`
    - 폰트 로딩: npm 패키지 설치 후 전역 CSS `@import`
    - spacing / font-size / radius / shadow / breakpoint는 Tailwind 기본 scale 사용
    - `prettier-plugin-tailwindcss` + `tailwindStylesheet: "./src/index.css"`로 Tailwind v4 custom theme class 정렬 지원
  - [x] Login / Register 폼
    - full-page `neutral-50` + centered weak card auth layout
    - Login / Register heading, field, primary submit button, secondary link, danger error box 스타일 적용
    - Login frontend validation을 backend 계약과 일치: `username 1~30`, `password 12~128`
    - Register frontend validation을 backend 계약과 일치: `username trim 1~30`, `displayName trim 1~50`, `password 12~128`
    - Register에 frontend-only `Confirm password` 추가, password mismatch validation 적용
    - `confirmPassword`는 `registerUser` API payload에서 제외하고 기존 backend request 계약 유지
    - Confirm password 추가로 깨진 기존 success / validation / API error test fixture와 helper 보완
    - Login/Register에서 반복되는 긴 FormField wrapper/input Tailwind class는 auth 범위에서 상수로 정리하고, 별도 wrapper component 추출은 보류
  - [ ] 회원가입 성공 후 Login 화면으로 이동할 때 성공 메시지 표시
  - [x] 데스크톱 메시징 2-column layout
    - `MessagingLayout`을 추가하고 protected messaging route를 nested route로 재구성
    - sidebar는 `w-80 shrink-0`, chat pane은 `flex-1 min-w-0`인 desktop 2-column shell로 구성
    - sidebar 책임을 `MessagingSidebar`로 분리
    - `/`는 대화 미선택 안내, `/conversations/:conversationId`는 같은 layout의 `Outlet`에서 렌더링
    - `/profile`도 `MessagingLayout` child route로 이동해 sidebar 유지
    - ConversationList / UserSearch / Profile / Logout sidebar는 conversation / profile route 이동 중에도 유지
    - full-height viewport는 `h-dvh` / `min-h-dvh`를 기본으로 사용
  - [x] ConversationList / desktop sidebar
    - Conversation item을 `displayName + time` 상단 행, 공개 handle, `lastMessage` 구조로 정리하는 방향으로 설계했으며 현재 UI는 identity refactor 전 `@username` 표시
    - 현재 conversation은 `NavLink`의 `aria-current="page"`와 selected style로 구분
    - `lastMessage: null`이면 `No messages yet` placeholder를 표시해 item 높이/구조 유지
    - loading / empty / pagination error / Load more 상태 스타일 정리
    - 첫/마지막 item의 focus-visible ring이 sidebar card radius와 맞도록 보완
    - `MessagingLayout` sidebar collapse / expand 추가 — 기본 `w-80`, collapsed `w-16`, width/padding transition
    - sidebar header / UserSearch / scrollable ConversationList / 하단 Profile·Logout navigation 영역 정리
    - 앱 이름 / 로고 branding은 기능 UI 완료 후 별도 작업으로 보류
  - [ ] ConversationPage / MessageList / MessageComposer
    - [x] ConversationPage header 스타일링 — `/` 고정 이동 close control, 상대 avatar / fallback initial, displayName, 공개 식별자 영역, bottom border / focus-visible
    - [ ] identity refactor 후 header의 `@username` 표시를 `@handle`로 전환
    - [ ] MessageList bubble / 시간 / loading·empty·pagination 상태
    - [ ] MessageComposer 입력 / Send 영역
  - [ ] User Search / Profile / loading / empty / error 상태
    - [x] UserSearch 결과를 ConversationList를 밀지 않는 overlay dropdown으로 전환
    - [x] combobox / listbox / option semantic 구조와 `aria-activedescendant` 적용
    - [x] keyboard navigation: ArrowDown / ArrowUp / Enter / Escape
    - [x] keyboard active option과 mouse hover의 시각적 강조 정리
    - [x] 결과가 dropdown viewport를 벗어날 때 active option 자동 스크롤
    - [x] UserSearch 외부 click 시 dropdown close
    - [x] 결과 선택 후 persistent layout에서도 dropdown close + active option reset
    - [x] reserved-character username의 UserSearch → profile route encode/decode 경계 보완 — handle refactor 시 동일 경계 재적용 예정
    - [x] 최근 선택 사용자(localStorage, 최대 5명, 중복 시 최신 순) 표시
    - [x] 빈 검색창 focus 시 recent users 표시, 입력 중에는 live search 결과 표시
    - [x] 검색 input + open dropdown을 하나의 combobox surface처럼 보이도록 radius / border 연결
    - [x] result / recent option 사이 separator 제거
    - [ ] identity refactor 후 recent user 저장 key / route를 username에서 handle로 전환
    - [ ] Profile 및 남은 loading / empty / error 상태 시각 정리
  - [ ] 모바일에서 대화 목록 ↔ 채팅 화면 전환이 가능한 기본 responsive 처리
- [ ] frontend + backend 실제 브라우저 smoke test
  - mock 없이 핵심 흐름을 처음부터 끝까지 실행
  - 테스트에서 드러나지 않는 CORS / cookie / routing / WebSocket integration 문제 확인


#### Frontend manual audit / code walkthrough

CSS 작업 전에 프론트 전체 흐름을 코드 기준으로 다시 이해하고, 읽기 어려운 부분과 작은 리팩토링 지점을 정리한다. 기능 추가보다는 기존 구현의 책임과 lifecycle을 파악하는 단계다.

- [x] 앱 진입 / 라우팅 / 인증 lifecycle
  - [x] `main.tsx` — `QueryClientProvider` / `RouterProvider` 관계 확인
  - [x] router — protected / guest-only route와 `Outlet` 흐름 확인
  - [x] `ProtectedRoute` — `auth/me`의 `undefined` / `null` / `AuthUser` 상태 의미 확인
  - [x] query / mutation error UI 공통 `UserFacingErrorMessage`로 정리
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
- [x] User Search / read-only Profile / Conversation 시작 흐름 manual audit
  - [x] `usersQuery.ts` / test — queryKey, URL query encoding, signal, 400/generic HTTP error, transport passthrough 정리
  - [x] `UserSearch.tsx` / test — trim된 검색값과 원본 input 분리, whitespace-only query 비활성화
  - [x] 사용자 선택 책임을 conversation 생성에서 encoded profile navigation으로 변경 — 당시 `/users/:username`, handle refactor 예정
  - [x] mouse click / Enter 선택 시 persistent layout에서도 dropdown close + active option reset
  - [x] auto-scroll / click-outside / reserved-character route 경계 회귀 테스트 보완
  - [x] `UserProfilePage` — read-only profile loading / success / 404 / generic error 상태
  - [x] `UserProfileNotFoundError extends UserFacingError`로 profile 404를 type-safe하게 구분
  - [x] 다른 사용자 profile의 Message mutation success / pending / error, 중복 mutation 방지
  - [x] 현재 사용자 profile에서는 Message 숨김, `/profile` 자동 redirect는 하지 않음
  - [x] conversation 생성 성공 시 conversations query exact invalidate를 시작하되 refetch 완료는 navigation의 선행조건으로 두지 않음
  - [x] 검색 → profile → Message → conversation → sidebar 갱신 router integration 및 delayed-refetch lifecycle 테스트 보완
  - [x] `createConversation.ts` / test — 200/201 success, 400/404 status-specific error, generic HTTP error, transport passthrough 유지
  - [x] 최종 re-audit 완료 — 필수 frontend blocker 없음
- [x] Profile query / mutation / page 흐름 manual audit
  - [x] `userProfileQuery.ts` / test — queryKey, path encoding, signal, 404/generic HTTP error, transport passthrough 정리 — 현재 username 기반, handle refactor 예정
  - [x] `updateUserProfile.ts` / test — PATCH 계약, 400/generic HTTP error, transport passthrough 정리
  - [x] `ProfilePage.tsx` — input field에 기존 `FormField` 재사용, profile cache 동기화 helper로 성공 lifecycle 가독성 개선
  - [x] profile form의 `bio` / `profileImage` 빈 문자열 → `null` 변환을 명시적으로 정리
  - [x] `ProfilePage.test.tsx` — 하위 query/mutation transport 중복 검증 제거 및 component observable behavior 중심으로 정리
  - [x] profile loading/form state / validation / successful update / update lifecycle 기준 semantic test 구획
  - [x] profile/auth 이전 refetch와 PATCH 성공 cache race 방어 테스트 유지
  - [x] 반복 fixture, query key, render wrapper, form interaction helper 정리
- [x] Auth form / mutation manual audit
  - [x] `login.ts` / test — POST 계약, 401 user-facing error, generic HTTP error, transport passthrough, 성공 Response 반환 계약 분리
  - [x] `LoginPage.tsx` / test — validation / pending / mutation error / navigation 책임을 component observable behavior 중심으로 정리
  - [x] 로그인 성공 시 기존 pending `auth/me`를 cancel한 뒤 fresh `auth/me` 요청을 시작하도록 보완하고 race 회귀 테스트 추가
  - [x] Login frontend validation을 backend 입력 제한과 일치시켜 과도한 username/password가 서버 400까지 가지 않도록 보완
  - [x] `registerUser.ts` / test — 201 성공, 409 username conflict, generic HTTP error, transport passthrough 계약 분리
  - [x] `RegisterPage.tsx` / test — validation / pending / 성공 navigation / user-facing fallback 책임 정리
  - [x] Register frontend validation을 backend 입력 제한과 일치시키고 username/displayName trim 반영
  - [x] Register `Confirm password` 추가 — mismatch validation은 frontend에서 처리하고 API payload에는 포함하지 않음
  - [x] Confirm password 도입으로 영향을 받은 기존 registration test input/helper를 현재 form 계약에 맞게 보완
  - [x] `logout.ts` / test — 정확한 204 성공 계약, 실패 error 변환, transport passthrough, 성공 Response 반환 검증
  - [x] `LogoutButton.tsx` / test — pending / logout 실행 / cache clear + navigation / user-facing error / generic fallback 책임 보완
  - [x] 기존 `QueryErrorMessage`를 query/mutation 공통 `UserFacingErrorMessage`로 일반화하고 동일 error rendering 패턴에 적용
- [x] Frontend test structure 최종 wrap-up
  - [x] `router.test.tsx`를 guest routes / protected routes / session lifecycle / app integration 기준으로 정리하고 하위 query/mutation transport 중복 assertion 제거
  - [x] router의 logout pending/error 등 하위 component와 중복되는 테스트를 제거하고 route 연결 / session isolation / app integration 계약만 유지
  - [x] 테스트 fixture / helper / lifecycle을 실제 사용 범위에 맞춰 `it` / nested `describe` / 최상위 suite scope로 재배치
  - [x] 반복 test utility 중 동일 책임만 `createTestQueryClient`, `createDeferred`, `jsonResponse`로 공통화
  - [x] WebSocket stub, render helper, interaction helper 등 의미가 다른 테스트 도구는 억지로 공통화하지 않음
- [x] Messaging layout 전환 후 persistent ConversationList cache 갱신 보완
  - [x] `UserProfilePage`에서 conversation 생성/재사용 성공 후 `conversationsQueryOptions.queryKey`를 exact invalidate
  - [x] conversation 목록 refetch 완료를 기다리지 않고 conversation으로 이동하며 active refetch는 persistent sidebar에서 계속 유지
  - [x] 메시지 송신 REST 성공과 WebSocket `message.created` 수신이 공통으로 거치는 `syncMessagesToCache` 이후 conversation 목록을 exact invalidate
  - [x] sidebar의 `lastMessage`, `lastActivityAt`, 정렬 순서가 송신/수신 직후 서버 기준으로 갱신되는 router integration 회귀 테스트 추가
  - [ ] WebSocket reconnect/open에서 놓친 message를 REST로 복구한 뒤 conversation 목록까지 함께 복구하는 흐름은 후속 TODO로 유지

#### Frontend test cleanup TODO

- [x] `router.test.tsx` 최근 app integration 회귀 테스트의 긴 `apiFetch.mockImplementation` path 분기 재검토
  - 직접 `if (input === ...)` 분기가 각 integration scenario의 요청 흐름을 가장 명확하게 보여주는 것으로 판단
  - 공통 path helper는 override/fallback 구조가 필요해 오히려 범용 mock abstraction에 가까워지므로 도입하지 않음
  - `emptyMessagesPage` fixture 정도만 추출 후보였으나 현재 inline object가 더 읽기 쉬워 변경하지 않음
  - 오늘 추가한 conversation list cache 회귀 테스트는 유지한 채 코드 변경 없이 cleanup 완료로 처리
- [ ] 테스트 전반의 불필요한 optional chaining / `mock.calls` 직접 접근 정리
  - 호출 자체가 계약이고 전체 인자 shape를 검증할 수 있으면 `toHaveBeenCalledWith` 등 의도가 직접 드러나는 matcher 우선 검토
  - TanStack Query `mutationFn`처럼 라이브러리가 추가 context 인자를 전달하는 경우에는 `toHaveBeenCalledTimes(1)`로 호출을 먼저 보장한 뒤 `mock.calls[0]`의 필요한 인자만 구조분해해 검증하는 패턴을 허용
  - `mock.calls[0]?.[0]`처럼 호출되지 않은 상태를 optional chaining으로 숨기는 표현은 점검하되, optional chaining이 실제 nullable/optional 상태를 표현하는 경우는 유지
  - 신규 frontend 테스트에서는 호출 횟수를 먼저 보장한 뒤 optional chaining 없이 필요한 인자만 검증하도록 `frontend/AGENTS.md`에 규칙 반영 완료
  - 단순히 assertion 실패를 TypeError로 바꾸는 식의 기계적 제거는 하지 않고 테스트의 실제 계약 기준으로 판단

#### User identity refactor — Backend 전환·최종 cleanup 완료 / Frontend 대기

UI 스타일링은 `ConversationPage` header까지 진행한 상태에서 잠시 중단했다. 공개 `username`을 제거하는 identity / API refactor 중 **backend의 기능/API 전환과 최종 cleanup을 완료했고, 전체 테스트 GREEN 및 최종 audit에서 blocker 없음**을 확인했다. Frontend 전환 전에 남은 Backend TODO를 순서대로 처리한다.

- [x] User model에 `handle` 추가 + migration / 기존 사용자 backfill
  - 최종 상태: required + unique + mutable, 최대 30자
  - 기존 dev 데이터는 migration에서 `user_<id>`로 backfill 후 `NOT NULL` + unique index 적용
  - handle validation은 API/Zod에서 관리
- [x] 회원가입 시 initial handle 자동 생성
  - `user_` + random lowercase alphanumeric 8자
  - 한 register 요청에서 이미 시도한 handle은 재사용하지 않음
  - handle unique collision은 최대 5회까지 새 handle로 재시도
  - 마지막 handle collision은 원래 Prisma `P2002`를 그대로 throw
  - username unique `P2002`는 기존 `USERNAME_ALREADY_EXISTS` ConflictError로 변환
  - password hashing은 retry와 무관하게 1회만 수행
  - handle unique `P2002` 판별의 중복 infrastructure 로직은 handle 전용 공통 helper로 추출
- [x] Auth self payload 반영
  - [x] register service / repository 흐름에 `handle` 포함
  - [x] `POST /auth/register` HTTP response `{ id, username, handle, displayName }` 계약 확인
  - [x] `GET /auth/me` response에 `handle` 추가
  - `username`은 로그인 전용 self data로 유지
- [x] 공개 User/Profile API를 username → handle로 전환
  - [x] `GET /users/:handle`
  - [x] search: `handle | displayName`, 공개 응답에서 `username` 제거
  - [x] `PATCH /users/me`에서 handle 변경 + validation + duplicate handle `409`
  - [x] handle 규칙 경계(3/30자) 및 허용 문자 성공 경로 보완
- [x] Conversation API 전환
  - [x] `targetUsername` → `targetHandle`
  - [x] participants / otherUser: `{ id, handle, displayName, profileImage }`
  - [x] 생성 201 / 기존 대화 재사용 200 / self 400 / target 404 / validation / 401 유지
  - [x] detail / list payload와 service fixture를 handle 기반 계약으로 정리
- [x] Message REST / WebSocket sender 전환
  - [x] REST sender: `{ id, handle, displayName, profileImage }`
  - [x] WebSocket `message.created.message.sender`도 REST와 동일한 shape
  - [x] sender 제외 / 상대의 모든 connection 전달 계약 유지 및 직접 검증
- [x] Backend identity refactor 최종 cleanup
  - [x] 최종 audit에서 기능 blocker 없음 확인
  - [x] 전체 TypeScript 검사 및 전체 backend 테스트 GREEN 확인
  - [x] 미사용 `UserSearchResult` export 삭제
  - [x] `searchUsers.service.test.ts`의 미사용 `findUserProfileByUsername` mock 삭제
  - `targetUsername`을 400으로 거부하는 legacy request 테스트는 회귀 테스트로 유지
- [ ] Frontend route / query / mutation / recent-users storage를 handle 계약으로 전환
  - `/users/:handle`
  - 공개 화면의 `@username` → `@handle`
  - username을 다른 사용자 payload에서 사용하지 않도록 제거
- [ ] identity refactor 전체 test / audit 완료 후 UI 스타일링 재개

#### Product / Frontend behavior TODO

- [ ] 메시지가 없는 Conversation을 대화 목록에서 제외
  - 현재는 UserSearch 선택만으로 conversation을 만들지 않고, `UserProfilePage`의 `Message`에서 Conversation 생성/재사용 후 채팅으로 진입
  - 따라서 우발적인 빈 Conversation 생성은 줄었지만, Message 진입 후 실제 메시지를 보내지 않으면 빈 Conversation은 여전히 남을 수 있음
  - MVP 후보는 Prisma schema 변경 없이 `GET /conversations` 조회 단계에서 message가 하나 이상 있는 conversation만 반환하는 방식
  - 빈 Conversation 자동 삭제나 첫 메시지 전송 시 Conversation을 생성하는 재설계는 변경 범위가 커서 우선 보류

- [ ] 1:1 대화 나가기 / 내 히스토리 지우기
  - hard delete가 아니라 사용자별 participant state(`leftAt` / `clearedAt` 등)로 모델링하는 방향 검토
  - 한 사용자가 나가도 상대방의 기존 대화 기록은 유지
  - 재진입 시 나간 사용자에게는 clear 시점 이후 메시지만 보이도록 하는 의미를 후보로 유지

#### Backend refactor TODO

- [x] Backend 전체 테스트 리팩토링 / cleanup
  - backend identity 최종 cleanup 이후 기존 테스트 전반의 fixture / 중복 / 구조를 점검하고, 동작 변경 없이 테스트 가독성·현재 타입 계약 일치·불필요한 legacy 흔적을 정리
  - [x] refresh rotation atomicity 회귀 테스트 추가: 실제 test DB에서 repository의 replacement session 생성이 unique `tokenHash` 충돌로 실패할 때, 기존 session 삭제가 rollback되고 두 기존 session이 그대로 남는 계약 검증
  - [x] 최종 검증: backend 32개 test files, 192 tests 전체 GREEN; TypeScript 검사, Prettier, `git diff --check` 통과; lint error 0
  - [x] 최종 audit blocker 없음
  - 후속 작업은 아래 Backend TODO 순서대로 진행

- [x] 사용자 검색에서 현재 로그인 사용자 제외
  - `GET /users?query=...`에서 현재 `userId`를 controller → service → repository로 전달하고 Prisma `user.findMany` 조회에서 제외
  - 기존 handle / displayName 검색 조건과 응답 shape 유지
  - integration test에 로그인 사용자와 다른 사용자가 모두 검색어에 일치하는 경우를 추가하고, service의 `query` / `currentUserId` 전달 테스트 보완
  - 관련 검색 / 대화 생성 테스트 4 files / 29 tests GREEN; 기능 audit blocker 없음
  - `POST /conversations`의 자기 자신과 대화 시작 방지 검증은 그대로 유지
  - frontend의 별도 본인 필터링은 두지 않음

- [x] 동일 participant pair의 concurrent Conversation 생성 hardening
  - 기존 conversation 조회 → 없으면 생성 과정을 하나의 Serializable transaction으로 묶고, 내부 조회·생성에 동일 transaction client 사용; schema / migration 변경 없음
  - P2034 또는 adapter `TransactionWriteConflict` 발생 시 transaction 전체를 조회부터 최대 5회 시도하고, 마지막 실패에서는 원래 error를 throw
  - participant ID 정렬로 A→B / B→A를 같은 pair로 처리
  - 기존 생성 201 / 재사용 200 / self 400 / target 404 계약 유지
  - 실제 DB 조회 후 두 요청의 최초 조회를 동기화하는 deterministic concurrent integration test 추가
  - 관련 테스트 3 files / 22 tests GREEN; 최종 audit blocker 없음
  - optional follow-up: P2034 retry 5회 소진 시 원래 error를 throw하는 경로 직접 테스트

#### 배포 전 확인

- [ ] Backend Message atomicity
  - message 저장과 `Conversation.lastActivityAt` 갱신을 하나의 원자적 작업으로 보장할지 검토 및 필요 시 보완
- [ ] WebSocket deployment security
  - cookie 인증 WebSocket upgrade 요청의 허용 `Origin` 검증

#### Post-MVP Auth hardening

- [x] refresh 일시 장애(non-401 failure, 예: 5xx)를 인증 만료(`401`)와 구분
- [ ] 이전 session에서 시작한 pending mutation / refresh가 session 전환 이후 cache, navigation, cookie 상태에 영향을 주지 않도록 방어
- [x] 로그인 성공 후 auth/me 확인이 반드시 로그인 이후 시작된 fresh 요청임을 보장

### 작업 방식

- 공통 개발 흐름, TDD, 테스트, 리팩토링 규칙은 루트 `AGENTS.md`와 `frontend/AGENTS.md` / `backend/AGENTS.md`를 기준으로 한다.
- Graft repo context graph를 도입했고 Codex MCP / hooks도 연결했다. 코드 탐색 시 루트 `AGENTS.md`의 Graft 지침을 따른다. `graft/`는 재생성 가능한 로컬 cache이며 Graft의 `tokens saved` 수치는 실제 Codex context 사용량과 동일한 측정값이 아닌 참고 추정치로 본다.
  - 2026-09-23 기준 Graft `0.19.0`, `graft check`에서 wiring graph와 코드 동기화 `OK` 확인
  - deep layer는 아직 build하지 않았으며 현재 wiring graph를 source of truth로 사용
- 이 문서는 현재 구현 상태, 프로젝트별 결정, TODO, 다음 작업 순서를 기록한다.
- GPT 세션 교체 전 이 문서의 진행상황과 다음 시작점을 최신화한다.

### 다음 시작점

- Backend / Frontend 핵심 기능 구현, 기능 단위 audit, frontend manual audit은 완료 상태다.
- UI는 desktop sidebar와 `ConversationPage` header까지 진행했고 identity refactor 때문에 잠시 중단했다.
- **Backend identity 기능/API 전환과 최종 cleanup은 완료**했다.
  - Auth self payload에 `handle` 포함
  - 공개 User/Profile API를 handle 기반으로 전환
  - Conversation request / participants / otherUser를 handle 기반으로 전환
  - Message REST / WebSocket sender를 `{ id, handle, displayName, profileImage }`로 전환
  - 미사용 `UserSearchResult` export와 `findUserProfileByUsername` test mock 정리 완료
  - backend 최종 audit에서 기능 blocker 없음 확인
- **Backend 전체 테스트 리팩토링 / cleanup 완료.** 실제 repository + test DB 기반 refresh rotation atomicity 회귀 테스트를 포함해 32개 test files의 192 tests가 모두 GREEN이다. TypeScript 검사, Prettier, `git diff --check`가 통과했고 lint error는 0개이며 최종 audit blocker는 없다.
- **사용자 검색에서 현재 로그인 사용자 제외 완료.** `GET /users?query=...`에서 현재 `userId`를 controller → service → repository로 전달하고 Prisma 조회에서 제외했다. integration / service 전달 테스트를 보완했고, 관련 검색 / 대화 생성 테스트 4 files / 29 tests GREEN 및 audit blocker 없음을 확인했다.
- **동일 participant pair의 concurrent Conversation 생성 hardening 완료.** Serializable transaction과 제한된 충돌 재시도로 중복 생성을 방지한다. deterministic concurrent integration test를 포함한 관련 테스트 3 files / 22 tests GREEN 및 최종 audit blocker 없음을 확인했다.
- **다음 즉시 시작점:** Message 저장 + `Conversation.lastActivityAt` 갱신 atomicity 검토
- 위 backend 정리 이후 Frontend identity refactor로 이동한다.
  - `/users/:handle`
  - auth/user/conversation/message query·mutation 타입과 payload handle 전환
  - recent users storage key / route를 username에서 handle로 전환
  - 공개 화면의 `@username` → `@handle`
  - 본인/상대/메시지 판별은 안정적인 user `id` 사용
- Frontend identity refactor 완료 후 UI를 다음 순서로 재개한다.
  1. MessageList bubble / 시간 / loading·empty·pagination 상태
  2. MessageComposer 입력 / Send 영역
  3. Profile / UserProfilePage 및 남은 loading / empty / error 상태 스타일
  4. 모바일 대화 목록 ↔ 채팅 화면 기본 responsive 처리
- 회원가입 성공 후 Login 화면에 성공 메시지를 표시하는 TODO는 유지한다.
- 후속 TODO:
  - 메시지가 없는 Conversation은 `GET /conversations`에서 제외하는 backend 조회 방식 우선 검토
  - WebSocket reconnect/open gap recovery가 message query뿐 아니라 conversation 목록도 갱신하도록 보완
  - 1:1 대화 나가기 / 내 히스토리 지우기 semantics 및 participant state 모델 검토
- CSS/UI 완료 후 frontend + backend 실제 브라우저 smoke test를 진행한다.
- 이후 WebSocket Origin 검증 등 배포 전 확인을 마치고 전체 테스트 / build / 최종 audit 후 배포 단계로 이동한다.
- Auth의 남은 `이전 session pending mutation / refresh` race 방어는 Post-MVP hardening으로 유지한다.

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
