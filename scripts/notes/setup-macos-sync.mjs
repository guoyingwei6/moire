#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const rootFolder = args.root || process.env.MOIRE_NOTES_ROOT || 'guoyingwei.montaigne.io';
const branch = args.branch || process.env.MOIRE_GIT_BRANCH || 'blog';
const interval = args.interval || process.env.MOIRE_NOTES_INTERVAL || '600';
const skipInstall = args['skip-install'] === 'true';
const skipExport = args['skip-export'] === 'true';
const skipAgent = args['skip-agent'] === 'true';

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    parsed[key.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[++index]
      : 'true';
  }
  return parsed;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      MOIRE_NOTES_INTERVAL: String(interval)
    }
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed with status ${result.status}`);
  }
  return result;
}

function output(command, commandArgs) {
  return run(command, commandArgs, { capture: true }).stdout.trim();
}

function requireCommand(command) {
  const result = run('/usr/bin/env', ['sh', '-lc', `command -v ${command}`], {
    capture: true,
    allowFailure: true
  });
  if (result.status !== 0) {
    throw new Error(`Missing required command: ${command}`);
  }
  return result.stdout.trim();
}

if (process.platform !== 'darwin') {
  throw new Error('This setup script only runs on macOS because it reads Apple Notes.');
}

for (const command of ['git', 'node', 'pnpm', 'osascript', 'launchctl', 'plutil']) {
  requireCommand(command);
}

const currentBranch = output('git', ['branch', '--show-current']);
if (currentBranch !== branch) {
  throw new Error(`Checkout branch "${branch}" first. Current branch is "${currentBranch}".`);
}

const repoRoot = resolve(process.cwd());
if (!existsSync(resolve(repoRoot, 'scripts/notes/export-macos-notes.mjs'))) {
  throw new Error('Run this script from the repository root.');
}

console.log(`moire macOS sync setup`);
console.log(`root folder: ${rootFolder}`);
console.log(`branch: ${branch}`);
console.log(`interval: ${interval} seconds`);
console.log(`worktree: ${repoRoot}`);

if (!skipInstall) {
  run('pnpm', ['install']);
}

if (!skipExport) {
  run('node', [
    'scripts/notes/export-macos-notes.mjs',
    '--root',
    rootFolder,
    '--out',
    'notes-export/public-notes.json'
  ]);
}

if (!skipAgent) {
  run('node', ['scripts/notes/manage-launchagent.mjs', 'install']);
}

run('node', ['scripts/notes/manage-launchagent.mjs', 'status']);

console.log('');
console.log('Setup finished.');
console.log('If Notes changed, the LaunchAgent will commit and push notes-export/public-notes.json on its scheduled run.');
console.log('Check logs with: tail -n 100 logs/launchd.out.log logs/launchd.err.log');
