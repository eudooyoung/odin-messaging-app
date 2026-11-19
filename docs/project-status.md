# Messaging App — Current Status

## Current phase

- MVP 구현과 Netlify / Render / Neon production 배포·smoke test 완료(사용자 확인).
- Backend troubleshooting P1(`Conversation.lastActivityAt` 동시 메시지 저장 시각 퇴행) RED → GREEN → 최종 audit 완료. Blocker 없음.
- 다음 작업은 P2(메시지 POST 성공 응답 유실 후 중복 저장)와 P3(활동순 커서의 중복·누락) 중 선택 전. 우선순위 및 검증 계획: [PLAN.TROUBLESHOOTING.MD](./PLAN.TROUBLESHOOTING.MD).

## Latest verification

- P1 최종 Codex audit: 관련 4개 테스트 파일 22개 통과; P1 동시성·롤백 테스트 10회 연속 통과(회당 2개); backend 전체 35개 파일·219개 통과.
- Backend TypeScript(`tsc --noEmit`), ESLint, `git diff --check` 통과. 테스트 DB PostgreSQL 16.15, 격리 수준 `Read Committed` 확인.
- Frontend 33 files / 297 tests, frontend type-check·ESLint·production build 통과는 이전 MVP 검증 기록. Backend production build도 이번 P1 감사에서 재실행한 결과는 아님.
- Local browser smoke 완료(사용자 확인).
- Production smoke 완료(사용자 확인): frontend 접속·로그인·새로고침 후 인증 유지·사용자 검색·대화 생성·메시지 전송·서로 다른 로그인 세션 간 WebSocket 실시간 수신·대화 상세 route의 SPA fallback을 Render / Neon 실제 환경에서 확인했다.

## P1 implementation and handoff

- 메시지 생성 트랜잭션 내부의 `Conversation.lastActivityAt` 갱신을 매개변수화된 `$executeRaw` + `GREATEST()`로 변경. DB 내 원자적 최댓값 갱신으로 퇴행 방지.
- `createMessage.atomicity.test.ts`: A의 `message.create` INSERT 후 checkpoint에서 대기 → B 커밋 → A 재개; 두 메시지 저장과 `lastActivityAt >= MAX(Message.createdAt)` 검증. `$executeRaw` 완료 후 커밋 전 오류 주입으로 롤백 회귀도 확인.
- RED는 사용자 확인, GREEN·회귀 및 최종 audit는 Codex 검증. 운영 배포에서 P1 수정 재검증은 이번 범위 밖.
- 선택적 개선(진행 차단 아님): `A.createdAt < B.createdAt` 명시 검증, UPDATE 영향 행 수 검증, 비대상 Conversation의 활동 시각 불변 검증(이번 작업에서는 생략하기로 합의).
- 다음 단계에서 P2를 선택하면 멱등성/API·DB 계약 합의가 먼저 필요하고, P3를 선택하면 실제 중복·누락 재현과 기대 UX 합의가 먼저 필요. 사용자 선택 및 TDD 단계 승인 전 수정하지 않음.

## Production

- Frontend: Netlify — https://leaves-messaging.netlify.app
- Backend: Render — https://odin-messaging-app-sg0a.onrender.com
- Database: Neon PostgreSQL.
