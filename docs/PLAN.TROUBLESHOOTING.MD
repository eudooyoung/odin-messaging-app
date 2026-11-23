# Leaves — Backend Troubleshooting Plan

## 1. 목적과 작업 범위

- **목표**
  - Leaves 메시징 앱에서 실제로 발생 가능한 백엔드 결함을 재현하고, 원인 분석 → 최소 수정 → 회귀 방지까지 검증한다.
  - 단순 기능 추가나 형식적인 리팩토링보다 데이터 정합성·장애 대응·동시성 문제를 우선한다.
  - 이력서에 활용할 때는 **문제 발생 조건, 재현 증거, 수정 전후 비교, 검증 범위**를 제시한다.
- **범위**
  - 우선: 백엔드 REST API, PostgreSQL/Prisma, 트랜잭션, 인증·인가, WebSocket, 서버 생명주기.
  - 필요할 때만: 프론트엔드의 재시도·캐시·재연결 동작과 Render/Neon 운영 경계.
  - 제외: 별도 합의 없는 대규모 인프라 도입, 신규 기능 확장, 무관한 리팩토링.
- **문서 성격**
  - 이 문서는 **조사 후보와 검증 계획**이며, 확정된 제품/API 계약이 아니다.
  - 확정 계약과 로드맵의 SSOT는 [project-plan.md](./project-plan.md), 세션 상태의 SSOT는 [project-status.md](./project-status.md).
  - 실제 재현·구현 결과에 따라 이 문서의 가설과 우선순위를 갱신한다.

## 2. 조사 출처와 현재 확인 수준

- **Codex 1차 조사**
  - 정적 소스·테스트 분석으로 후보 8개 도출.
  - 지정된 기존 troubleshooting 문서는 참고하지 않고 독립 분석.
  - 테스트 실행, 장애 주입, 부하 시험, 운영 지표 측정은 **수행하지 않음**.
  - 파일 수정·테스트 추가·구현은 **수행하지 않음**.
- **초기 저장소 교차 확인 (P1 수정 전)**
  - 메시지 생성 직후 같은 트랜잭션에서 대화의 활동 시각을 무조건 덮어쓰는 구조 확인. P1에서 수정 완료.
    - [message.repository.ts](../backend/src/repositories/message.repository.ts)
  - 대화 목록은 변경 가능한 활동 시각으로 정렬하면서 커서는 대화 ID만 사용하는 구조 확인.
    - [conversation.repository.ts](../backend/src/repositories/conversation.repository.ts)
    - [conversation.service.ts](../backend/src/services/conversation.service.ts)
  - 메시지 저장 완료 후 WebSocket 발행, 발행 후 HTTP 201 응답 순서 확인.
    - [message.controller.ts](../backend/src/controllers/message.controller.ts)
  - 현재 shutdown이 WebSocket 서버를 별도로 닫지 않는 구조 확인.
    - [websocket.ts](../backend/src/websocket.ts)
    - [shutdown.ts](../backend/src/shutdown.ts)
- **기존 검증 기준**
  - 프로젝트 상태 문서상 백엔드 35개 테스트 파일·219개 테스트 통과.
  - 이 수치는 기존 MVP 검증 기록이며 이번 조사에서 재실행한 결과가 아님.
- **분류 원칙**
  - **코드상 결함 후보**: 코드·DB 의미론을 결합하면 잘못된 결과의 발생 경로를 구체적으로 설명할 수 있음. 실제 재현 전에는 운영 장애로 단정하지 않음.
  - **구조적 위험**: 정상 구현에서도 실패 구간이 존재하지만 이를 허용할지 제품 보장 수준을 정해야 함.
  - **검증 가설**: 런타임·데이터 규모·운영 환경에서 실험해야 실제 영향이 결정됨.
  - **기존 해결**: 관련 구현과 테스트가 이미 보호하는 조건. 중복 과제화하지 않음.

## 3. 우선 조사 후보

