// Состояние программы расширения в Markdown:
//   npm run expansion-status                 → таблица «группа × приоритет × решение» и ветки expansion/* на origin
//   npm run expansion-status -- --no-remote  → только таблицы по catalog.json без сетевого запроса git ls-remote
//   npm run expansion-status -- --remote upstream
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  expansionStatus,
  parseLsRemote,
  classifyBranches,
  formatExpansionStatus,
} from './lib/expansion-status.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const noRemote = args.includes('--no-remote');
const remoteFlag = args.indexOf('--remote');
const remote = remoteFlag >= 0 && args[remoteFlag + 1] ? args[remoteFlag + 1] : 'origin';
const catalogFlag = args.indexOf('--catalog');
const catalogPath = catalogFlag >= 0 && args[catalogFlag + 1]
  ? path.resolve(args[catalogFlag + 1])
  : path.join(ROOT, 'research/expansion/catalog.json');

const git = (gitArgs) => execFileSync('git', gitArgs, {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const hasCommit = (ref) => {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

function loadRemoteBranches(remoteName) {
  if (noRemote) return { remote: remoteName, skipped: true, branches: [] };
  let stdout;
  try {
    stdout = git(['ls-remote', '--heads', remoteName, 'refs/heads/expansion/*', 'refs/heads/main']);
  } catch (err) {
    const msg = (err.stderr?.toString() || err.message || String(err)).trim().split('\n')[0];
    return { remote: remoteName, error: msg, branches: [] };
  }

  const { mainSha, branches } = parseLsRemote(stdout);
  const mainRef = (mainSha && hasCommit(mainSha))
    ? mainSha
    : (hasCommit(`refs/remotes/${remoteName}/main`) ? `refs/remotes/${remoteName}/main` : null);

  if (!mainRef) {
    return {
      remote: remoteName,
      branches: classifyBranches(branches, { mainSha }),
    };
  }

  const allAncestors = new Set(git(['rev-list', mainRef]).split('\n').filter(Boolean));
  const firstParents = new Set(git(['rev-list', '--first-parent', mainRef]).split('\n').filter(Boolean));

  return {
    remote: remoteName,
    branches: classifyBranches(branches, {
      mainSha,
      isFetched: (sha) => allAncestors.has(sha) || hasCommit(sha),
      isAncestorOfMain: (sha) => allAncestors.has(sha),
      isMainFirstParent: (sha) => firstParents.has(sha),
    }),
  };
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const status = expansionStatus(catalog);
const remoteInfo = loadRemoteBranches(remote);
console.log(formatExpansionStatus(status, remoteInfo));
