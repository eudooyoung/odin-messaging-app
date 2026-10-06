# Messaging App — Project Plan

## 1. 현재 프로젝트 단계

- 완료: Backend·Frontend 핵심 기능, identity/API 전환, 기능 단위 audit, desktop messaging/Profile UI polish와 MessageComposer UI, Sidebar panel icon, conversation empty state와 navigation, Leaves branding·logo·favicon, 회원가입 성공 안내와 auth 실패 UX, mobile responsive와 error-state navigation, frontend error/fallback handling, 개발자/GitHub 정보 표시(dev-info).
- Browser smoke test 완료: Frontend·Backend·dev PostgreSQL 연동 확인과 발견된 404 query retry 문제 수정을 완료했다. 확인 범위는 `docs/project-status.md`에서 관리한다.
- 배포 전 hardening 완료: WebSocket cookie 인증 upgrade의 Origin validation, REST state-changing 요청의 CSRF Origin validation, backend 메시지 content의 trim 후 1~1000자 계약 정합화.
- Frontend/backend 전체 test·type-check·ESLint·production build 재검증과 최종 audit 완료. 현재 MVP 코드·계약 기준 deploy blocker 없음.
- 현재 다음 단계: Netlify + Render deploy 설정 점검 → deploy. 설정 점검과 배포는 아직 진행하지 않았다.

## 2. 요구사항 / 서비스 규칙

### Auth / User

- username과 password로 로그인한다. username은 unique, immutable, private 로그인 식별자이며 이메일 형식을 강제하지 않는다.
- handle은 unique, mutable 공개 식별자다. 사용자 URL, 검색, 대화 시작에 사용하고 @handle로 표시한다.
- displayName은 중복 가능한 표시 이름이다. 로그인 사용자만 메시징 기능을 이용한다.

### User Search

- handle 또는 displayName으로 검색한다. 전체 사용자 목록은 공개하지 않으며 검색 결과에서 현재 로그인 사용자를 제외한다.
- 선택한 사용자의 읽기 전용 프로필은 /users/:handle로 연다. 최근 선택 사용자는 로컬에 최대 5명 저장하고 handle 기준으로 중복을 제거한다.
- 자기 자신과 대화를 시작할 수 없다.

### Conversation

- 1:1 대화는 두 사용자로 구성하며 동일한 사용자 쌍에는 대화가 하나만 존재한다. 기존 대화는 재사용한다.
- Conversation list는 최근 활동순으로 상대 displayName, 마지막 메시지와 시간을 표시한다. ConversationPage header도 상대 displayName 중심으로 표시하며 공개 프로필 링크를 유지한다.
- handle/Profile ID는 검색과 공개 프로필에서 확인한다. Conversation list와 header에서는 반복 노출하지 않는다. Conversation API의 otherUser/participant identity에는 handle이 계속 포함되며, 이 결정은 데이터/API 계약 변경이 아닌 UI 표시 정책이다.
- 대화 나가기와 기록 지우기는 MVP 범위에서 제외한다.

### Message

- 텍스트 메시지만 지원한다. trim 후 빈 문자열은 허용하지 않으며 길이는 최대 1000자다.
- 참여자만 메시지를 조회하거나 보낼 수 있다. 저장·조회는 REST, 새 메시지 전달은 WebSocket을 사용한다.
- 메시지는 시간순으로 보여주고 과거 메시지는 목록 상단에서 추가로 불러온다.
- 수정·삭제, 읽음 여부, 이미지 메시지는 MVP 범위에서 제외한다.

### Profile

- 공개 프로필은 handle, displayName, bio, profileImage를 보여준다. 다른 사용자 프로필에서 Message로 대화를 시작한다.
- 본인은 /profile에서 handle, displayName, bio, profileImage를 수정한다. Domain/API 이름은 handle이며 사용자-facing 편집 label은 `Profile ID`다. 입력값에는 `@`를 포함하지 않는다. username은 공개하거나 수정하지 않는다.
- 프로필 이미지 저장 방식은 추후 결정한다.

### MVP 제외 범위

- 친구 기능, 온라인 상태, 그룹 채팅, 이메일 인증·OAuth, 비밀번호 변경·재설정.

## 3. 핵심 기술 / 도메인 / API 결정

### Identity와 데이터 모델

