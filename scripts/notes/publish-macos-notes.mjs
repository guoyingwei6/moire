#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

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

function stagedFiles() {
  const result = run('git', ['diff', '--cached', '--name-only', '-z'], { capture: true });
  return result.stdout.split('\0').filter(Boolean);
}

function assertNoStagedFiles(stage) {
  const files = stagedFiles();
  if (files.length) {
    throw new Error(`Refusing to publish with staged files ${stage}: ${files.join(', ')}`);
  }
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function allNotes(snapshot) {
  return [
    ...(snapshot?.root?.notes ?? []),
    ...(snapshot?.sections ?? []).flatMap((section) => section.notes ?? [])
  ];
}

function snapshotMetrics(snapshot) {
  const notes = allNotes(snapshot);
  return {
    notes: notes.length,
    tags: notes.reduce((sum, note) => sum + (Array.isArray(note.tags) ? note.tags.length : 0), 0),
    attachments: notes.reduce((sum, note) => sum + (Array.isArray(note.attachments) ? note.attachments.length : 0), 0)
  };
}

function maxDropRatio() {
  const value = Number(args.get('max-drop-ratio') ?? process.env.MOIRE_NOTES_MAX_DROP_RATIO ?? '0.5');
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`Invalid max drop ratio "${value}". Use a number from 0 (no decrease) to less than 1.`);
  }
  return value;
}

function assertSnapshotHealth(previous, current) {
  const diagnostics = current?.exportDiagnostics;
  if (diagnostics && diagnostics.status !== 'ok') {
    throw new Error(`Notes export is degraded: ${(diagnostics.reasons ?? []).join('; ') || 'see logs/notes-export-last.json'}`);
  }

  const previousMetrics = previous ? snapshotMetrics(previous) : null;
  if (!previousMetrics) return { previous: null, current: snapshotMetrics(current), drops: [] };

  const currentMetrics = snapshotMetrics(current);
  const threshold = maxDropRatio();
  const drops = Object.entries(previousMetrics).flatMap(([kind, previousCount]) => {
    const currentCount = currentMetrics[kind];
    if (!previousCount || currentCount >= previousCount * (1 - threshold)) return [];
    return [{ kind, previous: previousCount, current: currentCount, ratio: 1 - currentCount / previousCount }];
  });
  if (drops.length) {
    throw new Error(`Notes export dropped more than ${(threshold * 100).toFixed(0)}%: ${drops.map((drop) => `${drop.kind} ${drop.previous} -> ${drop.current}`).join(', ')}`);
  }
  return { previous: previousMetrics, current: currentMetrics, drops };
}

const currentBranch = output('git', ['branch', '--show-current']);
if (currentBranch !== branch) {
  throw new Error(`Refusing to publish from branch "${currentBranch}". Expected "${branch}".`);
}

assertNoStagedFiles('before pull/export');

const repoRoot = resolve(output('git', ['rev-parse', '--show-toplevel']));
const snapshotPath = resolve(snapshot);
const snapshotRepoPath = relative(repoRoot, snapshotPath).split(sep).join('/');
if (!snapshotRepoPath || snapshotRepoPath.startsWith('../') || snapshotRepoPath === '..') {
  throw new Error(`Snapshot must be inside the repository: ${snapshot}`);
}
if (syncRemote) {
  run('git', ['pull', '--ff-only', remote, branch], { mutates: true });
}

assertNoStagedFiles('after pull');

const previousSnapshot = existsSync(snapshotPath) ? readJson(snapshotPath, 'previous snapshot') : null;

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

const currentSnapshot = readJson(snapshotPath, 'exported snapshot');
const health = assertSnapshotHealth(previousSnapshot, currentSnapshot);

const changed = porcelain([snapshotRepoPath]);
if (!changed) {
  console.log(JSON.stringify({
    changed: false,
    snapshot,
    branch,
    pushed: false,
    health
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

run('git', ['add', '--', snapshotRepoPath], { mutates: true });
const stagedAfterAdd = stagedFiles();
if (stagedAfterAdd.length !== 1 || stagedAfterAdd[0] !== snapshotRepoPath) {
  throw new Error(`Refusing to commit unexpected staged files: ${stagedAfterAdd.join(', ') || '(none)'}`);
}
run('git', ['commit', '-m', message, '--', snapshotRepoPath], { mutates: true });
assertNoStagedFiles('after commit');

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
  health,
  commit: output('git', ['rev-parse', 'HEAD']),
  pushed,
  at: new Date().toISOString()
}, null, 2)}\n`);
