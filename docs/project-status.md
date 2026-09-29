# Messaging App — Current Status

## Current branch

- refactor/frontend-identity

## Current phase

- Frontend UI / CSS. Backend·Frontend 핵심 기능과 identity/API refactor는 완료했다.
- MVP는 UI, 실제 브라우저 통합 확인, 배포 전 점검이 남아 있다.

## Recently completed

- Backend·Frontend의 private username / public handle identity 전환과 최종 audit.
- Frontend API 타입을 auth, users, conversations, messages 기능별로 정리하고 public identity를 공유한다.
- ProfilePage의 handle 변경 후 auth·public profile cache 동기화와 이전 요청 race 방어.
- /users/:handle 라우팅과 관련 사용자 흐름 연결.

## Current verified state

- 최근 실행한 frontend 전체 테스트와 tsc -b --noEmit 모두 GREEN.
- 문서 구조 정리 작업에서는 production/test 코드를 변경하지 않았다.

## Current UI state

- Desktop MessagingLayout과 persistent sidebar 완료.
- ConversationPage header 스타일 완료. Conversation body 스타일 작업 직전이다.

## Active work / Next step

- 현재 진행 중인 코드 작업은 없다. 다음 즉시 시작점은 MessageList 스타일이다.
1. MessageList message bubble, timestamp, loading·empty·pagination UI.
2. MessageComposer 입력·Send 영역 스타일.
3. ProfilePage·UserProfilePage와 남은 상태 UI.
4. Mobile responsive.
5. Frontend·Backend 실제 브라우저 smoke test.

## Important current context

- Public user identity는 { id, handle, displayName, profileImage }; auth self는 { id, username, handle, displayName }. username은 private 로그인 식별자다.
- Public search·profile route는 handle 기반이다. 안정적인 사용자 identity 비교는 id를 사용한다.
- UserSearch recent users는 현재 검색 응답 계약에 따라 handle로 저장·중복 제거·이동한다.
- GET public profile과 PATCH self profile response는 다른 계약이다. 상세 제품·API 결정은 messaging-app-project-plan.md를 따른다.
- UI 작업에서는 기존 기능과 API 계약을 유지하며 frontend/AGENTS.md의 스타일·테스트 규칙을 따른다.

## Deferred / Known follow-ups

- 메시지가 없는 Conversation의 목록 처리 정책.
- WebSocket reconnect/open gap recovery 후 conversation 목록 갱신.
- Conversation leave / history clear semantics.
- WebSocket Origin validation.
- Post-MVP: 이전 session의 pending mutation·refresh race 방어.
- 회원가입 성공 후 Login 성공 메시지와 배포 전 최종 점검은 project plan의 남은 작업에 있다.
