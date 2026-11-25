process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://nsedo:nsedo@127.0.0.1:5432/nsedo_test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.ADMIN_EMAILS = 'robinwebc@gmail.com';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.WEB_URL = 'http://localhost:3000';
process.env.PUBLIC_BASE_URL = 'http://localhost:4000';
process.env.UPLOAD_DIR = '/tmp/nsedo-test-uploads';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
