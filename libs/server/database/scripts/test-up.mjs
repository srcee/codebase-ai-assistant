import { spawnSync } from 'node:child_process';

// CI runs Postgres as a job service, and runners may lack Docker or the .env credentials.
if (process.env.CI === 'true') {
  console.log('CI provides the test database; skipping docker compose.');
  process.exit(0);
}

const result = spawnSync(
  'docker',
  ['compose', '--profile', 'test', 'up', '-d', '--wait', 'postgres-test'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