### P1 — 동시 메시지 저장에 따른 lastActivityAt 퇴행 (완료)

- **상태**: 실제 DB 통합 테스트 RED 확인 → 수정 후 GREEN → Codex 최종 감사 완료. Blocker 없음.
- **원인**
  - 기존에는 메시지 저장 트랜잭션마다 `Conversation.lastActivityAt`을 자신의 `Message.createdAt`으로 무조건 덮어씀.
  - PostgreSQL의 트랜잭션 시작 시각 기반 `CURRENT_TIMESTAMP` 때문에, 먼저 시작한 A가 나중에 UPDATE하면 더 최신인 B의 활동 시각을 과거 값으로 되돌릴 수 있었음.
  - 관련: [message.repository.ts](../backend/src/repositories/message.repository.ts), [conversation.repository.ts](../backend/src/repositories/conversation.repository.ts).
- **재현·검증**
  - [createMessage.atomicity.test.ts](../backend/src/tests/conversations/createMessage.atomicity.test.ts): Prisma query extension에서 A의 `message.create` 실제 INSERT 직후, UPDATE 전에 checkpoint로 대기 → B의 POST 201/커밋 확인 → A 재개.
  - 두 POST 201, 메시지 두 행, 서로 다른 `createdAt`을 확인하고 `lastActivityAt >= MAX(Message.createdAt)` 불변식을 검증.
  - 이전 구현에서 RED는 사용자가 확인함. 최종 감사에서는 수정 전 RED를 재실행하지 않았음.
- **수정**
  - 메시지 INSERT와 같은 Prisma 트랜잭션 안에서 매개변수화된 `$executeRaw` UPDATE 사용.
  - `GREATEST("lastActivityAt", message.createdAt)`로 DB 내부에서 원자적으로 최댓값 갱신. 사전 SELECT나 애플리케이션 비교 없음.
  - PostgreSQL 16.15 / `Read Committed` 환경에서 동일 행 UPDATE의 잠금·재평가 의미를 검토함.
- **회귀·감사**
  - 실제 `$executeRaw` 실행 후 커밋 전 오류 주입: 메시지 INSERT와 활동 시각 갱신 모두 롤백.
  - 관련 4개 파일·22개 테스트 통과, P1 테스트 10회 연속 통과(회당 2개), 백엔드 전체 35개 파일·219개 테스트 통과.
  - 백엔드 TypeScript 검사, ESLint, `git diff --check` 통과. 최종 감사 결과 수정 없이 완료 판정.
- **선택적 개선 (blocker 아님)**
  - 동시성 테스트에서 `A.createdAt < B.createdAt`을 명시적으로 검증해 시각 역전/동률에 의한 해석 위험 축소.
  - 롤백 테스트에서 실제 UPDATE 영향 행 수 검증.
  - 다른 Conversation의 `lastActivityAt` 불변성 검증은 기본 동작으로 보고 이번 범위에서 생략하기로 합의.
- **포트폴리오 가치**
  - 트랜잭션 원자성과 동시 쓰기 일관성의 차이를 실패 불변식·결정적 재현·수정 후 회귀 검증으로 설명 가능.

### P2 — 메시지 POST 성공 응답 유실 후 중복 저장

- **분류·중요도**: 구조적 위험 / 2순위 / 난이도 상.
- **현상 및 근거**
  - POST 입력에 전송 의도를 식별하는 키가 없고 호출마다 새 메시지를 저장함.
  - DB 커밋과 WebSocket 발행이 끝났는데 HTTP 201만 송신자에게 유실되면, 수동·자동 재시도에서 중복 가능.
  - **현재 프론트엔드가 자동 재시도하는지는 별도 확인**; 재시도 발생을 기본 가정하지 않음.
  - 관련: [message.repository.ts](../backend/src/repositories/message.repository.ts), [message.controller.ts](../backend/src/controllers/message.controller.ts).