- User는 내부 Int id, private username, public handle, displayName, nullable bio·profileImage를 가진다.
- handle은 trim 후 3~30자의 lowercase a-z, 0-9, _, .을 허용한다. _는 양끝에 올 수 있으나 .은 양끝에 올 수 없고 연속 ..은 허용하지 않는다. 가입 시 서버가 user_와 무작위 영소문자·숫자 8자리로 초기 handle을 생성한다.
- 공개 사용자 identity는 { id, handle, displayName, profileImage }다. Conversation participant·otherUser와 Message sender가 이 shape를 사용한다. public payload에는 username을 노출하지 않는다.
- auth self 응답은 { id, username, handle, displayName }다. 로그인 전용 username을 유지한다. 안정적인 본인·상대 비교에는 user id를 사용하고 공개 URL과 검색에는 handle을 사용한다.
- 변경 전 handle의 alias나 redirect는 유지하지 않는다. /users/:oldHandle은 404다.
- Conversation은 두 participant, messages, createdAt, lastActivityAt을 가진다. 생성 시 lastActivityAt은 createdAt과 같고, 이후 메시지 시각으로 갱신하며 목록 정렬에 사용한다.
- Message는 id, content, senderId, conversationId, createdAt을 가진다. sender는 해당 대화의 participant여야 한다.
- RefreshSession은 refresh token의 SHA-256 tokenHash, userId, expiresAt을 저장한다.

### REST 계약

| Endpoint | 주요 계약 |
| --- | --- |
| POST /auth/register | { username, password, displayName } → 201 { id, username, handle, displayName }; 중복 username은 409 |
| POST /auth/login | { username, password } → 204, HttpOnly access·refresh cookies; 인증 실패는 401 |
| POST /auth/refresh | refresh rotation → 204; 실패는 401 |
| POST /auth/logout | idempotent 204 |
| GET /auth/me | { id, username, handle, displayName }; 비인증은 401 |
| GET /users/{handle} | 공개 profile { id, handle, displayName, bio, profileImage }; 없음은 404 |
| GET /users?query=... | trim된 1~50자 handle·displayName 검색 → [{ handle, displayName, profileImage }]; 결과 없으면 [] |
| PATCH /users/me | { handle?, displayName?, bio?, profileImage? } → self response { username, handle, displayName, bio, profileImage }; 중복 handle은 409 |
| POST /conversations | { targetHandle } → 새 대화 201, 기존 대화 200; { id, participants, createdAt, lastActivityAt }; self는 400, target 없음은 404 |
| GET /conversations | { conversations: [{ id, otherUser, lastMessage, lastActivityAt }], nextCursor }; lastActivityAt DESC, id DESC, cursor pagination |
| GET /conversations/{id} | { id, participants, createdAt, lastActivityAt }; 비참여자는 403, 없음은 404 |
| POST /conversations/{id}/messages | { content } → 201 { id, content, sender, createdAt } |
| GET /conversations/{id}/messages | { messages: [{ id, content, sender, createdAt }], nextCursor }; createdAt DESC, id DESC, messageId cursor |

- participants, otherUser, sender는 모두 위 공개 identity shape를 사용한다. GET public profile과 PATCH self profile response는 서로 다른 계약이다.
- Conversation 생성은 Serializable transaction으로 기존 대화 조회부터 생성까지 처리한다. 동시 충돌은 제한적으로 재시도해 같은 사용자 쌍의 중복 대화를 방지한다.
- Message 저장과 Conversation.lastActivityAt 갱신은 같은 transaction에서 처리한다. 갱신 실패 시 메시지 저장도 rollback한다.
- POST/PATCH/PUT/DELETE는 auth register/login/refresh/logout을 포함해 모든 route에서 Origin이 FRONTEND_ORIGIN과 정확히 일치해야 실행된다. 불일치·누락·null Origin은 route 실행 전에 403으로 거부한다. GET/HEAD와 OPTIONS preflight는 기존 동작을 유지하며 서버 측 검증은 CORS response header와 별개다.

### WebSocket / 인증 / Frontend 상태

