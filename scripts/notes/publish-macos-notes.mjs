#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith('--')) continue;
  const value = process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[++index]
    : 'true';
  args.set(key.slice(2), value);
}

const snapshot = args.get('snapshot') || 'notes-export/public-notes.json';
const branch = args.get('branch') || 'blog';
const remote = args.get('remote') || 'origin';
const push = args.get('push') === 'true';
const dryRun = args.get('dry-run') === 'true';
const skipExport = args.get('skip-export') === 'true';
const syncRemote = args.get('sync-remote') !== 'false';
const rootFolder = args.get('root') || 'guoyingwei.montaigne.io';
const commitPrefix = args.get('commit-prefix') || 'Sync Apple Notes snapshot';

function run(command, commandArgs, options = {}) {
  const printable = [command, ...commandArgs].join(' ');
  if (dryRun && options.mutates) {
    console.log(`[dry-run] ${printable}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Command failed (${result.status}): ${printable}`);
  }
  return result;
}

function output(command, commandArgs) {
  return run(command, commandArgs, { capture: true }).stdout.trim();
}

function porcelain(paths = []) {
  const result = run('git', ['status', '--porcelain', '--', ...paths], { capture: true });
  return result.stdout.trim();
}

const currentBranch = output('git', ['branch', '--show-current']);
if (currentBranch !== branch) {
  throw new Error(`Refusing to publish from branch "${currentBranch}". Expected "${branch}".`);
}

if (syncRemote) {
  run('git', ['pull', '--ff-only', remote, branch], { mutates: true });
}

if (!skipExport) {
  run('node', [
    'scripts/notes/export-macos-notes.mjs',
    '--root',
    rootFolder,
    '--out',
    snapshot
  ]);
}

if (!existsSync(snapshot)) {
  throw new Error(`Snapshot does not exist after export: ${snapshot}`);
}

const changed = porcelain([snapshot]);
if (!changed) {
  console.log(JSON.stringify({
    changed: false,
    snapshot,
    branch,
    pushed: false
  }, null, 2));
  process.exit(0);
}

const message = `${commitPrefix}: ${new Date().toISOString().slice(0, 10)}`;
if (dryRun) {
  console.log(JSON.stringify({
    changed: true,
    snapshot,
    branch,
    commitMessage: message,
    push,
    dryRun: true,
    status: changed
  }, null, 2));
  process.exit(0);
}

run('git', ['add', snapshot], { mutates: true });
run('git', ['commit', '-m', message], { mutates: true });

let pushed = false;
if (push) {
  run('git', ['push', remote, `${branch}:${branch}`], { mutates: true });
  pushed = true;
}

const logDir = resolve('logs');
mkdirSync(logDir, { recursive: true });
writeFileSync(resolve(logDir, 'notes-publish-last.json'), `${JSON.stringify({
  changed: true,
  snapshot,
  branch,
  commit: output('git', ['rev-parse', 'HEAD']),
  pushed,
  at: new Date().toISOString()
}, null, 2)}\n`);