- **재현 계획**
  - 프록시·전송 계층에서 첫 요청을 서버까지 전달하고 **201 응답만** 클라이언트에 전달하지 않음.
  - 같은 사용자 전송 동작을 다시 요청.
  - 관찰: 송신자는 한 번만 성공을 인지하지만 DB에는 서로 다른 ID 두 개, 수신 이벤트도 중복될 가능성.
- **해결 후보·검토점**
  - 클라이언트가 논리적 전송마다 idempotency key를 생성하고 재시도에 재사용.
  - DB에 대화·송신자·키의 유일성을 부여하고 재요청에는 기존 결과 반환.
  - 같은 내용의 의도적 연속 전송, 같은 키로 다른 내용 전송, 이벤트 중복 발행을 분리 검증.
  - **API·데이터 모델·클라이언트 계약 변경 필요**: 재현 뒤 도입 여부부터 합의.
- **포트폴리오 가치**
  - HTTP 응답의 불확실성, DB 멱등성, WebSocket 부작용을 한 문제로 연결.

### P3 — 활동순 대화 목록의 커서 이동으로 중복·누락

- **분류·중요도**: 구조적 위험 / 3순위 / 난이도 중상.
- **현상 및 근거**
  - 정렬: lastActivityAt DESC, id DESC.
  - 다음 페이지 커서: 이전 페이지 마지막 대화의 **ID**만 전달해 현재 DB의 해당 대화 위치를 다시 기준으로 사용함.
  - 페이지 사이 새 메시지가 오면 기준 대화 또는 미조회 대화의 위치가 변경됨.
  - 관련: [conversation.repository.ts](../backend/src/repositories/conversation.repository.ts), [conversation.service.ts](../backend/src/services/conversation.service.ts).
- **재현 계획**
  - 초기 정렬 A, B, C, D에서 첫 페이지 A, B 조회(limit=2).
  - 중복: B에 새 메시지를 보내 B, A, C, D로 정렬한 뒤 B 커서로 다음 페이지 조회 → A 재등장 여부 확인.
  - 누락: 초기 상태로 복원하고 C를 맨 앞으로 옮긴 뒤 B 커서로 다음 페이지 조회 → C 누락 여부 확인.
  - 순차 API 호출과 확정된 201 응답만으로 재현 가능.
- **해결 후보·검토점**
  - 조회 당시의 (lastActivityAt, id) 복합 커서로 **경계 자체의 이동에 의한 중복** 완화.
  - 미조회 항목의 앞으로 이동에 의한 누락은 복합 커서만으로 해결되지 않음.
  - 실시간 목록의 수렴 정책(첫 페이지 새로고침·항목 병합 등)과 스냅샷 보장 필요성을 별도 합의.
  - 외부 cursor 응답 계약 변경 전에 사용자 기대 동작부터 정의.
- **포트폴리오 가치**
  - 동적인 정렬 키의 페이지네이션에서 단일/복합 커서의 효과와 한계를 반례로 증명.

### P4 — DB 커밋 이후 WebSocket 발행 전 서버 종료

- **분류·중요도**: 구조적 위험 / 4순위 / 난이도 중상.
- **현상 및 근거**
  - 메시지 커밋 후 메모리의 연결 registry를 통해 push.
  - 그 사이 프로세스가 종료되면 메시지는 DB에 있지만 실시간 이벤트는 유실.
  - 재연결 시 메시지 REST 재조회는 이미 있으나 대화 목록까지 복구하는지는 별도 확인 필요.
  - 관련: [message.controller.ts](../backend/src/controllers/message.controller.ts), [websocket.ts](../backend/src/websocket.ts), [AuthenticatedWebSocket.tsx](../frontend/src/features/messages/AuthenticatedWebSocket.tsx).
  - 기존 설계의 후속 과제: [project-plan.md](./project-plan.md) WebSocket reconnect/open gap recovery.
