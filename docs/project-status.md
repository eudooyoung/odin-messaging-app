# Messaging App — Current Status

## Current branch

- style/conversation-page

## Current phase

- Frontend UI / CSS 진행 중. Backend·Frontend 핵심 기능과 identity/API refactor는 완료했다.
- MVP는 UI, 실제 브라우저 통합 확인, 배포 전 점검이 남아 있다.

## Recently completed

- Desktop MessagingLayout·persistent sidebar와 ConversationPage header 스타일.
- MessageList bubble/layout, timestamp, 날짜 구분선. 메시지 시간은 한국어 `오전/오후 h:mm`, 날짜 구분선은 `오늘` / `어제` / `YYYY년 M월 D일`이다.
- Backend·Frontend identity/API refactor와 관련 사용자 흐름 완료.

## Current verified state

- MessageList 관련 테스트 15개, 변경 파일 ESLint, frontend `tsc -b --noEmit` GREEN. Frontend 전체 테스트의 마지막 실행은 auto-scroll 작업 전 GREEN이었다.

## Current UI state

- ConversationPage header와 MessageList bubble/layout, timestamp, 날짜 구분선 완료.
- MessageList는 자체 scroll region을 소유한다. 최초 메시지 조회·background refetch가 끝난 뒤 conversation별로 한 번 bottom scroll한다.

## Active work / Next step

- 다음 즉시 시작점: MessageList loading·empty·pagination 상태 스타일.
- 그다음 MessageComposer 입력·Send 영역, ProfilePage·UserProfilePage 상태 UI, mobile responsive, 실제 브라우저 smoke test.

## Important current context

- Public identity 비교는 `id`를 사용한다. UI 작업에서는 기존 기능·API 계약을 유지하며 상세 제품·API 결정은 `docs/project-plan.md`를 따른다.

## Deferred / Known follow-ups

- 메시지가 없는 Conversation의 목록 처리 정책.
- WebSocket reconnect/open gap recovery 후 conversation 목록 갱신.
- Conversation leave / history clear semantics.
- WebSocket Origin validation.
- Post-MVP: 이전 session의 pending mutation·refresh race 방어.
- 회원가입 성공 후 Login 성공 메시지와 배포 전 최종 점검은 project plan의 남은 작업에 있다.
