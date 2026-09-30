# Messaging App — Current Status

## Current branch / phase

- Branch: `style/conversation-page`.
- Frontend desktop ConversationPage·MessageList·MessageComposer UI와 주요 메시지 상호작용을 구현했다. 다음 작업은 MessageList walkthrough이며, 그 뒤 ProfilePage·UserProfilePage UI와 mobile responsive로 진행한다.
- 진행 중인 RED/GREEN 단계는 없다. 현재 미커밋 파일은 이 문서와 ConversationPage header의 public profile 링크 및 해당 테스트(`ConversationPage.tsx`, `ConversationPage.test.tsx`)다.

## Current implementation context

- ConversationPage는 header의 상대방 displayName·@handle 영역을 `/users/:handle`로 이동하는 semantic link로 표시한다. Header·composer 사이에 MessageList의 독립 scroll region을 둔다. 관련 ConversationPage 동작은 사용자가 실제 브라우저에서 확인했다.
- MessageList는 query page를 시간순으로 펼쳐 표시하고, `currentUserId`로 own/other bubble을 구분한다. 각 메시지에는 content와 timestamp를 표시하고 날짜 구분선을 유지하며, sender 이름·handle은 bubble마다 반복하지 않는다. 내부 `overflow-y-auto` scroll은 유지하고 scrollbar만 시각적으로 숨긴다.
- MessageList의 최초 bottom scroll은 cached messages의 background refetch까지 기다린다. 초기 scroll 완료 전에는 메시지 내용을 숨긴다. 이후 새 메시지는 사용자가 bottom에 있던 경우에만 따라가고, 위쪽을 읽는 중에는 위치를 유지한다. 상단 sentinel의 automatic older pagination은 initial scroll과 refetch가 끝난 뒤 시작하며, 중복 요청을 막고 prepend 높이만큼 viewport 위치를 보정한다. 실패 시 retry UI를 제공한다.
- MessageComposer는 2줄 textarea, Send 버튼, Enter 전송·Shift+Enter 줄바꿈·IME 조합 보호를 제공한다. 첫 진입·전송 완료·conversation 전환 때 focus를 복귀시킨다. A에서 시작한 pending send는 B로 전환해도 A의 message cache에만 반영되고 계속 완료된다. B의 입력·pending UI 상태는 A의 mutation과 분리된다.
- 메시지 조회·정렬·pagination과 WebSocket/cache 및 API 계약은 유지된다. 제품·API·roadmap의 장기 결정은 `docs/project-plan.md`를 따른다.

## Latest verification

- 관련 테스트 재실행: MessageList·MessageComposer·ConversationPage 합계 47개 중 46개 통과, 1개 실패. MessageComposer와 ConversationPage 테스트는 모두 통과했다.
- 실패한 1개는 `MessageList.test.tsx`가 제거된 sender displayName·@handle의 bubble 내 표시를 여전히 기대하기 때문이다. 현재 UI 계약과 테스트 기대치가 어긋나 있다.
- Frontend `tsc -b --noEmit` 통과. MessageList·MessageComposer·ConversationPage production 파일 ESLint 통과.
- 전체 frontend test suite는 현재 변경 이후 실행하지 않았다. ConversationPage의 관련 사용자 동작은 실제 브라우저에서 확인했으나, 전체 앱의 browser smoke test를 완료한 것은 아니다.

## Next starting point

1. MessageList 코드 walkthrough: data flatten·정렬, initial bottom scroll, 새 메시지 follow, 위쪽 읽기 중 위치 유지, 상단 sentinel 기반 automatic older pagination, prepend 후 scroll 위치 보존, 각 ref/effect의 역할과 실행 순서를 점검한다.
2. Walkthrough에서 실제 필요가 확인되면 작은 리팩토링을 진행한다. 제거된 sender 표시를 기대하는 MessageList 테스트도 현재 UI 계약에 맞춰 정리해야 관련 테스트가 모두 GREEN이 된다.
3. ProfilePage·UserProfilePage UI와 mobile responsive로 진행한다.

## Deferred / known follow-ups

- 메시지가 없는 Conversation의 목록 포함 정책, WebSocket reconnect/open gap recovery 후 conversation 목록 갱신, conversation leave/history clear semantics.
- WebSocket Origin validation, 회원가입 성공 후 Login 성공 메시지, 전체 browser smoke test와 배포 전 최종 점검.
- Post-MVP: 이전 session에서 시작한 pending mutation·refresh race 방어.
