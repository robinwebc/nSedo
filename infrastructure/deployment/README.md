# Deployment

nSedo needs a hosted API and PostgreSQL before a phone outside your LAN can use it. The Android app reads the API URL from `--dart-define=API_URL=...` and from Settings.

## Suggested low-cost layout

| Piece | Options |
| --- | --- |
| API | [Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io), Google Cloud Run |
| Postgres | [Neon](https://neon.tech), [Supabase](https://supabase.com), Railway Postgres |
| Web + admin | [Vercel](https://vercel.com) or Cloudflare Pages. Set `NEXT_PUBLIC_API_URL` |
| TURN | A small VPS running coturn, or a hosted TURN provider. STUN `stun:stun.l.google.com:19302` is built in. Set `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` when calls must cross strict NATs |

Set `JWT_SECRET` to a long random value, `ADMIN_EMAILS=robinwebc@gmail.com`, and `CORS_ORIGINS` to the web and admin origins. Put uploads on a persistent disk (`UPLOAD_DIR`) or replace the local uploader before you run more than one API instance.

`docker compose -f infrastructure/docker/docker-compose.yml up --build` runs Postgres and the API together.

## Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web** and copy its client ID into the API env `GOOGLE_CLIENT_ID`.
2. Create an OAuth client of type **Android**. Package name: `app.nsedo`. SHA-1: the debug (or release) certificate that signs the APK.
3. Build the app with the web client id:

```bash
cd apps/mobile
flutter build apk --release \
  --dart-define=API_URL=https://your-api.example \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Debug SHA-1 for the keystore used by this release build (`Variant: debug`, which also signs the release APK):

```
9B:A0:5E:91:61:6A:17:C9:AB:77:52:26:D1:BF:36:D5:FC:85:C3:2B
```

Regenerate it on another machine with:

```bash
cd apps/mobile/android
./gradlew signingReport
```

Look for the `SHA1` line under `Variant: debug`. Paste that into the Android OAuth client. Firebase is optional; a Google Cloud OAuth client pair is enough. The API verifies the ID token with `google-auth-library` and `GOOGLE_CLIENT_ID`.

Phone OTP and email codes use the provider interface in `apps/api/src/auth/providers.ts`. `SMS_PROVIDER=console` and an empty `SMTP_HOST` print codes in the API log. Set `SMS_PROVIDER=http` plus `SMS_HTTP_URL`, or set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`, for real delivery.