- **재현 계획**
  - 별도 서버 프로세스를 사용해 DB 커밋 직후·publisher 호출 직전에 중단 후 종료.
  - 송신자 재시도 없이 재시작하고 DB 행 수, 수신 이벤트 수, 상세 REST 복구, 대화 목록 상태를 각각 관찰.
  - 창 포커스 등 다른 자동 refetch를 통제.
- **해결 후보·검토점**
  - 현 단일 런타임에서는 먼저 재연결 시 **메시지 상세와 대화 목록 모두 DB에 수렴**하는 보장 보완.
  - 커밋된 이벤트의 재전송 자체가 요구될 경우에만 transactional outbox 검토.
  - outbox를 도입해도 브라우저 수신 확인·중복 처리·재연결 복구는 별도 문제.
  - 추가 검증: publisher 예외가 발생했을 때 커밋된 메시지와 HTTP 응답 상태가 어떻게 갈리는지.
- **포트폴리오 가치**
  - 영속화, 이벤트 전달, UI 수렴의 서로 다른 성공 기준을 장애 주입으로 검증.

### P5 — 메시지 조회의 무제한 응답과 인덱스 효율

- **분류·중요도**: 무제한 반환은 코드상 확인 / 성능 문제는 가설 / 5순위 / 난이도 중.
- **현상 및 근거**
  - limit이 선택적이며 미전달 시 take를 지정하지 않아 메시지 전체 반환 가능.
  - 메시지 조회는 conversationId 필터와 createdAt·id 정렬을 사용.
  - Prisma 스키마에는 해당 조합의 복합 인덱스가 명시되지 않음.
  - 실제 DB 인덱스, 쿼리 계획, 지연 증가는 아직 측정하지 않음.
  - 관련: [message.repository.ts](../backend/src/repositories/message.repository.ts), [schema.prisma](../backend/prisma/schema.prisma).
- **재현·측정 계획**
  - limit 생략 시 실제 반환량을 작은 테스트 데이터로 검증.
  - 데이터 건수·대화별 분포·커서 깊이를 고정한 대표 데이터셋 생성.
  - DB의 실제 인덱스 확인 후 동일 SQL로 EXPLAIN (ANALYZE, BUFFERS), 읽기 버퍼, API p95 비교.
  - 첫 페이지와 깊은 페이지를 분리하고 소규모 테이블 순차 스캔만으로 성능 결함을 단정하지 않음.
- **해결 후보·검토점**
  - 기본·최대 페이지 크기는 기존 응답 계약을 변경하므로 우선 합의.
  - 성능상 유의미한 병목이 확인될 경우에만 적절한 복합 인덱스를 검토.
  - 성능 개선 주장은 동일 환경에서 측정한 수정 전후 수치로만 작성.
- **포트폴리오 가치**
  - 실행계획과 데이터 분포를 근거로 개선 효과를 수치화할 때 가치가 커짐.

### P6 — 활성 WebSocket에 의한 서버 종료 지연

- **분류·중요도**: 런타임 가설 / 후순위 / 난이도 중.
- **현상 및 근거**
  - 운영 종료 경로는 HTTP server.close() 뒤 Prisma disconnect.
  - WebSocket 서버와 활성 연결을 명시적으로 종료하지 않음.
  - 테스트 teardown은 연결·WebSocket·HTTP 서버를 별도로 정리함.
  - 관련: [shutdown.ts](../backend/src/shutdown.ts), [websocket.ts](../backend/src/websocket.ts).
- **검증 계획**
  - 실제 프로젝트 Node 버전에서 소켓 0개/1개를 유지한 별도 서버에 동일한 SIGTERM 전송.
  - 종료 시각, 클라이언트 close, 연결을 닫은 직후 서버가 종료되는지 측정.
  - 활성 연결이 있어도 정상 종료되면 해당 런타임에서 가설 기각.
- **개선 후보**
  - 재현되면 신규 연결 차단 → 기존 WebSocket 종료 통지 → 유예 시간 뒤 강제 정리 → DB disconnect 순서 검토.
  - 진행 중인 REST 쓰기의 종료 보장도 함께 검증.

