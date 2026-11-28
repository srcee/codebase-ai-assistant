// One-command start for people trying the project: checks Docker and Ollama, creates .env, starts the stack.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
const compose = ['compose', '--profile', 'app'];
const defaults = {
  EMBEDDING_MODEL: 'nomic-embed-text',
  CHAT_MODEL: 'qwen2.5-coder:7b',
  WEB_PORT: '8080',
};

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

function run(command, args, env = process.env) {
  return spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
}

function capture(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8' });
}

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    const value = match?.[2].replace(/^(['"])(.*)\1$/, '$2');
    // Empty values fall back to defaults, as in the API config.
    if (value) values[match[1]] = value;
  }
  return values;
}

function ensureEnvFile() {
  if (existsSync(envFile)) return;
  const user = 'codebase_ai';
  const password = randomBytes(24).toString('hex');
  const example = readFileSync(join(root, '.env.example'), 'utf8');
  const values = parseEnv(example);
  const url = (port, database) =>
    `postgres://${user}:${password}@127.0.0.1:${port}/${database}`;
  const content = example
    .replace(/^POSTGRES_USER=.*$/m, `POSTGRES_USER=${user}`)
    .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${password}`)
    .replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=${url(values.POSTGRES_PORT, values.POSTGRES_DB)}`,
    )
    .replace(
      /^TEST_DATABASE_URL=.*$/m,
      `TEST_DATABASE_URL=${url(values.POSTGRES_TEST_PORT, values.POSTGRES_TEST_DB)}`,
    );
  writeFileSync(envFile, content, { mode: 0o600 });
  console.log('Created .env with a random database password.');
}

function checkDocker() {
  const info = capture('docker', ['info']);
  if (info.error) {
    fail(
      'Docker is not installed. Get it from https://docs.docker.com/get-docker/',
    );
  }
  if (info.status !== 0)
    fail('Docker is installed but not running. Start Docker and try again.');
}

const withTag = (model) => (model.includes(':') ? model : `${model}:latest`);

function checkOllama(env) {
  const list = capture('ollama', ['list']);
  if (list.error) {
    fail('Ollama is not installed. Get it from https://ollama.com/download');
  }
  if (list.status !== 0)
    fail('Ollama is installed but not running. Start Ollama and try again.');

  const installed = list.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
  const required = [env.EMBEDDING_MODEL, env.CHAT_MODEL];
  const missing = required.filter(
    (model) => !installed.includes(withTag(model)),
  );
  if (missing.length === 0) return;

  console.error('\nThese Ollama models are missing:');
  for (const model of missing) console.error(`  ollama pull ${model}`);
  if (installed.length > 0) {
    console.error(
      `\nInstalled models: ${installed.join(', ')}. To use one of them for chat, set CHAT_MODEL in .env.`,
    );
  }
  fail('Pull the models above, then run npm start again.');
}

function up() {
  checkDocker();
  ensureEnvFile();
  const fileEnv = parseEnv(readFileSync(envFile, 'utf8'));
  const env = { ...defaults, ...fileEnv };
  checkOllama(env);

  const sourcesDir =
    process.env.SOURCES_DIR || fileEnv.SOURCES_DIR || homedir();
  console.log(
    'Building and starting the containers. The first run takes a few minutes.',
  );
  const started = run('docker', [...compose, 'up', '-d', '--build', '--wait'], {
    ...process.env,
    SOURCES_DIR: sourcesDir,
  });
  if (started.status !== 0)
    fail('The stack did not start. See the output above or run npm run logs.');

  console.log(`
Codebase AI Assistant is running at http://localhost:${env.WEB_PORT}

Register any repository or document folder under ${sourcesDir}
by pasting its path, for example ${join(sourcesDir, 'projects', 'my-repo')}

Stop it with npm stop. Follow the logs with npm run logs.`);
}

const commands = {
  up,
  down: () => run('docker', [...compose, 'down']),
  logs: () => run('docker', [...compose, 'logs', '--follow', 'api', 'web']),
};

const command = commands[process.argv[2]];
if (!command)
  fail(`Usage: node scripts/app.mjs <${Object.keys(commands).join('|')}>`);
process.exitCode = command()?.status ?? 0;
