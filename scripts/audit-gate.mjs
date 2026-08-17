/**
 * CI dependency-audit gate.
 *
 * `npm audit` exits non-zero whenever any advisory is open, which makes it
 * useless as a CI gate once a project carries an advisory it cannot fix (see
 * "Dependency audit state" in README.md). Suppressing whole severities or
 * dropping dev dependencies with `--omit=dev` would hide future problems too.
 *
 * This gate instead fails on anything that is not an explicitly reviewed,
 * time-boxed exception in audit-allowlist.json, and — just as importantly —
 * fails when an exception goes stale, so accepted risk cannot be forgotten:
 *
 *   - an advisory appears that is not on the allowlist        -> fail
 *   - an allowlisted advisory is past its reviewBy date       -> fail
 *   - an allowlisted advisory no longer appears in the audit  -> fail (delete it)
 *   - an allowlisted advisory changed severity or package     -> fail (re-review)
 *
 * No dependencies: adding a package to police packages defeats the point.
 *
 * Usage: npm run audit:ci
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST = path.join(ROOT, 'audit-allowlist.json');

const bold = s => `[1m${s}[0m`;
const red = s => `[31m${s}[0m`;
const yellow = s => `[33m${s}[0m`;
const green = s => `[32m${s}[0m`;
const dim = s => `[2m${s}[0m`;

/**
 * `npm audit` exits non-zero when advisories exist, so a non-zero code is not
 * itself an error here; we only care whether it produced parseable JSON.
 */
function runAudit() {
  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['audit', '--json'],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => {
        if (!stdout || !stdout.trim()) {
          reject(new Error(`npm audit produced no output: ${err?.message ?? 'unknown error'}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error('could not parse `npm audit --json` output'));
        }
      },
    );
  });
}

/**
 * Collapse the audit report to the distinct upstream advisories behind it.
 *
 * npm reports one entry per *affected package*, so a single flaw shows up
 * many times over as it propagates up the tree. The real advisories are the
 * object-valued `via` entries; string-valued ones are just propagation edges.
 */
function collectAdvisories(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !via.url) continue;
      const existing = found.get(via.url);
      if (existing) {
        existing.affects.add(vuln.name);
        continue;
      }
      found.set(via.url, {
        url: via.url,
        package: via.name,
        severity: via.severity,
        title: via.title,
        range: via.range,
        affects: new Set([vuln.name]),
      });
    }
  }
  return found;
}

function daysUntil(dateStr) {
  const due = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

const report = await runAudit();
const allowlist = JSON.parse(await readFile(ALLOWLIST, 'utf8'));
const allowed = new Map((allowlist.advisories ?? []).map(a => [a.url, a]));
const found = collectAdvisories(report);

const unreviewed = [];
const expired = [];
const changed = [];
const stale = [];
const accepted = [];

for (const [url, adv] of found) {
  const entry = allowed.get(url);
  if (!entry) {
    unreviewed.push(adv);
    continue;
  }
  if (entry.severity !== adv.severity || entry.package !== adv.package) {
    changed.push({ adv, entry });
    continue;
  }
  const remaining = daysUntil(entry.reviewBy);
  if (remaining === null || remaining < 0) {
    expired.push({ adv, entry, remaining });
    continue;
  }
  accepted.push({ adv, entry, remaining });
}

for (const [url, entry] of allowed) {
  if (!found.has(url)) stale.push(entry);
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  bold('\nDependency audit gate') +
    dim(`  (${counts.total ?? 0} npm audit entries -> ${found.size} distinct advisories)\n`),
);

for (const adv of unreviewed) {
  console.log(red(`  UNREVIEWED  ${adv.package}  [${adv.severity}]`));
  console.log(`              ${adv.title}`);
  console.log(dim(`              ${adv.url}`));
  console.log(dim(`              affects: ${[...adv.affects].sort().join(', ')}\n`));
}
for (const { adv, entry, remaining } of expired) {
  console.log(red(`  EXPIRED     ${adv.package}  [${adv.severity}]  reviewBy ${entry.reviewBy} (${Math.abs(remaining ?? 0)}d ago)`));
  console.log(dim(`              ${adv.url}\n`));
}
for (const { adv, entry } of changed) {
  console.log(red(`  CHANGED     ${adv.package}  [${adv.severity}]`));
  console.log(`              allowlist recorded ${entry.package} [${entry.severity}] — re-review before accepting`);
  console.log(dim(`              ${adv.url}\n`));
}
for (const entry of stale) {
  console.log(yellow(`  STALE       ${entry.package}  — no longer reported; delete this allowlist entry`));
  console.log(dim(`              ${entry.url}\n`));
}
for (const { adv, remaining } of accepted) {
  console.log(green(`  accepted    ${adv.package}  [${adv.severity}]  review in ${remaining}d`));
  console.log(dim(`              ${adv.title}`));
  console.log(dim(`              ${adv.url}\n`));
}

const failures = unreviewed.length + expired.length + changed.length + stale.length;
if (failures > 0) {
  console.log(
    red(bold(`FAIL`)) +
      `  ${failures} advisory issue(s) need attention` +
      (accepted.length ? dim(`, ${accepted.length} accepted`) : '') +
      '\n',
  );
  console.log(dim('  Fix the dependency, or add a reviewed entry to audit-allowlist.json'));
  console.log(dim('  with a reason, a mitigation and a reviewBy date.\n'));
  process.exit(1);
}

console.log(
  green(bold('PASS')) +
    `  no unreviewed advisories` +
    (accepted.length ? `, ${accepted.length} accepted exception(s)` : '') +
    '\n',
);
