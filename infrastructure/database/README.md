# Database

PostgreSQL is the only supported database. The Prisma schema lives at `apps/api/prisma/schema.prisma`.

## Owner schema

The `User`, `Post`, `Like`, `Comment`, and `Follow` models keep the owner's fields and relations. Three nullability changes are additive and required by the extra sign-in methods:

- `email` is optional so a phone-only account can exist.
- `phone` is optional so a Google account can exist without a phone number.
- `passwordHash` is optional so OTP and Google accounts can exist without a password.

Passwords and OTP codes are stored as bcrypt hashes. `passwordHash` is never selected into public API responses.

## Added models

`Repost`, `FriendRequest`, `Friendship`, `Conversation`, `ConversationParticipant`, `Message`, `CallLog`, `LiveStream`, `LiveComment`, `Notification`, `Report`, `OtpCode`, `RefreshToken`, `Block`, `Mute`, and `AuditLog`.

`Follow.status` is `PENDING` or `ACCEPTED`. Public accounts are accepted immediately. Private accounts stay pending until the account holder accepts.

## Migrations

```bash
cd apps/api
npx prisma migrate dev
npx prisma migrate deploy   # production / docker
```

The first migration is `prisma/migrations/20261125172023_init`.

There is no seed that creates a password. Registering or signing in with an address in `ADMIN_EMAILS` (default `robinwebc@gmail.com`) creates or promotes that account to `ADMIN`.
