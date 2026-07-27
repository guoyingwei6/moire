#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const label = 'com.guoyingwei.moire-blog-notes';
const interval = Number(process.env.MOIRE_NOTES_INTERVAL || '600');
const repoRoot = resolve(process.cwd());
const userId = String(process.getuid?.() ?? '').trim();
const launchAgentsDir = resolve(homedir(), 'Library/LaunchAgents');
const plistPath = resolve(launchAgentsDir, `${label}.plist`);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(scriptDir, 'launchd/com.guoyingwei.moire-blog-notes.plist');

const command = process.argv[2] || 'status';

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${bin} ${args.join(' ')} failed with status ${result.status}`);
  }
  return result;
}

function domainTarget() {
  if (!userId) throw new Error('Cannot determine current user id.');
  return `gui/${userId}/${label}`;
}

function renderPlist() {
  const template = readFileSync(templatePath, 'utf8');
  return template
    .replaceAll('__NODE__', process.execPath)
    .replaceAll('__WORKTREE__', repoRoot)
    .replace('<integer>600</integer>', `<integer>${interval}</integer>`);
}

function install() {
  mkdirSync(launchAgentsDir, { recursive: true });
  writeFileSync(plistPath, renderPlist());
  run('plutil', ['-lint', plistPath]);
  run('launchctl', ['bootout', `gui/${userId}`, plistPath], { allowFailure: true });
  run('launchctl', ['bootstrap', `gui/${userId}`, plistPath]);
  run('launchctl', ['enable', domainTarget()]);
  run('launchctl', ['kickstart', '-k', domainTarget()]);
  console.log(`installed ${plistPath}`);
}

function uninstall() {
  run('launchctl', ['bootout', `gui/${userId}`, plistPath], { allowFailure: true });
  console.log(`unloaded ${plistPath}`);
}

function status() {
  const result = run('launchctl', ['print', domainTarget()], { capture: true, allowFailure: true });
  if (result.status === 0) {
    process.stdout.write(result.stdout);
    return;
  }
  console.log(`not loaded: ${domainTarget()}`);
  if (existsSync(plistPath)) console.log(`plist exists: ${plistPath}`);
}

switch (command) {
  case 'install':
    install();
    break;
  case 'restart':
    uninstall();
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'status':
    status();
    break;
  default:
    throw new Error(`Unknown command "${command}". Use install, restart, uninstall, or status.`);
}
