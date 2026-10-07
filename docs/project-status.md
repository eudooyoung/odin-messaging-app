# Messaging App — Current Status

## Current phase

- Branch: `chore/deploy`.
- MVP 구현과 Netlify / Render / Neon production 배포 완료(사용자 확인).
- Production smoke test 최종 확인 단계.

## Latest verification

- Frontend: 33 files / 297 tests 통과.
- Backend: 35 files / 219 tests 통과.
- Frontend / backend type-check, ESLint, production build 통과.
- 위 결과는 MVP wrap-up 기준이며 이후 package metadata / backend dependency 변경은 미검증이다.
- Local browser smoke 완료(사용자 확인).
- Production smoke test는 아직 남아 있다.

## Production

- Frontend: Netlify — https://leaves-messaging.netlify.app
- Backend: Render — https://odin-messaging-app-sg0a.onrender.com
- Database: Neon PostgreSQL.
- Frontend `VITE_API_URL` → Render backend origin.
- Backend `FRONTEND_ORIGIN` → Netlify frontend origin.

## Next

1. 두 package-lock의 이전 template 이름을 정리하고 backend dependency 변경을 재검증한다.
2. Production smoke test로 주요 사용자 흐름과 SPA 직접 진입을 확인한다.
3. 확인 결과를 반영하고 프로젝트를 마무리한다.