### P7 — Refresh rotation 성공 응답 유실 시 세션 복구 실패

- **분류·중요도**: 구조적 위험 / 후순위 / 난이도 중, 투명 복구는 상.
- **현상 및 근거**
  - 기존 refresh hash 삭제와 새 hash 생성은 단일 DB 트랜잭션.
  - 커밋 뒤 Set-Cookie 응답만 유실되면 브라우저는 이전 쿠키를 보유하고 DB는 새 hash만 인정.
  - 관련: [refreshSession.repository.ts](../backend/src/repositories/refreshSession.repository.ts).
- **재현 계획**
  - refresh 성공 응답의 새 쿠키만 클라이언트에 반영하지 않고 이후 재시도.
  - 새 DB 세션은 남고 기존 쿠키로는 401이 나는지 확인.
- **판단·개선 방향**
  - 현재의 이전 토큰 재사용 거부는 보안상 의도된 보장.
  - 먼저 사용자 재로그인 경로가 일관되고 안전한지 검증.
  - 이전 토큰 재사용 허용이나 투명 재시도는 인증 정책 변경 없이 임의 구현하지 않음.

### P8 — WebSocket 인증 시점과 연결 수명의 불일치

- **분류·중요도**: 정책 결정이 필요한 구조적 위험 / 후순위 / 난이도 중상.
- **현상 및 근거**
  - 연결 시 Origin·access token 검증 후 사용자 ID별 WebSocket을 유지.
  - 기존 연결을 access token 만료나 logout에 맞춰 서버에서 해제하는 경로는 확인되지 않음.
  - 관련: [websocket.ts](../backend/src/websocket.ts), [project-plan.md](./project-plan.md).
- **검증 계획**
  - 만료 토큰의 신규 handshake 거부는 기존 테스트로 보호.
  - 유효한 토큰으로 연결한 뒤 만료 시점까지 경과시켜 연결·registry·수신 동작 검증.
  - 로그아웃 시 즉시 모든 기기 또는 해당 기기 연결을 끊어야 하는지 요구사항 분리.
- **판단·개선 방향**
  - handshake 시점 인증만 허용하는지, 연결 수명까지 인증 기간을 적용하는지 먼저 합의.
  - 세션별 강제 종료가 필요하면 사용자 ID 기준 registry 이상의 식별 구조 검토.
  - 단순 토큰 만료만으로 현재 설계를 보안 취약점이라고 단정하지 않음.

## 4. 이미 해결·검증된 동작

- **동일 사용자 쌍의 동시 대화 생성**
  - Serializable 트랜잭션과 제한적 충돌 재시도.
  - 실제 DB에서 겹친 요청이 같은 대화 ID·단일 DB 행으로 수렴하는 기존 테스트가 있음.
  - 관련: [conversation.repository.ts](../backend/src/repositories/conversation.repository.ts), [createConversation.concurrent.test.ts](../backend/src/tests/conversations/createConversation.concurrent.test.ts).
- **메시지 저장과 활동 시각 갱신의 원자성·동시성 (P1 완료)**
  - 활동 시각 갱신 실패 주입 시 메시지 삽입도 롤백.
  - 두 성공 트랜잭션 간 활동 시각 퇴행도 `GREATEST()` 원자적 UPDATE와 실제 DB 통합 테스트로 보완.
- **Refresh token rotation 실패 시 롤백과 이전 토큰 재사용 거부**
  - 교체 중 DB 오류 시 기존 세션 보존, 정상 교체 후 이전 토큰 401 테스트 존재.
  - P7은 **성공 응답 전달 실패**로 실패 위치가 다름.
- **메시지 참여자 인가와 정상 WebSocket push 대상**
  - 읽기·쓰기의 비참여자 접근 거부.
  - 송신자 제외·상대 사용자 다중 연결로 push하는 정상 경로 검증.
- **활용 원칙**
  - 새로운 문제를 발굴하기 위해 기존 해결을 무효로 표현하지 않음.
  - 필요할 경우 기존 테스트를 회귀 기준으로 재사용.

