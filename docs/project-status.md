# Messaging App — Current Status

## Current branch

- `style/conversation-page`

## Current phase

- Frontend UI / CSS 진행 중. Backend·Frontend 핵심 기능과 identity/API refactor는 완료했다.
- ConversationPage의 MessageList·MessageComposer UI와 주요 상호작용을 구현했다. Profile UI, mobile responsive, 실제 브라우저 통합 확인, 배포 전 점검은 남아 있다.

## Recently completed

- MessageList: bubble/layout, timestamp·날짜 구분선, loading·empty·자동 older-pagination의 loading/error/retry UI. 직전의 추가 시각 계층 스타일 패스는 되돌려 기존 bubble 스타일을 유지했다.
- MessageList: 최초 조회·background refetch 완료 후 bottom scroll, 새 메시지 follow와 위쪽 읽기 위치 유지, older messages prepend 후 viewport 보존, 상단 sentinel 기반 자동 pagination. 일반 `Load older messages` 버튼은 없고 오류 시 retry 버튼만 표시한다.
- MessageComposer: 공통 `FormField`의 textarea variant, 2줄 `resize-none` 입력, composer 경계·neutral 배경과 Send 배치. Enter 전송, Shift+Enter 줄바꿈, IME 조합 중 Enter 비전송을 지원한다. 첫 렌더와 전송 완료 후 textarea focus를 처리한다.
- ConversationPage의 오래된 수동 pagination 버튼 테스트를 현재 사용자 흐름에 맞춰 정리했다.

## Current verified state

- MessageList 테스트 17개 GREEN.
- MessageComposer + ConversationPage 테스트 24개 GREEN. Frontend `tsc -b --noEmit` GREEN. 변경한 MessageComposer production 파일의 ESLint GREEN.
- Frontend 전체 테스트와 실제 브라우저 통합 확인은 이번 UI 작업 이후 아직 실행하지 않았다.

## Active work / Next step

- 진행 중인 RED/GREEN 단계는 없다.
- 다음 즉시 시작점: ConversationPage·MessageList·MessageComposer 기능 단위 audit. 연결된 사용자 흐름과 cache/lifecycle, 자동 pagination·focus 계약의 누락을 확인한 뒤 ProfilePage·UserProfilePage 및 남은 상태 UI 스타일로 진행한다.
- 이후 mobile responsive, 실제 브라우저 smoke test, branding과 배포 전 점검을 진행한다.

## Important current context

- MessageList가 독립 scroll region(`flex-1 min-h-0 overflow-y-auto`)을 소유한다. 메시지 조회·정렬·WebSocket/cache 및 API 계약은 변경하지 않았다.
- Public identity 비교는 `id`를 사용한다. 제품·API·roadmap의 상세 결정은 `docs/project-plan.md`를 따른다.
- 현재 미커밋 변경은 `FormField`, `MessageComposer`, `ConversationPage`의 UI·focus·keyboard 코드와 관련 테스트다.

## Deferred / Known follow-ups

- 실제 브라우저에서 초기 scroll, 새 메시지 follow, 자동 older-pagination, composer focus를 다시 확인해야 한다.
- 메시지가 없는 Conversation의 목록 처리 정책.
- WebSocket reconnect/open gap recovery 후 conversation 목록 갱신.
- Conversation leave / history clear semantics.
- WebSocket Origin validation.
- Post-MVP: 이전 session의 pending mutation·refresh race 방어.
- 회원가입 성공 후 Login 성공 메시지와 배포 전 최종 점검은 project plan의 남은 작업에 있다.
