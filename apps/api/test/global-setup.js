const { execSync } = require('child_process');
const path = require('path');

module.exports = function globalSetup() {
  process.env.DATABASE_URL =
    'postgresql://nsedo:nsedo@127.0.0.1:5432/nsedo_test';
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
};
