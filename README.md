# Leaves

Leaves는 Node.js / TypeScript와 React로 만든 **1:1 실시간 메시징 애플리케이션**입니다. 사용자 검색부터 대화 생성, 메시지 저장과 실시간 수신까지 프론트엔드와 백엔드를 직접 구현했습니다.

REST API로 서버 데이터를 조회·변경하고, WebSocket으로 새 메시지를 전달합니다. 인증 만료와 연결 끊김, 비동기 요청과 실시간 이벤트가 겹치는 상황에서도 화면이 서버 상태와 일치하도록 설계했습니다.

## 주요 기능

- 회원가입·로그인·로그아웃과 refresh session을 통한 인증 유지
- 사용자 검색, 공개 프로필 조회와 본인 프로필 수정
- 1:1 대화 생성·재사용, 최근 활동순 대화 목록과 상세 조회
- 텍스트 메시지 조회·전송과 과거 메시지 cursor pagination
- WebSocket `message.created` 이벤트를 통한 상대방의 실시간 메시지 수신
- 인증 상태에 따른 route 접근 제어와 대화 참여자 권한 검증
- 데스크톱·모바일 반응형 메시징 화면

## Architecture

![Leaves runtime architecture](docs/architecture/leaves-runtime.svg)

[인터랙티브 아키텍처 원본 HTML](docs/architecture/leaves-runtime.html)은 파일을 내려받아 브라우저에서 열 수 있습니다. 그림의 Netlify·Render는 배포 구성을 나타냅니다.

메시지 저장은 REST 요청에서 처리합니다. 저장이 완료되면 WebSocket으로 발신자를 제외한 상대 사용자의 연결에 이벤트를 전달합니다. Express 백엔드는 service와 repository를 거쳐 Prisma로 PostgreSQL에 접근합니다.

프론트엔드와 백엔드는 서로 다른 origin에서 동작하며, production에서는 credentialed cookie 요청으로 인증 상태를 유지하도록 구성했습니다.

## 기술 스택

| 영역           | 기술                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Frontend       | React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, native WebSocket |
| Backend        | Node.js, TypeScript, Express, PostgreSQL, Prisma, JWT, Argon2id, ws, Zod                                    |
| Test           | Vitest, React Testing Library, Supertest                                                                    |
| Infrastructure | Netlify · Render · Neon PostgreSQL                                                                          |

## 주요 설계와 구현

### 쿠키 인증과 만료 복구

Access·refresh JWT는 HttpOnly 쿠키에 저장합니다. 서버는 refresh token의 해시와 만료 시각을 DB session으로 관리하고, 갱신 시 기존 session을 새 session으로 교체하는 rotation을 수행합니다. 비밀번호는 Argon2id로 해시합니다.

프론트엔드의 공통 HTTP client인 `apiFetch`는 `401` 응답을 받으면 refresh를 시도하고, 성공한 경우 원 요청을 **한 번만 재시도**합니다. 동시에 만료된 요청들은 하나의 진행 중인 refresh 요청을 공유합니다. 현재 사용자 상태는 별도 인증 context 대신 서버의 auth query로 관리합니다.

### 서로 다른 origin에서의 요청 검증

Production 쿠키에는 `Secure`와 `SameSite=None`을 적용하고, HTTP 요청에는 `credentials: "include"`를 사용합니다. CORS는 지정된 프론트엔드 origin과 credential 요청을 허용합니다.

CORS 설정과 별도로, REST의 POST/PATCH/PUT/DELETE 요청은 `Origin`이 `FRONTEND_ORIGIN`과 정확히 일치해야 실행됩니다. WebSocket upgrade도 같은 Origin 검증을 거친 뒤 access cookie의 JWT로 인증합니다. 대화와 메시지의 조회·전송은 서버에서 참여자 여부를 검증합니다.

### 메시지와 대화 목록의 일관성

메시지 저장과 `Conversation.lastActivityAt` 갱신을 하나의 DB transaction으로 처리합니다. 최근 활동 시각 갱신이 실패하면 메시지 저장도 rollback되어 메시지 기록과 대화 목록 정렬 기준이 함께 유지됩니다.

### REST와 실시간 이벤트의 캐시 통합

REST 전송 응답과 검증된 WebSocket 이벤트를 같은 TanStack Query 메시지 캐시에 반영합니다. 메시지 ID로 중복을 제거하고 pagination 구조와 정렬을 유지하며, 대화 목록 query를 무효화해 마지막 메시지와 순서를 갱신합니다.

WebSocket 연결·재연결 시 메시지를 REST로 다시 조회해 놓친 데이터를 복구합니다. 조회 중 이벤트가 들어오는 경우에도 새 메시지가 뒤늦은 응답에 덮이지 않도록 처리했습니다. 취소가 필요한 query는 TanStack Query의 `signal`을 HTTP 요청까지 전달합니다.

## 테스트와 품질

기능 개발과 버그 수정은 테스트를 먼저 작성하고 구현을 진행하는 TDD 방식으로 진행했습니다.