## 5. Codex 조사 결과의 한계

- **P2~P8의 재현 증거 부재**
  - 최초 조사 단계는 정적 분석이었음. P1은 실제 RED→GREEN 및 최종 감사를 마쳤으며, P2~P8은 별도의 장애 주입·부하 실험·실행계획 검증이 필요함.
  - 아직 재현하지 않은 후보는 운영 장애로 단정하지 않고 실제 검증 시 상태 변경.
- **정책·계약 미확정**
  - 메시지 재시도 멱등성, 활동순 목록의 스냅샷 기대, push 내구성, WebSocket 연결 만료, refresh 복구 수준은 제품 결정이 필요.
  - 현재 보장보다 높은 수준을 전제로 오류라고 단정하면 과잉 설계로 이어짐.
- **운영 조건 미확인**
  - 배포 환경의 실제 프로세스 종료, 장애 빈도, 데이터량, API 요청량, DB 인덱스와 성능은 측정되지 않음.
  - 모든 성능·가용성 개선의 효과를 사전에 주장할 수 없음.
- **범위 제한**
  - 백엔드 중심이므로 세션 전환 중 캐시 오염, 브라우저 쿠키 정책, 프론트엔드 재시도/오프라인 동작은 상세 감사 대상이 아니었음.
  - 최초에 제안했던 부하 시험·관측성·악의적 요청 방어도 체계적으로 다루지 않음.
- **실험 품질 위험**
  - sleep 기반 비결정적 테스트, 소켓 종료 후 재연결 자동 동작, 테스트용 데이터 부족, 외부 클라우드 편차로 잘못된 결론을 낼 수 있음.
  - checkpoint, 명시적 순서 제어, 격리된 테스트 DB/프로세스, 동일 조건 반복이 필요.

## 6. 보완 조사 과제

- **장애 주입과 정합성 검증 강화**
  - DB 단절·타임아웃·트랜잭션 충돌/재시도 한도에서 HTTP 상태와 DB 후속 상태를 함께 검증.
  - P1은 완료. P2~P4를 재현해 실제 위험도와 데이터 복구 경로를 구분.
  - 메세지 중복·유실에서 '요청 수', '저장 행 수', '이벤트 수', 'UI 최종 상태'를 각각 관찰.
- **부하·성능과 운영 관측성**
  - 의미 있는 데이터셋과 목표 부하를 정한 뒤 API 지연(p50/p95), 처리량, 오류율, 쿼리 실행계획 측정.
  - 장애 원인을 구분할 최소 로그·상관 식별자·종료 경로 기록 필요성 검토.
  - 수치 없는 '대규모 트래픽 개선' 서술 금지.
- **인증·보안 경계**
  - P7~P8 외에 요청 반복, rate limiting 필요성, 리소스 고갈, Origin·쿠키·세션 상태의 실제 배포 경계 점검.
  - 단순 취약점 목록 대신 구체적인 공격/실패 조건과 현재 방어 범위를 확인.
  - 이전 세션에서 시작한 pending mutation·refresh가 사용자 전환 후 영향을 주는 문제는 기존 post-MVP 과제로 남김.
- **프론트엔드 연계(필요한 범위만)**
  - P2 재시도 정책과 P4 재연결 후 목록 캐시 수렴을 백엔드 결과와 연결해 검증.
  - 쿠키의 브라우저별 정책·third-party 제한은 별도 환경 검증 과제로 보류.
- **우선순위 재평가**
  - 운영 지표나 결정적 RED가 발견되면 P5~P8의 순위를 조정.
  - 근거가 없는 가설은 억지로 구현하지 않고 보류 또는 기각.

## 7. 실행 순서와 작업 게이트

- **1차 — P1 완료**
  - 실제 DB checkpoint 기반 RED 확인, `$executeRaw` + `GREATEST()` 최소 수정, GREEN·롤백 회귀 및 Codex 감사 완료.
  - 구현·테스트 증거는 §3 P1에 정리. 완료를 막는 문제 없음.
