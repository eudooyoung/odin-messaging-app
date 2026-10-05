# Messaging App — Current Status

## Current branch / phase

- Branch: `style/polish`. HEAD: `1922a3c` (`test(AuthenticatedWebSocket): add manual retry test for reconnection`).
- Frontend desktop messaging/Profile UI polish, MessageComposer UI, Leaves branding, 회원가입 성공 안내와 auth 실패 UX는 완료됐다.
- 다음 즉시 시작점은 mobile responsive다. 아직 시작하지 않았으며 MVP와 배포도 완료되지 않았다.
- Auth recovery 조율 보완은 현재 작업 트리에 반영되어 있으며 아직 커밋되지 않았다.

## Current implementation context

### Profile

- `/profile`에서 handle, displayName, bio, profileImage를 편집한다. 사용자-facing label은 `Profile ID`, 내부 form/API 이름은 `handle`이다. 입력값에는 `@`를 포함하지 않고 `Used in your @ID and profile URL.` 설명을 표시한다.
- Handle은 trim 후 3~30자, lowercase a-z·0-9·_·.만 허용한다. period는 처음/끝에 올 수 없고 연속 `..`도 금지한다.
- PATCH `/users/me` 성공 시 서버 응답으로 form을 reset하고 auth cache와 새 handle의 public profile cache를 동기화한다. 이전 handle profile refetch 및 오래된 auth refetch가 저장 결과를 덮지 못하도록 lifecycle을 유지한다. Refetch와 mutation 실패 후에도 dirty handle을 포함한 미저장 입력을 보존한다.
- Frontend mutation은 409 duplicate handle을 `This handle is already taken` UserFacingError로 해석한다. 기존 400·기타 HTTP 오류 처리와 transport error passthrough는 유지한다.
- ProfilePage desktop UI는 `Profile` h2와 네 편집 필드, 오른쪽 정렬 Save profile로 구성된다. UserProfilePage는 displayName h2, @Profile ID, bio, 이미지가 있을 때의 원형 avatar와 타인에게만 표시되는 Message action을 제공한다. 두 화면은 같은 max-width/padding과 messaging theme를 사용한다.

### Messaging / navigation / branding

- Conversation list와 header는 displayName 중심으로 표시하고 `@handle`을 반복 노출하지 않는다. Handle/Profile ID는 검색과 공개 프로필에서 확인한다. Header의 공개 프로필 링크와 API/query의 handle 계약은 유지한다.
- Sidebar collapse/expand는 기존 SVG panel asset을 사용한다. 펼침 상태에는 collapse, 접힘 상태에는 expand icon을 표시하며 accessible name과 toggle 동작을 유지한다.
- 앱 이름은 `Leaves`다. Sidebar의 24px 장식용 3-leaf logo mark와 텍스트 전체가 하나의 `/` 홈 링크다. 같은 `leaves-logo-mark.svg`를 `index.html`의 favicon에 참조하고 document title도 Leaves다.
- Conversation 미선택 화면은 중앙 chat icon, `Select a conversation` 제목과 Sidebar 검색을 안내하는 보조 문구를 표시한다. Router index route는 inline JSX 대신 `ConversationEmptyState`를 렌더링한다. 별도 CTA는 없다.
- ConversationPage의 `Close conversation` 링크는 클릭 시 이전 history entry로 돌아간다. 홈 이동이나 direct-entry fallback은 추가하지 않았다.
- Conversation hover/selected, Search users input focus, Sidebar toggle hover/focus, empty state icon, ConversationPage 뒤로가기 hover/focus에 primary 색상이 반영되어 있다. Conversation 본문 typography는 neutral을 유지한다.
- Messages의 initial scroll·follow·prepend 위치 보존·older pagination과 MessageComposer의 Enter/Shift+Enter/IME 보호, pending 조건, focus 복귀, 이전 대화 pending send의 cache 분리는 유지한다.

### MessageComposer / desktop UI — complete

- MessageComposer는 텍스트 `Send` 버튼을 사용한다. Textarea는 한 줄 높이로 시작해 내용에 따라 늘어나고, 최대 높이 이후 내부 스크롤을 사용한다. Grid의 `items-end` 정렬과 textarea `block`으로 입력 영역과 버튼의 아래선을 맞춘다.
- Send는 white 배경과 primary text/border, 옅은 primary hover, neutral disabled 상태를 사용한다. Own bubble은 `primary-600 + white`, other bubble은 neutral 계열을 유지한다.
- Desktop content width/header 정렬, profile content card, loading/error 위치, timestamp 가독성과 interactive state polish는 완료됐다. 현재 표현을 기준으로 mobile responsive를 진행한다. 실제 브라우저 smoke test는 별도로 남아 있다.

### Auth UX / recovery — complete

- 회원가입 성공 후 LoginPage에 `Registration successful. You can now log in.`을 success 색상으로 표시한다. 직접 진입에서는 표시하지 않고, 안내를 소비한 뒤 이후 방문에 남지 않게 한다.
- Auth 확인 실패 시 정상 app layout/sidebar 대신 viewport 중앙에 `Unable to connect to the server`와 `Retry`를 표시한다. 재시도 성공 시 인증 상태에 맞는 기존 route 흐름으로 복귀한다.
- 이미 시작된 WebSocket recovery는 auth error 화면에서도 유지된다. 수동 Retry를 누르지 않으면 기존 실패 후 1초 자동 recovery retry가 계속되며, 비인증 응답 또는 route unmount 시 종료된다.
- 수동 Retry가 예약된 recovery보다 먼저 성공하면 WebSocket을 즉시 재연결하고 남은 예약 조회를 취소한다. 진행 중 자동 recovery 요청이 있으면 수동 Retry가 이를 취소하지 않고 합류한다. 중복 auth 조회 문제는 보완됐으며 기존 auth/query/refresh 계약과 자동 retry 정책은 유지한다.

## Latest verification

- Auth error UX와 WebSocket recovery 관련 테스트, frontend `tsc -b` 검사 통과. 변경된 auth production 파일의 lint도 통과했다.
- 위 결과는 관련 범위의 검증이다. 현재 상태의 전체 frontend/backend suite, build와 browser smoke test는 최종 검증으로 남아 있다.

## Next starting point

1. 대화 목록과 채팅 화면을 전환할 수 있는 mobile responsive를 진행한다. Profile과 auth 화면도 작은 화면의 사용 흐름을 확인한다.
2. Frontend·Backend를 연결한 전체 browser smoke test로 가입·로그인·auth 복구, profile 편집·공개 profile·대화 흐름과 CORS/cookie/WebSocket을 확인한다.
3. 배포 전 전체 테스트·build·최종 audit와 배포 점검을 진행한다.

## Deferred / known follow-ups

- 메시지가 없는 Conversation의 목록 포함 정책, WebSocket reconnect/open gap recovery 후 conversation 목록 갱신, conversation leave/history clear semantics.
- WebSocket Origin validation, 전체 browser smoke test와 배포 전 최종 점검.
- Post-MVP: 이전 session에서 시작한 pending mutation·refresh race 방어.
