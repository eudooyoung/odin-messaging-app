# Messaging App — Current Status

## Current branch / phase

- Branch: `feat/error-pages`. HEAD: `2fc1147` (`feat(profile): add error handling for profile update failures`).
- Frontend desktop UI polish와 mobile responsive, Leaves branding, 회원가입 성공 안내와 auth 실패 UX 및 recovery 조율, error/fallback handling은 완료됐다.
- 개발자/GitHub 정보 표시가 완료됐다. 다음 즉시 시작점은 Frontend·Backend를 연결한 실제 browser smoke test다. MVP와 배포는 아직 완료되지 않았다.

## Current implementation context

### Profile

- `/profile`에서 handle, displayName, bio, profileImage를 편집한다. 사용자-facing label은 `Profile ID`, 내부 form/API 이름은 `handle`이다. 입력값에는 `@`를 포함하지 않고 `Used in your @ID and profile URL.` 설명을 표시한다.
- Handle은 trim 후 3~30자, lowercase a-z·0-9·_·.만 허용한다. period는 처음/끝에 올 수 없고 연속 `..`도 금지한다.
- PATCH `/users/me` 성공 시 서버 응답으로 form을 reset하고 auth cache와 새 handle의 public profile cache를 동기화한다. 이전 handle profile refetch 및 오래된 auth refetch가 저장 결과를 덮지 못하도록 lifecycle을 유지한다. Refetch와 mutation 실패 후에도 dirty handle을 포함한 미저장 입력을 보존한다.
- Frontend mutation은 409 duplicate handle을 `This handle is already taken` UserFacingError로 해석한다. 기존 400·기타 HTTP 오류 처리와 transport error passthrough는 유지한다.
- ProfilePage는 `Profile` h2와 네 편집 필드, Save profile로 구성된다. UserProfilePage는 displayName h2, @Profile ID, bio, 이미지가 있을 때의 원형 avatar와 타인에게만 표시되는 Message action을 제공한다. 두 화면은 같은 max-width/responsive padding과 messaging theme를 사용한다.

### Messaging / navigation / branding

- `Built by Dooyoung Kim · GitHub`를 Sidebar의 My profile / Log out 아래와 LoginPage / RegisterPage auth card 아래에 표시한다. GitHub는 `https://github.com/eudooyoung/odin-messaging-app`을 새 탭으로 여는 외부 링크다. 작은 neutral 텍스트와 primary hover/focus를 사용한다.
- Sidebar 정보는 기존 콘텐츠 영역의 responsive/collapse 규칙을 따른다. Desktop 접힘 상태에서는 숨기고 mobile `/`에서는 표시하며 mobile conversation/profile에서는 Sidebar와 함께 숨긴다. 본문에는 추가하지 않고 전역 footer나 공통 layout도 도입하지 않는다. Auth는 `min-h-dvh`와 기존 padding을 유지하며 카드와 정보를 세로 중앙 정렬한다.
- Conversation list와 header는 displayName 중심으로 표시하고 `@handle`을 반복 노출하지 않는다. Handle/Profile ID는 검색과 공개 프로필에서 확인한다. Header의 공개 프로필 링크와 API/query의 handle 계약은 유지한다.
- Desktop Sidebar collapse/expand는 기존 SVG panel asset을 사용한다. 펼침 상태에는 collapse, 접힘 상태에는 expand icon을 표시하며 accessible name과 toggle 동작을 유지한다.
- 앱 이름은 `Leaves`다. Sidebar의 24px 장식용 3-leaf logo mark와 텍스트 전체가 하나의 `/` 홈 링크다. 같은 `leaves-logo-mark.svg`를 `index.html`의 favicon에 참조하고 document title도 Leaves다.
- Desktop Conversation 미선택 화면은 중앙 chat icon, `Select a conversation` 제목과 Sidebar 검색을 안내하는 보조 문구를 표시한다. Router index route는 `ConversationEmptyState`를 렌더링하며 mobile에서는 main pane이 숨겨진다. 별도 CTA는 없다.
- Conversation hover/selected, Search users input focus, Sidebar toggle hover/focus, empty state icon, ConversationPage 뒤로가기 hover/focus에 primary 색상이 반영되어 있다. Conversation 본문 typography는 neutral을 유지한다.
- Messages의 initial scroll·follow·prepend 위치 보존·older pagination과 MessageComposer의 Enter/Shift+Enter/IME 보호, pending 조건, focus 복귀, 이전 대화 pending send의 cache 분리는 유지한다.

### MessageComposer / desktop UI — complete

- MessageComposer는 텍스트 `Send` 버튼을 사용한다. Textarea는 한 줄 높이로 시작해 내용에 따라 늘어나고, 최대 높이 이후 내부 스크롤을 사용한다. Grid의 `items-end` 정렬과 textarea `block`으로 입력 영역과 버튼의 아래선을 맞춘다.
- Send는 white 배경과 primary text/border, 옅은 primary hover, neutral disabled 상태를 사용한다. Own bubble은 `primary-600 + white`, other bubble은 neutral 계열을 유지한다.
- Desktop content width/header 정렬, profile content card, loading/error 위치, timestamp 가독성과 interactive state polish는 완료됐다. Frontend·Backend를 연결한 전체 browser smoke test는 별도로 남아 있다.

### Mobile responsive — complete