- **2차 — P2 또는 P3**
  - P2: 먼저 멱등성 계약과 API/DB 모델 변경을 합의한 뒤 RED.
  - P3: 페이지 간 데이터 변경을 이용한 중복·누락을 먼저 재현하고 기대 UX를 합의.
  - 실제 재현 및 계약 합의 결과에 따라 다음 과제 선택.
- **3차 — P4와 P5**
  - P4: 커밋-발행 간 종료의 관찰값과 재연결 후 목록·상세 수렴 점검.
  - P5: 반환량 재현 뒤 성능 계측; 병목과 개선 폭을 입증할 때만 인덱스/제한 정책 변경.
- **4차 — P6~P8 및 미조사 영역**
  - 먼저 가설 기각 가능성을 확인하고 위험·정책·비용에 따라 선택적으로 진행.
- **모든 단계 공통**
  - Trail/AGENTS.md의 탐색 지침과 저장소 TDD 게이트 준수.
  - 테스트와 구현을 한 번에 진행하지 않고 각 RED/GREEN 단계에서 승인 대기.
  - 코드 변경·설계 계약 변경은 현재 선택된 과제 범위 안에서만 수행.
  - 별도 도입 기술은 실험 결과와 요구사항이 정당화할 때만 검토.
  - 프로젝트 계약이 변경되면 project-plan, 작업 현황이 변경되면 project-status 갱신.

## 8. 다음 세션 시작점 / 핸드오프 (P1 완료, P2 착수 예정)

- **현재 단계**
  - P1 `Conversation.lastActivityAt` 퇴행 수정 및 최종 검증 완료. Production의 메시지 저장 트랜잭션에서 `$executeRaw` + `GREATEST()` 사용.
  - 테스트는 [createMessage.atomicity.test.ts](../backend/src/tests/conversations/createMessage.atomicity.test.ts)에 있음. checkpoint는 Prisma query extension의 `message.create` 실제 INSERT 직후이며, 오류 주입은 `$executeRaw` 성공 직후·커밋 전.
  - RED는 사용자 확인, 최종 Codex 감사에서는 GREEN 및 회귀를 검증. P1 blocker 없음.
- **최신 검증**
  - 관련 4개 파일 22개 통과, P1 10회 연속 통과(회당 2개), backend 전체 35개 파일·219개 통과.
  - Backend `tsc --noEmit -p tsconfig.json`, `npm run lint`, `git diff --check` 모두 성공.
  - 테스트 DB PostgreSQL 16.15 / `Read Committed` 확인. Production 배포 재검증 결과는 이번 감사 범위에 없음.
- **다음 즉시 시작점**
  1. 다음 개선 대상으로 **P2(응답 유실 후 재요청으로 인한 메시지 중복 저장)** 선택. 아직 P2 관련 테스트·구현은 진행하지 않음.
  2. 사용자가 `createMessage.test.ts` 통합 테스트를 리팩토링했음(이번 세션에서 변경 후 재검증하지 않음). P2 테스트는 우선 해당 파일에 추가하는 방향으로 논의함.
  3. 프론트 메시지 전송에는 일반 실패 시 자동 재시도가 없지만 수동 재전송은 가능함. 먼저 재시도·멱등성 보장 범위 및 API/DB 계약 변경을 합의한 후 RED 테스트 설계.
  4. 루트·백엔드 `AGENTS.md`의 TDD 게이트에 따라 RED 보고 후 중단, 승인 후 GREEN 진행.
- **보류 / 선택 사항**
  - P1에서 최신 메시지 생성 시각의 명시적 순서 검증, UPDATE 영향 행 수 검증, 다른 Conversation 비변경 검증은 blocker가 아닌 선택적 보완.
  - P4~P8은 기존 조사 후보로 유지. 별도 합의 없이 구현·계약 변경하지 않음.
