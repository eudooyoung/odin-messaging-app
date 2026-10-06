# Messaging App — Current Status

## Current branch / phase

- Branch: `chore/wrap-up`. HEAD: `6a6e9c7` (`docs: add readme and generate project architecture diagram`).
- Phase: wrap-up 최종 확인 후 main merge / push와 production deploy 준비.
- MVP 구현·hardening·local browser smoke 완료. 현재 MVP 코드·계약 기준 deploy blocker 없음.
- Working tree: `docs/project-plan.md`, `docs/project-status.md` 문서 정리만 미커밋 상태. Production/test/source 코드와 README / architecture artifact 변경은 없다.

## Recent wrap-up

- README 포트폴리오 문서 작성·최종 정리 완료. Infrastructure는 Netlify / Render, Deployment는 상태 중립적인 구성 설명으로 정리했다.
- Third-party attribution과 필요한 license 정리 완료: toe-icons by Javisperez / SVG Repo / Apache-2.0, Pretendard / SUIT / OFL-1.1. License 원문은 `licenses/Apache-2.0.txt`, `licenses/OFL-1.1.txt`만 유지하며 프로젝트 로고·`docs/style-token.png`·프로젝트 내부 생성 SVG는 third-party로 분류하지 않는다.
- Archify runtime architecture HTML / SVG 최종화: deployment 상태 의존 문구 제거, PostgreSQL의 `conversations` 용어 정합화와 기존 runtime 구조 유지.
- README / architecture / license 링크의 정적 확인과 Archify validation 완료. 두 프로젝트 문서는 장기 plan과 deploy handoff로 역할을 분리했다.

## Latest verification

- Frontend: 33 files / 297 tests 통과.
- Backend: 35 files / 219 tests 통과.
- Frontend(app·node 설정) / backend type-check 통과.
- Frontend / backend 전체 ESLint 통과.
- Frontend / backend production build 통과.
- Final audit 기준 현재 MVP 코드·계약의 deploy blocker 없음.
- Local browser smoke 완료(사용자 확인): 실제 frontend / backend / dev PostgreSQL 연결 상태에서 auth·profile·conversation·message·WebSocket·recovery·mobile·error routes의 주요 사용자 흐름을 확인했다. Production 환경 검증은 남아 있다.
- 위 코드 검증 결과를 유지한다. 이후 wrap-up은 문서·artifact 정적 검증만 수행했으며 전체 테스트는 재실행하지 않았다.

## Deploy context

- Frontend: Netlify. Backend: Render. Database: production PostgreSQL(provider 미확정). Frontend / backend는 서로 다른 origin이며 브라우저가 backend로 직접 요청한다.
- Backend 환경: `NODE_ENV=production`, `APP_DEBUG=false`, `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_ORIGIN`을 설정한다. `PORT`는 Render가 제공하는 값을 사용한다. `FRONTEND_ORIGIN`은 실제 frontend origin과 정확히 일치해야 한다.
- Production access / refresh JWT cookie: HttpOnly, `Secure=true`, `SameSite=None`. Access는 `Path=/`·15분, refresh는 `Path=/auth`·7일이다.
- HTTP 요청은 `credentials: "include"`. Backend CORS는 정확한 frontend origin과 `credentials: true`를 사용하며 wildcard origin을 사용하지 않는다.
- REST state-changing 요청(POST/PATCH/PUT/DELETE, auth 포함)은 `FRONTEND_ORIGIN`을 검증한다. WebSocket upgrade도 같은 Origin 검증 후 access cookie JWT로 인증한다. 불일치·누락·null Origin은 403이다.
- Frontend `VITE_API_URL`은 backend production origin이다. WebSocket URL은 여기에서 `https` → `wss`로 파생되며 별도 WebSocket URL 환경 변수는 없다. REST와 WebSocket은 같은 backend runtime에 속한다.
- Production DB에 Prisma migration을 적용하고 frontend / backend build·backend start 설정을 확인한다. Netlify에는 SPA fallback 설정이 필요하다. 로컬 명령과 일반 계약은 [README](../README.md)와 [project plan](project-plan.md)을 참고한다.

## Next starting point

1. `chore/wrap-up` working tree를 최종 확인한다.
2. 필요한 변경을 commit한다(현재 미커밋 변경은 두 프로젝트 문서).
3. main에 merge한다.
4. main을 push한다.
5. Deploy context의 설정을 확인하고 Netlify + Render + production PostgreSQL을 실제 배포한다.
6. Production smoke test를 수행한다.
7. 확인된 실제 production URL을 README에 반영한다.
8. 최종 commit / push 및 branch cleanup을 수행한다.

## Blockers / deferred

- 현재 MVP 코드·계약 기준 production deploy blocker 없음. 배포 환경의 URL·CORS·cookie·WebSocket·DB / hosting은 production smoke test로 확인해야 한다.
- 장기 product / post-MVP / optional maintenance follow-up의 SSOT는 [project plan](project-plan.md)의 장기 roadmap이다.
