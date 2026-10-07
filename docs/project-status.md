# Messaging App — Current Status

## Current phase

- MVP 구현과 Netlify / Render / Neon production 배포·smoke test 완료(사용자 확인).
- 현재 알려진 blocker 없음.

## Latest verification

- Frontend: 33 files / 297 tests 통과.
- Backend: 35 files / 219 tests 통과.
- Frontend / backend type-check, ESLint, production build 통과.
- 자동 검증 결과는 기존 MVP 검증 기준이다.
- Local browser smoke 완료(사용자 확인).
- Production smoke 완료(사용자 확인): frontend 접속·로그인·새로고침 후 인증 유지·사용자 검색·대화 생성·메시지 전송·서로 다른 로그인 세션 간 WebSocket 실시간 수신·대화 상세 route의 SPA fallback을 Render / Neon 실제 환경에서 확인했다.

## Production

- Frontend: Netlify — https://leaves-messaging.netlify.app
- Backend: Render — https://odin-messaging-app-sg0a.onrender.com
- Database: Neon PostgreSQL.