- `md` breakpoint 아래에서는 `/`의 conversation list/Sidebar를 전체 폭으로 표시한다. Conversation·profile route에서는 Sidebar를 숨기고 main pane만 전체 폭으로 표시한다. Desktop은 기존 Sidebar + main pane의 2-panel 구조를 유지한다.
- Mobile에서는 Sidebar collapse 버튼을 숨긴다. Desktop에서 Sidebar를 접었더라도 mobile에서는 검색·대화 목록·profile·logout이 표시되며 기존 collapse state는 보존한다.
- ConversationPage의 뒤로가기 아이콘(`←`, `<` 의미)은 mobile에서 진입 경로와 관계없이 conversation list(`/`)로 이동한다. Desktop은 기존 `navigate(-1)`을 유지한다.
- ProfilePage / UserProfilePage는 mobile·desktop 모두 `×`와 `Close profile`을 사용하며 기존 history navigation(`navigate(-1)`)을 유지한다.
- Conversation header·Messages list·Composer wrapper의 mobile 좌우 padding을 줄이고 desktop padding은 유지한다. Profile 계열도 공통 기준으로 content wrapper의 mobile 좌우·상하 padding과 card padding을 줄였다.
- ConversationPage / ProfilePage / UserProfilePage는 조회 error 상태에서도 header/navigation escape hatch를 유지하며 content 영역에 기존 danger 오류 안내를 표시한다. Loading과 정상 화면의 기능 동작은 유지한다.
- iPhone SE급 세로·가로 화면 기준 주요 UI 확인은 완료됐다(사용자 확인).

### Error / fallback handling — complete

- 존재하지 않는 URL은 인증 guard 밖의 catch-all route에서 로그인 여부와 관계없이 동일한 `Page not found` 화면과 `/` 홈 링크를 표시한다.
- Unexpected route/render error는 최상위 route의 `errorElement`에서 `Something went wrong`과 홈 링크를 표시한다. 내부 error message와 React Router 기본 오류 화면은 사용자에게 노출하지 않으며, 홈 이동 후 기존 인증 상태에 따라 protected home 또는 login 흐름으로 복귀한다.
- 없는 user / conversation은 기존 feature UI의 `Profile not found` / `Conversation not found`로 처리한다. Conversation 403과 일반 query error의 사용자용 안내 및 header/navigation은 유지한다.
- Invalid conversation id는 API 요청 없이 `Invalid conversation`을 본문에 표시하며 header와 `Close conversation`을 유지한다. Mobile은 `/`, desktop은 기존 history back으로 이동한다.
- Profile save는 기존 `UserFacingErrorMessage`를 사용한다. Duplicate handle 등 사용자용 오류 메시지는 유지하고 transport / 일반 Error에는 `Failed to update profile`을 표시한다. Validation, 미저장 입력 보존, 성공 후 reset/cache 동기화와 기존 auth error/recovery 계약은 유지한다.

### Auth UX / recovery — complete

- 회원가입 성공 후 LoginPage에 `Registration successful. You can now log in.`을 success 색상으로 표시한다. 직접 진입에서는 표시하지 않고, 안내를 소비한 뒤 이후 방문에 남지 않게 한다.
- Auth 확인 실패 시 정상 app layout/sidebar 대신 viewport 중앙에 `Unable to connect to the server`와 `Retry`를 표시한다. 재시도 성공 시 인증 상태에 맞는 기존 route 흐름으로 복귀한다.
- 이미 시작된 WebSocket recovery는 auth error 화면에서도 유지된다. 수동 Retry를 누르지 않으면 기존 실패 후 1초 자동 recovery retry가 계속되며, 비인증 응답 또는 route unmount 시 종료된다.
- 수동 Retry가 예약된 recovery보다 먼저 성공하면 WebSocket을 즉시 재연결하고 남은 예약 조회를 취소한다. 진행 중 자동 recovery 요청이 있으면 수동 Retry가 이를 취소하지 않고 합류한다. 중복 auth 조회 문제는 보완됐으며 기존 auth/query/refresh 계약과 자동 retry 정책은 유지한다.

## Latest verification

- 개발자/GitHub 정보 추가 후 기존 Sidebar·LoginPage·RegisterPage·router 테스트 4개 파일, 45개 테스트 통과. 변경한 production 파일 3개의 Prettier·ESLint 검사 통과. 새 테스트는 추가하지 않았으며 실제 브라우저 responsive 확인은 남아 있다.
- Frontend 전체 33개 파일, 296개 테스트 통과. 기존 app·node TypeScript 설정의 `--noEmit` 검사와 error-handling 관련 production 파일 lint 검사 통과.
- Error/fallback handling audit에서 필수 blocker는 발견되지 않았다. iPhone SE급 주요 UI 확인은 완료됐다. Frontend·Backend를 연결한 실제 browser smoke test와 배포 전 frontend/backend 전체 테스트·build·최종 audit는 남아 있다.

## Next starting point

1. Frontend·Backend를 연결한 실제 browser smoke test로 가입·로그인·auth 복구, profile 편집·공개 profile·대화 흐름과 CORS/cookie/routing/WebSocket 및 개발자 정보의 responsive 표시를 확인한다.
2. 배포 전 전체 테스트·build·최종 audit와 배포 점검을 수행한다.
3. 배포한다.

## Deferred / known follow-ups

- 메시지가 없는 Conversation의 목록 포함 정책, WebSocket reconnect/open gap recovery 후 conversation 목록 갱신, conversation leave/history clear semantics.
- WebSocket Origin validation, 전체 browser smoke test와 배포 전 최종 점검.
- Post-MVP: 이전 session에서 시작한 pending mutation·refresh race 방어.
