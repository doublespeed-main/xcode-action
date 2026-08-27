// Turns the `ds xcode … --json` stream into GitHub annotations, a job summary and step outputs.
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
const root = (process.env.DS_PATH || '.').replace(/^\.\/?/, '');
const failOnError = (process.env.DS_FAIL ?? 'true') !== 'false';
const out = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v ?? '')}\n`);
const summary = (md) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
const esc = (s) => String(s ?? '').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
const rel = (f) => (f ? path.posix.normalize(path.posix.join(root, f.replace(/^\.\//, ''))) : undefined);

let lines = [];
try {
  lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
} catch {
  console.log('::error::ds produced no output (network or install problem)');
  process.exit(1);
}
const last = lines[lines.length - 1];
let job;
try {
  job = JSON.parse(last);
} catch {
  console.log(`::error::could not parse ds output: ${last?.slice(0, 200)}`);
  process.exit(1);
}
if (job.event) {
  // stream ended before the final job object (e.g. CLI exited early); surface what we have
  console.log(`::error::job did not complete: ${last.slice(0, 300)}`);
  process.exit(1);
}
if (job.error && !job.id) {
  // API-level error envelope from the CLI (401, 402, 400 …)
  const code = job.error.code ?? 'ERROR';
  const hint = code === 'INSUFFICIENT_CREDITS' ? ' — add credits at https://mac.doublespeed.ai/dashboard' : code === 'UNAUTHORIZED' ? ' — check the DS_API_KEY secret' : '';
  console.log(`::error::${code}: ${job.error.message}${hint}`);
  out('status', 'failed');
  out('error-code', code);
  process.exit(failOnError ? 1 : 0);
}

out('job-id', job.id);
out('status', job.status);
out('error-code', job.error?.code ?? '');

const diags = Array.isArray(job.diagnostics) ? job.diagnostics : [];
let annotated = 0;
for (const d of diags) {
  if (d.severity !== 'error' && d.severity !== 'warning') continue;
  if (annotated >= 50) break; // GitHub caps annotations per step
  const props = [d.file ? `file=${escProp(rel(d.file))}` : null, d.line ? `line=${d.line}` : null, d.column ? `col=${d.column}` : null].filter(Boolean).join(',');
  console.log(`::${d.severity}${props ? ' ' + props : ''}::${esc(d.message)}`);
  annotated++;
}
const tests = job.result?.tests;
for (const c of tests?.cases ?? []) {
  if (c.status !== 'failed' || annotated >= 50) continue;
  const props = [c.file ? `file=${escProp(rel(c.file))}` : null, c.line ? `line=${c.line}` : null].filter(Boolean).join(',');
  console.log(`::error${props ? ' ' + props : ''}::${esc(`${c.suite}.${c.name}: ${c.failure_message ?? 'failed'}`)}`);
  annotated++;
}

const ok = job.status === 'succeeded';
const t = job.timings ?? {};
const secs = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const md = [];
md.push(`## ${ok ? '✅' : '❌'} doublespeed ${job.operation ?? ''} — ${job.status}${job.error?.code ? ` (${job.error.code})` : ''}`);
if (job.error?.message && !ok) md.push(`> ${job.error.message}`);
if (tests) md.push(`**Tests:** ${tests.passed} passed · ${tests.failed} failed · ${tests.skipped ?? 0} skipped (${tests.executed} run)`);
const errs = diags.filter((d) => d.severity === 'error');
if (errs.length) {
  md.push('', '| File | Error |', '|---|---|');
  for (const d of errs.slice(0, 25)) md.push(`| \`${d.file ? `${rel(d.file)}:${d.line ?? ''}` : d.target ?? ''}\` | ${String(d.message).replace(/\|/g, '\\|').slice(0, 200)} |`);
  if (errs.length > 25) md.push(`| … | ${errs.length - 25} more |`);
}
const failed = (tests?.cases ?? []).filter((c) => c.status === 'failed');
if (failed.length) {
  md.push('', '| Test | Failure |', '|---|---|');
  for (const c of failed.slice(0, 25)) md.push(`| \`${c.suite}.${c.name}\` | ${String(c.failure_message ?? '').replace(/\|/g, '\\|').slice(0, 200)} |`);
}
md.push('', `Mac time ${secs(t.total_ms)} · queue ${secs(t.queued_ms)} · xcodebuild ${secs(t.execution_ms)}${t.dependencies_ms ? ` · deps ${secs(t.dependencies_ms)}` : ''} · job \`${job.id}\``);
if (Array.isArray(job.artifacts) && job.artifacts.length) md.push(`Artifacts: ${job.artifacts.map((a) => `${a.type} (${a.name ?? a.id})`).join(', ')} — \`ds xcode artifacts ${job.id}\``);
if (job.preview?.url) md.push(`Simulator: ${job.preview.url}`);
summary(md.join('\n'));
console.log(md.join('\n'));

if (!ok && failOnError) process.exit(1);
