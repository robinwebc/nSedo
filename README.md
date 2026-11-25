# nSedo

nSedo is a social app: short posts, follows, friends, messages, audio and video calls, and small live rooms. The Android app is the main client. A Next.js site and an admin console talk to the same NestJS API.

The product name, mark, and colors belong to nSedo. The accent is cobalt `#2457E6` on light surfaces and `#6E96FF` on ink `#14202B`.

## Layout

```
apps/mobile          Flutter (Android + iOS)
apps/web             Next.js landing page, privacy policy, and basic client
apps/api             NestJS API, Prisma, Socket.IO
admin/dashboard      Next.js admin console
packages/shared      Username rules and shared types
packages/ui          Shared web mark and form bits
infrastructure/docker
infrastructure/database
infrastructure/deployment
```

## Run the API

PostgreSQL 16 and Node 22.

```bash
cd apps/api
cp .env.example .env
# edit JWT_SECRET before any shared deploy
npx prisma migrate deploy
npm run start
```

The API listens on port 4000. Health check: `GET /health`.

Or, with Docker:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

Local `.env.example` defaults are for that compose file (`nsedo` / `nsedo`). Change them before a public deploy. Do not commit `.env`.

`ADMIN_EMAILS` defaults to `robinwebc@gmail.com`. Registering or signing in with that email (password, email code, or Google) sets the role to `ADMIN`. Only an admin can promote or demote a moderator, and that address cannot be demoted or banned.

### Sign-in

- Password: email, phone, or username. `POST /auth/register`, `POST /auth/login`.
- Phone OTP and email code: `POST /auth/otp/request`, `POST /auth/otp/verify`. Codes are bcrypt-hashed. In development they are printed to the API log.
- Google: `POST /auth/google` with an ID token. See `infrastructure/deployment/README.md` for the OAuth client and Android SHA-1.
- Refresh tokens rotate. Reuse revokes the token family. The app stores them in `flutter_secure_storage`.

Every new account gets a public id `nSedo` plus six digits. Usernames are 3–20 characters, lowercase letters, digits, and underscores, with reserved words blocked. `GET /users/username-available?username=` checks a name. A username can change once every 30 days.

## Tests

```bash
cd apps/api
npm test
npm run test:e2e
```

E2E expects Postgres at `postgresql://nsedo:nsedo@127.0.0.1:5432/nsedo_test`.

## Web and admin

```bash
cd apps/web && cp .env.example .env.local && npm run dev
cd admin/dashboard && cp .env.example .env.local && npm run dev -- --port 3001
```

The site is at http://localhost:3000 (landing, sign-in, feed, profile, `/privacy`). The admin console is at http://localhost:3001 and only admits `ADMIN` and `MODERATOR`.

## Android

```bash
cd apps/mobile
flutter pub get
flutter build apk --release --dart-define=API_URL=https://nsedo-api.onrender.com
```

The built-in default is `https://nsedo-api.onrender.com`. The first request can take about a minute while the server wakes. Change the address in the app if you run the API yourself. The release APK is debug-signed so it can be installed for testing.

Screens: Home (হোম), Search (খোঁজ), Live (লাইভ), Alerts (খবর), Chat (বার্তা), plus profile, settings, calls, and live rooms.

## What a real phone needs

The APK does not include a database. Point it at a hosted API. Cheap starting points are listed in `infrastructure/deployment/README.md` (Render, Railway, Fly.io, or Cloud Run for the API; Neon or Supabase for Postgres; Vercel for the website). Calls across mobile networks usually also need a TURN server.