- WebSocket은 upgrade Origin이 FRONTEND_ORIGIN과 정확히 일치할 때 cookie access token으로 인증한다. 불일치·누락·null Origin은 handshake를 403으로 거부한다. message.created는 sender를 제외한 상대 사용자의 연결에 publish한다. event의 message.sender는 REST sender와 동일한 공개 identity다.
- WebSocket 연결·재연결 시 REST message query로 놓친 메시지를 복구한다. 캐시 반영은 중복을 막고 createdAt DESC, id DESC 순서를 유지한다.
- 일반 기능 API는 로그인이 필요하다. /auth/me, /users/*, /conversations/*는 인증이 필요하고, 대화·메시지는 participant만 접근한다. 프로필 수정은 본인만 가능하다.
- Frontend는 앱 진입점에서 QueryClientProvider가 RouterProvider를 감싼다. 인증 source of truth는 GET /auth/me와 ["auth", "me"] query다.
- 공통 HTTP client는 credentials를 포함한다. 일반 요청의 401은 공유 refresh 요청으로 복구하고 원 요청을 한 번만 재시도한다. refresh의 401과 일시적 non-401 실패는 구분한다. 로그아웃 또는 인증 종료 시 이전 사용자의 비인증 cache를 비운다.
- ProfilePage는 현재 handle로 공개 profile을 조회한다. PATCH 성공 시 auth cache와 새 handle의 public profile cache를 동기화하고 이전 handle profile refetch 및 오래된 auth refetch가 저장 결과를 덮지 못하게 한다.

### Responsive / navigation

- Mobile(`md` breakpoint 아래)은 `/`에서 conversation list/Sidebar를 전체 폭으로 표시하고 conversation·profile route에서는 main pane만 표시한다. Desktop의 2-panel 구조와 Sidebar collapse state를 유지하며 mobile에서는 collapse 버튼을 숨긴다.
- Mobile ConversationPage의 뒤로가기 아이콘은 진입 경로와 관계없이 `/`로 이동한다. Desktop은 기존 history back을 유지한다. ProfilePage / UserProfilePage는 `×`로 닫고 mobile·desktop 모두 기존 history navigation을 유지한다.
- Conversation·Profile 계열의 mobile padding을 조정했으며, 조회 error 상태에서도 기존 header/navigation escape hatch와 오류 안내를 제공한다.

### 기술 스택

- Backend: Node.js 24, TypeScript·ESM, Express 5, PostgreSQL, Prisma 7, JWT, Argon2id, ws, Zod, Vitest·Supertest.
- Frontend: React 19, TypeScript, Vite 8, React Router, TanStack Query, native WebSocket, React Hook Form, Zod, Tailwind CSS, Vitest, React Testing Library.

## 4. 구현 상태

### Backend

- [x] Auth: register, login, refresh rotation, logout, auth self, HttpOnly cookies.
- [x] User/Profile: handle 기반 공개 검색·조회, self 수정, 초기 handle 생성 및 중복 처리.
- [x] Conversation: 생성·재사용, 목록·상세, pagination, participant 권한.
- [x] Message: 생성·조회, pagination, participant 권한.
- [x] WebSocket: 인증, 사용자별 연결, message.created 전달, reconnect에 필요한 서버 계약.
- [x] Identity/API refactor: private username과 public handle 계약 전환.
- [x] Concurrency / atomicity hardening: 동시 대화 생성과 Message 저장·lastActivityAt 갱신의 transaction 보장.
- [x] Origin security hardening: WebSocket upgrade Origin 검증과 REST state-changing 요청의 CSRF Origin 검증.
- [x] Message validation 정합화: backend content의 trim 후 1~1000자 계약과 관련 integration test 검증 완료.

### Frontend

- [x] Auth: auth self query, protected·guest route, login·register·logout, refresh와 session cache lifecycle.
- [x] User Search / Profile: handle 기반 검색·recent users·public route·읽기 전용 프로필·대화 시작; self profile 조회·수정.
- [x] Conversation: 목록·상세·pagination, 선택과 persistent sidebar 갱신.
- [x] Message: 목록·전송·pagination, cache sync와 REST race 처리.
- [x] WebSocket: runtime validation, 실시간 cache 반영, 연결 복구·재연결.
- [x] Identity/API refactor: public identity, auth self, GET public profile과 PATCH self response 구분, handle 변경 cache lifecycle.
- [x] Desktop messaging layout / sidebar와 ConversationPage header.
- [x] Messages / MessageComposer UI: message bubble, timestamp·날짜 구분선, loading·empty·pagination UI, 메시지 입력·Send 영역.
- [x] ProfilePage·UserProfilePage desktop UI: Profile ID 편집과 기존 messaging theme의 typography/color/spacing.
- [x] Conversation list·header 표시 정책: handle 반복 노출 제거, displayName 중심 표시와 기존 navigation 유지.
- [x] Sidebar panel SVG icon과 conversation 미선택 empty state, ConversationPage desktop history 뒤로가기.
- [x] Leaves branding: Sidebar logo·앱 이름의 홈 링크, 동일한 3-leaf SVG mark의 favicon 적용.
- [x] Desktop primary 상태 스타일: Conversation hover/selected, Search focus, Sidebar toggle·뒤로가기 hover/focus, empty state icon.
- [x] Desktop UI polish: Content width/header 정렬, loading/error 표현, profile card와 MessageComposer 입력 영역·action 정렬.
- [x] 회원가입 성공 후 LoginPage의 일회성 성공 안내.
- [x] Auth 확인 실패 시 app-level error와 수동 Retry; 기존 WebSocket 자동 recovery 유지와 수동 재시도 조율.
- [x] UI/CSS: Mobile responsive와 Conversation·Profile error-state navigation.
- [x] Error/fallback handling: Catch-all 404와 사용자용 route error fallback, invalid conversation id의 navigation 유지, Profile save의 일반 오류 fallback. 기존 resource-not-found·403·query error와 auth recovery 계약 유지.
- [x] Dev-info: 로그인 후 MessagingSidebar 하단, 로그인 전 LoginPage / RegisterPage auth card 아래에 `Built by Dooyoung Kim · GitHub` 표시. 전역 footer와 conversation/profile 본문에는 추가하지 않으며 Sidebar collapsed 상태에서는 숨긴다. GitHub 링크는 `https://github.com/eudooyoung/odin-messaging-app`이다.

## 5. 남은 작업

### MVP — 우선순위

1. Netlify + Render deploy 설정을 점검한다.
2. 배포한다.

### Product / behavior follow-up

- 메시지가 없는 Conversation의 목록 포함 정책 결정. 후보는 GET /conversations에서 메시지가 있는 대화만 반환하는 방식이다.
- WebSocket reconnect/open gap recovery가 message query 복구 후 conversation 목록도 갱신하도록 보완.
- 1:1 conversation 나가기·내 기록 지우기의 participant state와 재진입 시 보이는 기록 범위 결정.
- 선택적 계약 정리: handle trim의 문서/API 정규화 책임. Frontend는 trim하고 backend PATCH validation은 공백 포함 handle을 거부한다. 현재 frontend 사용자 흐름은 정상이며 deploy blocker가 아니다.

### Deploy / hardening

- [x] WebSocket cookie 인증 upgrade 요청의 허용 Origin 검증.
- [x] REST POST/PATCH/PUT/DELETE의 서버 측 CSRF Origin 검증(auth endpoint 포함).
- [x] Backend 메시지 content의 trim 후 1~1000자 계약 정합화.
- [x] Frontend/backend 전체 test·type-check·ESLint·production build 재검증과 최종 audit. 현재 MVP 코드·계약 기준 deploy blocker 없음.
- [ ] Netlify + Render 환경·URL·CORS·cookie·production DB migration·hosting 설정 점검 후 배포.
- Post-MVP auth hardening: 이전 session에서 시작한 pending mutation·refresh가 session 전환 후 cache·navigation·cookie에 영향을 주지 않도록 방어.
- 선택적 maintenance: frontend 테스트의 불필요한 mock 호출 접근 정리와 대화 생성 충돌 재시도 한도 소진 경로 검증.

## 6. 배포 / 인증 정책

- Frontend는 Netlify, Backend는 Render에 서로 다른 site로 배포한다. Production은 cross-site credential 요청을 전제로 한다.
- Access Token cookie: HttpOnly, Path=/, 15분. Refresh Token cookie: HttpOnly, Path=/auth, 7일.
- Development cookie: Secure=false, SameSite=Lax. Production cookie: Secure=true, SameSite=None. JWT exp와 cookie Max-Age는 같은 수명으로 맞춘다.
- Backend CORS는 Netlify frontend origin을 명시하고 credentials: true를 사용한다. credential 요청에 Access-Control-Allow-Origin: *를 사용하지 않는다.
- Frontend HTTP 요청은 credentials: "include"를 사용한다.
