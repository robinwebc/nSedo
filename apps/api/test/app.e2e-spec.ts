import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { OtpService } from '../src/auth/otp.service';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';

const password = 'password123';

function account(username: string, n: number) {
  return {
    username,
    displayName: username,
    email: `${username}@example.com`,
    phone: `+880170000${String(n).padStart(4, '0')}`,
    password,
  };
}

describe('nSedo API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: OtpService;
  let server: Server;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('nsedo_test')) {
      throw new Error('Refusing to run e2e outside nsedo_test');
    }
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>();
    await configureApp(nest);
    await nest.init();
    await nest.listen(0);
    app = nest;
    server = nest.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    otp = app.get(OtpService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditLog",
        "RefreshToken",
        "OtpCode",
        "Report",
        "Notification",
        "LiveComment",
        "LiveStream",
        "CallLog",
        "Message",
        "ConversationParticipant",
        "Conversation",
        "Friendship",
        "FriendRequest",
        "Repost",
        "Follow",
        "Comment",
        "Like",
        "Post",
        "Mute",
        "Block",
        "User"
      CASCADE
    `);
  });

  async function register(body: ReturnType<typeof account>) {
    const res = await request(server).post('/auth/register').send(body);
    expect(res.status).toBe(201);
    return res.body as {
      userId: string;
      username: string;
      message: string;
    };
  }

  async function login(identifier: string) {
    const res = await request(server)
      .post('/auth/login')
      .send({ identifier, password });
    expect(res.status).toBe(200);
    return res.body as {
      userId: string;
      accessToken: string;
      refreshToken: string;
    };
  }

  it('registers, logs in, and hides secrets', async () => {
    const created = await register(account('sara', 1));
    expect(created).toEqual({
      userId: expect.stringMatching(/^nSedo\d{6}$/),
      username: 'sara',
      message: 'Account created successfully',
    });
    await request(server)
      .post('/auth/login')
      .send({ identifier: 'sara', password: 'wrong-password' })
      .expect(401);
    const session = await login('sara@example.com');
    expect(session.userId).toBe(created.userId);
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session).not.toHaveProperty('passwordHash');
    const me = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe('sara@example.com');
    expect(me.body.phone).toBe('+8801700000001');
    expect(me.body).not.toHaveProperty('passwordHash');
    const profile = await request(server)
      .get('/users/sara')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(profile.body).not.toHaveProperty('email');
    expect(profile.body).not.toHaveProperty('phone');
    expect(profile.body).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate email and reserved usernames', async () => {
    await register(account('sara', 1));
    const dup = await request(server)
      .post('/auth/register')
      .send(account('sara', 1));
    expect(dup.status).toBe(409);
    expect(dup.body.message).toEqual(
      expect.stringMatching(/already in use/),
    );
    const reserved = await request(server)
      .post('/auth/register')
      .send({ ...account('admin', 2), username: 'admin' });
    expect(reserved.status).toBe(400);
  });

  it('checks username availability and rate-limits changes', async () => {
    const session = await login((await register(account('sara', 1))).username);
    const free = await request(server)
      .get('/users/username-available')
      .query({ username: 'sara_new' })
      .expect(200);
    expect(free.body.available).toBe(true);
    const taken = await request(server)
      .get('/users/username-available')
      .query({ username: 'admin' })
      .expect(200);
    expect(taken.body.available).toBe(false);
    await request(server)
      .patch('/users/me/username')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ username: 'sara_new' })
      .expect(200);
    await request(server)
      .patch('/users/me/username')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ username: 'sara_next' })
      .expect(429);
  });

  it('opens a phone account with a hashed OTP and signs in', async () => {
    await request(server)
      .post('/auth/otp/request')
      .send({ channel: 'SMS', target: '+8801712345678', purpose: 'REGISTER' })
      .expect(200);
    expect(otp.devLast?.code).toMatch(/^\d{6}$/);
    const stored = await prisma.otpCode.findFirst({
      where: { target: '+8801712345678' },
    });
    expect(stored?.codeHash).not.toBe(otp.devLast?.code);
    const verified = await request(server)
      .post('/auth/otp/verify')
      .send({
        channel: 'SMS',
        target: '+8801712345678',
        purpose: 'REGISTER',
        code: otp.devLast?.code,
        username: 'mina',
        displayName: 'Mina',
      })
      .expect(200);
    expect(verified.body.userId).toMatch(/^nSedo\d{6}$/);
    expect(verified.body.accessToken).toEqual(expect.any(String));
    const me = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${verified.body.accessToken}`)
      .expect(200);
    expect(me.body.phone).toBe('+8801712345678');
    expect(me.body.email).toBeNull();
    expect(me.body.phoneVerified).toBe(true);
  });

  it('opens an email-code account for the super admin', async () => {
    await request(server)
      .post('/auth/otp/request')
      .send({
        channel: 'EMAIL',
        target: 'robinwebc@gmail.com',
        purpose: 'LOGIN',
      })
      .expect(200);
    const verified = await request(server)
      .post('/auth/otp/verify')
      .send({
        channel: 'EMAIL',
        target: 'robinwebc@gmail.com',
        purpose: 'LOGIN',
        code: otp.devLast?.code,
        username: 'robin',
        displayName: 'Robin',
      })
      .expect(200);
    const me = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${verified.body.accessToken}`)
      .expect(200);
    expect(me.body.role).toBe('ADMIN');
    expect(me.body.email).toBe('robinwebc@gmail.com');
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    await register(account('sara', 1));
    const first = await login('sara');
    const rotated = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('posts, likes, comments, reposts, and deletes', async () => {
    const sara = await login((await register(account('sara', 1))).username);
    const mina = await login((await register(account('mina', 2))).username);
    const post = await request(server)
      .post('/posts')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ body: 'Hello nSedo' })
      .expect(201);
    expect(post.body.shareUrl).toContain(post.body.id);
    await request(server)
      .post(`/posts/${post.body.id}/like`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    await request(server)
      .post(`/posts/${post.body.id}/comments`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .send({ body: 'Nice' })
      .expect(201);
    const quoted = await request(server)
      .post(`/posts/${post.body.id}/repost`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .send({ quote: 'Look at this' })
      .expect(200);
    expect(quoted.body.repostCount).toBe(1);
    const feed = await request(server)
      .get('/posts/feed')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    expect(feed.body[0].post.body).toBe('Hello nSedo');
    const notes = await request(server)
      .get('/notifications')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    expect(notes.body.unreadCount).toBeGreaterThanOrEqual(2);
    await request(server)
      .delete(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(403);
    await request(server)
      .delete(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
  });

  it('keeps private posts visible only to approved followers', async () => {
    const sara = await login((await register(account('sara', 1))).username);
    const mina = await login((await register(account('mina', 2))).username);
    await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ privacy: 'PRIVATE' })
      .expect(200);
    const post = await request(server)
      .post('/posts')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ body: 'Only friends of the feed' })
      .expect(201);
    await request(server)
      .get(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(404);
    const follow = await request(server)
      .post('/follows/sara')
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    expect(follow.body.status).toBe('PENDING');
    await request(server)
      .get(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(404);
    const requests = await request(server)
      .get('/follows/requests')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    await request(server)
      .post(`/follows/requests/${requests.body[0].id}/accept`)
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    await request(server)
      .get(`/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
  });

  it('follows publicly and completes a friend request', async () => {
    const sara = await login((await register(account('sara', 1))).username);
    const mina = await login((await register(account('mina', 2))).username);
    const follow = await request(server)
      .post('/follows/mina')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    expect(follow.body.status).toBe('ACCEPTED');
    const sent = await request(server)
      .post('/friends/requests')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ username: 'mina' })
      .expect(201);
    const incoming = await request(server)
      .get('/friends/requests')
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    expect(incoming.body[0].id).toBe(sent.body.id);
    await request(server)
      .post(`/friends/requests/${sent.body.id}/accept`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    const friends = await request(server)
      .get('/friends')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    expect(friends.body.map((user: { username: string }) => user.username)).toContain(
      'mina',
    );
  });

  it('sends a direct message and a typing event', async () => {
    const sara = await login((await register(account('sara', 1))).username);
    const mina = await login((await register(account('mina', 2))).username);
    const convo = await request(server)
      .post('/conversations')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ username: 'mina' })
      .expect(201);
    await request(server)
      .post(`/conversations/${convo.body.id}/messages`)
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ body: 'Hi Mina' })
      .expect(201);
    const messages = await request(server)
      .get(`/conversations/${convo.body.id}/messages`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    expect(messages.body[0].body).toBe('Hi Mina');
    await request(server)
      .post(`/conversations/${convo.body.id}/read`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    const notes = await request(server)
      .get('/notifications')
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .expect(200);
    expect(notes.body.items.some((item: { type: string }) => item.type === 'MESSAGE')).toBe(
      true,
    );
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const socket: Socket = io(`http://127.0.0.1:${port}`, {
      auth: { token: mina.accessToken },
      transports: ['websocket'],
      autoConnect: false,
    });
    const sender: Socket = io(`http://127.0.0.1:${port}`, {
      auth: { token: sara.accessToken },
      transports: ['websocket'],
      autoConnect: false,
    });
    const waitReady = (client: Socket) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('socket ready timeout')), 8000);
        client.on('ready', () => {
          clearTimeout(timer);
          resolve();
        });
        client.on('connect_error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        client.connect();
      });
    try {
      await waitReady(socket);
      await waitReady(sender);
      const typing = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('typing timeout')), 8000);
        socket.on('typing', (payload: { conversationId: string }) => {
          if (payload.conversationId === convo.body.id) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      sender.emit('typing', { conversationId: convo.body.id });
      await typing;
    } finally {
      socket.close();
      sender.close();
    }
  });

  it('blocks messages and records a call', async () => {
    const sara = await login((await register(account('sara', 1))).username);
    const mina = await login((await register(account('mina', 2))).username);
    await request(server)
      .post('/blocks/mina')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    await request(server)
      .post('/conversations')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ username: 'mina' })
      .expect(403);
    await request(server)
      .delete('/blocks/mina')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .expect(200);
    const call = await request(server)
      .post('/calls')
      .set('Authorization', `Bearer ${sara.accessToken}`)
      .send({ username: 'mina', type: 'VIDEO' })
      .expect(201);
    expect(call.body.status).toBe('RINGING');
    expect(call.body.iceServers[0].urls).toBe('stun:stun.l.google.com:19302');
    await request(server)
      .patch(`/calls/${call.body.id}`)
      .set('Authorization', `Bearer ${mina.accessToken}`)
      .send({ status: 'REJECTED' })
      .expect(200);
  });

  it('lets only ADMIN change moderator roles and writes an audit log', async () => {
    const admin = await login(
      (
        await register({
          username: 'robin',
          displayName: 'Robin',
          email: 'robinwebc@gmail.com',
          phone: '+8801710000001',
          password,
        })
      ).username,
    );
    const me = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(me.body.role).toBe('ADMIN');
    await request(server)
      .get('/admin/stats')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const sara = await register(account('sara', 1));
    const mina = await register(account('mina', 2));
    const saraRow = await prisma.user.findUnique({
      where: { username: 'sara' },
    });
    const minaRow = await prisma.user.findUnique({
      where: { username: 'mina' },
    });
    await request(server)
      .patch(`/admin/users/${saraRow?.id}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: 'MODERATOR' })
      .expect(200);
    const saraSession = await login(sara.username);
    await request(server)
      .patch(`/admin/users/${minaRow?.id}/role`)
      .set('Authorization', `Bearer ${saraSession.accessToken}`)
      .send({ role: 'MODERATOR' })
      .expect(403);
    await request(server)
      .get('/admin/stats')
      .set('Authorization', `Bearer ${saraSession.accessToken}`)
      .expect(200);
    await request(server)
      .patch(`/admin/users/${minaRow?.id}/ban`)
      .set('Authorization', `Bearer ${saraSession.accessToken}`)
      .send({ banned: true })
      .expect(200);
    await request(server)
      .post('/auth/login')
      .send({ identifier: mina.username, password })
      .expect(401);
    await request(server)
      .patch(`/admin/users/${minaRow?.id}/ban`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ banned: false })
      .expect(200);
    await request(server)
      .patch(`/admin/users/${minaRow?.id}/verify`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ verifiedBadge: true })
      .expect(200);
    const post = await request(server)
      .post('/posts')
      .set('Authorization', `Bearer ${saraSession.accessToken}`)
      .send({ body: 'moderate me' })
      .expect(201);
    await request(server)
      .post('/reports')
      .set('Authorization', `Bearer ${saraSession.accessToken}`)
      .send({
        targetType: 'POST',
        targetId: post.body.id,
        reason: 'spam',
      })
      .expect(201);
    const reports = await request(server)
      .get('/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    await request(server)
      .patch(`/admin/reports/${reports.body[0].id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    await request(server)
      .delete(`/admin/posts/${post.body.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const live = await request(server)
      .post('/live')
      .set('Authorization', `Bearer ${saraSession.accessToken}`)
      .send({ title: 'Evening live' })
      .expect(201);
    await request(server)
      .patch(`/admin/live/${live.body.id}/end`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const audit = await request(server)
      .get('/admin/audit')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const actions = audit.body.map((row: { action: string }) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining(['user.role', 'user.ban', 'post.delete', 'live.end']),
    );
    await request(server)
      .patch(`/admin/users/${me.body.id}/role`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: 'USER' })
      .expect(403);
  });

  it('exports account data and deletes the account', async () => {
    const session = await login((await register(account('sara', 1))).username);
    await request(server)
      .post('/posts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ body: 'mine' })
      .expect(201);
    const exported = await request(server)
      .get('/users/me/export')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(exported.body.profile.email).toBe('sara@example.com');
    expect(JSON.stringify(exported.body)).not.toContain('passwordHash');
    expect(exported.body.posts).toHaveLength(1);
    await request(server)
      .delete('/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ confirmation: 'DELETE', password })
      .expect(200);
    await request(server)
      .post('/auth/login')
      .send({ identifier: 'sara', password })
      .expect(401);
  });

  it('rejects an unconfigured Google token', async () => {
    await request(server)
      .post('/auth/google')
      .send({ idToken: 'not-a-real-token' })
      .expect(503);
  });
});
