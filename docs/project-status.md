# Messaging App — Current Status

## Current branch / phase

- Branch: `style/conversation-page`.
- Frontend desktop ConversationPage·Messages·MessageComposer UI와 주요 메시지 상호작용 구현을 완료했다. Messages 전체 코드 walkthrough, scroll 훅 분리, `Messages.test.tsx` 전체 테스트 리뷰·리팩토링도 완료했다.
- 다음 즉시 작업은 ProfilePage·UserProfilePage UI다. 이후 mobile responsive와 전체 browser smoke test로 진행한다. MVP와 배포는 아직 완료되지 않았다.
- MessageList → Messages 명칭 변경과 `useMessagesScroll.ts` 분리는 커밋되어 있다. 현재 미커밋 파일은 `frontend/src/features/messages/Messages.test.tsx`, `docs/project-status.md`, `docs/project-plan.md`다. Production 코드의 미커밋 변경은 없다. 이번 마무리 작업에서는 문서만 수정했다.

## Current implementation context

- ConversationPage는 header의 상대방 displayName·@handle 영역을 `/users/:handle`로 이동하는 semantic link로 표시한다. Header·composer 사이에 Messages의 독립 scroll region을 둔다.
- Messages는 query page를 시간순으로 펼쳐 표시하고, `currentUserId`로 own/other bubble을 구분한다. 각 메시지에는 content와 timestamp를 표시하고 날짜 구분선을 유지하며, sender 이름·handle은 bubble마다 반복하지 않는다. 내부 `overflow-y-auto` scroll은 유지하고 scrollbar만 시각적으로 숨긴다.
- 최초 bottom scroll은 cached messages의 background refetch까지 기다린다. 초기 scroll 완료 전에는 메시지 내용을 숨긴다. 이후 새 메시지는 사용자가 bottom에 있던 경우에만 따라가고, 위쪽을 읽는 중에는 위치를 유지한다. 상단 sentinel의 automatic older pagination은 initial scroll과 refetch가 끝난 뒤 시작하며, 중복 요청을 막고 prepend 높이만큼 viewport 위치를 보정한다. 실패 시 retry UI를 제공한다.
- MessageComposer는 2줄 textarea, Send 버튼, Enter 전송·Shift+Enter 줄바꿈·IME 조합 보호를 제공한다. 첫 진입·전송 성공·conversation 전환 때 focus를 복귀시킨다. A에서 시작한 pending send는 B로 전환해도 A의 message cache에만 반영되고 계속 완료된다. B의 입력·pending UI 상태는 A의 mutation과 분리된다.
- 메시지 조회·정렬·pagination과 WebSocket/cache 및 API 계약은 유지된다. 제품·API·roadmap의 장기 결정은 `docs/project-plan.md`를 따른다.

## Completed review / current structure

- `frontend/src/features/messages/Messages.tsx`는 `useInfiniteQuery`, `flatMap(...).reverse()` 데이터 가공과 JSX를 담당한다. `flatMap`이 만든 새 배열을 뒤집으므로 query cache 배열은 직접 변경하지 않는다. `useMemo` 적용을 검토했지만 현재 성능상 필요성이 확인되지 않아 기존 구현을 유지한다.
- `frontend/src/features/messages/useMessagesScroll.ts`는 초기 scroll·메시지 표시 상태, follow, prepend 위치 보존, older 요청 snapshot, Observer 등록·cleanup을 담당한다. Query data와 관련 상태를 인자로 받고 `scrollRegionRef`, `sentinelRef`, `handleLoadOlderMessages`, `showMessages`를 반환한다.
- 훅 내부에는 `MessagesSnapshot`·`ScrollSnapshot` 타입과 `messagesSnapshotRef`·`scrollSnapshotRef`, `initialScrollRef`, `scrollRegionRef`, `sentinelRef`가 있다. Observer 생성 조건과 callback 조건은 분리된 상태이며 공통 함수로 추출하지 않았다.
- `Messages.test.tsx` 전체 리뷰를 완료했다. 초기 refetch 대기·메시지 숨김·bottom scroll 검증을 통합하고, 불필요한 내부 상태 assertion·대기를 제거했으며, scroll dimension 및 IntersectionObserver stub을 재사용하도록 정리했다. Timestamp·날짜 구분선, 새 메시지 follow·위쪽 읽기 위치 유지, 자동 pagination·중복 요청 방지·prepend viewport 보존·error/retry 관련 테스트도 리뷰했다.
- `useMessagesScroll` 별도 테스트는 기존 컴포넌트 테스트와 중복되므로 현재 추가하지 않기로 결정했다.

## Latest verification

- 현재 작업 트리 기준 `Messages.test.tsx`, `MessageComposer.test.tsx`, `ConversationPage.test.tsx`: 3개 파일·46개 테스트 모두 통과.
- Frontend `npx tsc -b --noEmit` 및 전체 `npm run lint` 통과.
- 최신 테스트 리팩토링 이후 frontend 전체 test suite는 이번에 실행하지 않았다. 이전 전체 suite 검증은 리팩토링 전 32개 파일·261개 테스트 통과였으며 현재 작업 트리 전체의 검증 결과로 간주하지 않는다.
- Backend 테스트는 이번 문서 갱신에서 실행하지 않았다.
- ConversationPage의 관련 사용자 동작은 사용자가 실제 브라우저에서 확인했다. 전체 앱의 browser smoke test는 아직 남아 있다.

## Next starting point

1. ProfilePage·UserProfilePage의 현재 구현·테스트와 남은 loading·empty·error 상태 UI를 확인하고 스타일 작업을 진행한다.
2. 대화 목록과 채팅 화면을 전환할 수 있는 mobile responsive를 진행한다.
3. 남은 UI 완료 후 branding을 정리하고, Frontend·Backend를 연결한 전체 browser smoke test와 배포 전 점검을 진행한다. 회원가입 성공 후 Login 성공 메시지는 smoke test 전에 보완한다.

## Deferred / known follow-ups

- 메시지가 없는 Conversation의 목록 포함 정책, WebSocket reconnect/open gap recovery 후 conversation 목록 갱신, conversation leave/history clear semantics.
- WebSocket Origin validation, 회원가입 성공 후 Login 성공 메시지, 전체 browser smoke test와 배포 전 최종 점검.
- Post-MVP: 이전 session에서 시작한 pending mutation·refresh race 방어.