- **Frontend:** Vitest·React Testing Library로 query/mutation 계약, 사용자 interaction, route 접근 제어와 비동기 cache lifecycle을 검증합니다.
- **Backend:** Vitest·Supertest로 HTTP·WebSocket 계약을 검증하고, service의 비즈니스 규칙은 별도 unit test로 확인합니다. DB integration test는 개발 DB와 분리된 테스트 DB를 사용합니다.

[검증 기록](docs/project-status.md#latest-verification)에는 프론트엔드·백엔드 test, type-check, lint, production build와 local / production browser smoke 결과를 정리했습니다.

## 로컬 실행

Node.js 24, npm, 실행 중인 PostgreSQL이 필요합니다. 아래 명령은 저장소 루트에서 시작합니다.

### 1. 설치와 환경 설정

```bash
npm ci --prefix backend
npm ci --prefix frontend
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

각 `.env`의 placeholder를 채웁니다. 두 서버의 URL과 origin은 아래 예시처럼 맞춥니다.

| 파일            | 변수                | 로컬 설정                                                                                                     |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/.env`  | `PORT`              | `3000`                                                                                                        |
| `backend/.env`  | `APP_DEBUG`         | `false`                                                                                                       |
| `backend/.env`  | `JWT_SECRET`        | 직접 생성한 임의의 긴 secret                                                                                  |
| `backend/.env`  | `FRONTEND_ORIGIN`   | `http://localhost:5173`                                                                                       |
| `backend/.env`  | `DATABASE_URL`      | 개발 DB 연결 문자열: `postgresql://<user>:<password>@localhost:5432/leaves_dev?schema=public`                 |
| `backend/.env`  | `TEST_DATABASE_URL` | 테스트 실행 시 별도 DB 연결 문자열: `postgresql://<user>:<password>@localhost:5432/leaves_test?schema=public` |
| `frontend/.env` | `VITE_API_URL`      | `http://localhost:3000`                                                                                       |

`NODE_ENV`는 backend의 실행 script가 설정합니다. 프론트엔드 포트를 변경하면 `FRONTEND_ORIGIN`도 실제 접속 origin에 맞춰 변경해야 합니다.

### 2. DB 준비와 백엔드 실행

연결 문자열에 지정한 개발 DB를 먼저 만들고, 기존 migration을 적용한 뒤 Prisma client를 생성합니다.

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run dev
```

DB integration test를 실행하려면 별도의 테스트 DB를 만들고 backend 디렉터리에서 `NODE_ENV=test npx prisma migrate deploy`로 migration을 적용합니다. 테스트는 각 디렉터리에서 `npm test -- --run`으로 실행할 수 있습니다.

### 3. 프론트엔드 실행

새 터미널에서 저장소 루트를 기준으로 실행합니다.

```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173`에 접속합니다. WebSocket URL은 `VITE_API_URL`에서 자동으로 생성합니다.

## Deployment

프론트엔드는 Netlify, 백엔드는 Render, 데이터 저장소는 Neon PostgreSQL로 production 배포했습니다.

| 대상     | 배포 구성       | URL |
| -------- | --------------- | --- |
| Frontend | Netlify         | [leaves-messaging.netlify.app](https://leaves-messaging.netlify.app) |
| Backend  | Render          | [odin-messaging-app-sg0a.onrender.com](https://odin-messaging-app-sg0a.onrender.com) |
| Database | Neon PostgreSQL | —   |

| 대상 | 디렉터리 | Build Command | Start / Publish |
| --- | --- | --- | --- |
| Netlify | Base: `frontend` | `npm run build` | Publish: `dist` |
| Render | Root: `backend` | `npm ci && npm run build` | Start: `npm start` |

Third-party cookie를 차단하는 브라우저 설정에서는 cross-site 인증 쿠키가 차단되어 로그인이 제한될 수 있습니다. 이 경우 해당 사이트에서 third-party cookie를 허용해야 합니다.

## 향후 개선

- WebSocket 재연결 후 메시지뿐 아니라 대화 목록도 함께 복구
- 대화 나가기·내 기록 지우기의 사용자별 상태와 재진입 규칙 설계
- 세션 전환 시 이전 세션에서 시작된 mutation·refresh의 영향 차단

제품 범위와 상세 계약은 [Project Plan](docs/project-plan.md), 현재 작업·검증 상태는 [Project Status](docs/project-status.md)에서 관리합니다.

## Third-party assets

- Sidebar icons: [toe-icons](https://github.com/javisperez/toe-icons) by Javisperez, licensed under [Apache-2.0](licenses/Apache-2.0.txt) via [SVG Repo](https://www.svgrepo.com/) (modified: size and fill attributes).
- [Pretendard](https://github.com/orioncactus/pretendard) — [SIL Open Font License 1.1](licenses/OFL-1.1.txt).
- [SUIT](https://github.com/sun-typeface/SUIT) — [SIL Open Font License 1.1](licenses/OFL-1.1.txt).
