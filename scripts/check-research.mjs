// Check the research queue independently of publication content and its historical graph.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'research/expansion', name), 'utf8'));
const catalog = read('catalog.json');
const sources = read('sources.json').sources;
const relations = read('relations.json');
const cards = fs.readdirSync(path.join(root, 'content/styles')).filter((name) => name.endsWith('.yaml'))
  .flatMap((name) => yaml.load(fs.readFileSync(path.join(root, 'content/styles', name), 'utf8')));
const errors = [];
const check = (ok, note) => { if (!ok) errors.push(note); };
const ids = new Set(catalog.items.map((item) => item.id));
const production = new Map(cards.map((card) => [card.id, card]));
const known = new Set([...ids, ...production.keys()]);
const sourceIds = new Set(sources.map((source) => source.id));
const kinds = new Set(['overview', 'tradition', 'period', 'movement', 'school', 'technique', 'design-system', 'internet-aesthetic', 'trend', 'author-style']);
const decisions = new Set(['candidate', 'published', 'merged', 'deferred', 'rejected']);
const decisionCounts = {};

check(ids.size === catalog.items.length, 'Duplicate candidate IDs');
check(sourceIds.size === sources.length, 'Duplicate research source IDs');
check(catalog.meta.totalCandidates === catalog.items.length, 'Stale totalCandidates');
check(catalog.meta.authorStyleCandidates === catalog.items.filter((item) => item.proposedKind === 'author-style').length, 'Stale authorStyleCandidates');
for (const item of catalog.items) {
  const at = `[${item.id}]`;
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `${at} Invalid ID`);
  check(kinds.has(item.proposedKind), `${at} Unknown research kind`);
  check(['P1', 'P2', 'R'].includes(item.priority), `${at} Unknown priority`);
  check(item.group in catalog.groups, `${at} Unknown working group`);
  check(Array.isArray(item.visualTraits) && item.visualTraits.length >= 3 && item.visualTraits.length <= 6, `${at} Needs 3–6 proposed traits`);
  check(Boolean(item.name && item.geography && item.dateHint && item.exampleCandidate && item.admissionRationale), `${at} Missing research scope`);
  for (const id of item.relatedIds) check(known.has(id), `${at} Unknown neighbour ${id}`);
  for (const id of item.sourceIds) check(sourceIds.has(id), `${at} Unknown research source ${id}`);
  const decision = item.admissionDecision;
  check(decisions.has(decision), `${at} Unknown admission decision`);
  decisionCounts[decision] = (decisionCounts[decision] ?? 0) + 1;
  if (decision === 'published' || decision === 'merged') {
    check(production.has(item.productionCardId), `${at} Missing productionCardId`);
    check(Boolean(item.decisionNote && /^\d{4}-\d{2}-\d{2}$/.test(item.decisionDate ?? '')), `${at} Decision needs reason and date`);
  } else if (decision === 'candidate') {
    check(!production.has(item.id), `${at} ID now exists in production: record publication or merge explicitly`);
    check(item.reviewStatus === 'proposal-not-publishable', `${at} Candidate must not claim publication readiness`);
  } else {
    check(Boolean(item.decisionNote), `${at} Deferral or rejection needs a reason`);
  }
}
for (const source of sources) {
  check(/^https:\/\//.test(source.url), `[${source.id}] Non-HTTPS research URL`);
  check(['opened', 'search-only', 'collection-route', 'reference-from-prior-turn'].includes(source.accessStatus), `[${source.id}] Unknown access status`);
  check(Boolean(source.supports), `[${source.id}] Missing limits of support`);
}
const seen = { historical: new Set(), comparison: new Set(), context: new Set() };
for (const edge of relations.historicalCandidates) {
  const key = [edge.fromId, edge.toId, edge.type].join(':');
  check(known.has(edge.fromId) && known.has(edge.toId), `Unknown historical endpoint ${key}`);
  check(['evolved', 'influence', 'reaction', 'revival'].includes(edge.type), `Unknown historical type ${key}`);
  check(edge.status === 'unverified', `Research hypothesis must stay unverified: ${key}`);
  for (const id of edge.sourceCandidates ?? []) check(sourceIds.has(id), `Unknown edge source ${id}`);
  check(!seen.historical.has(key), `Duplicate historical proposal ${key}`);
  seen.historical.add(key);
}
for (const edge of relations.comparisonCandidates) {
  const key = [edge.a, edge.b].sort().join(':');
  check(known.has(edge.a) && known.has(edge.b), `Unknown comparison endpoint ${key}`);
  check(Boolean(edge.note), `Comparison needs a reason ${key}`);
  check(!seen.comparison.has(key), `Duplicate comparison ${key}`);
  seen.comparison.add(key);
}
for (const edge of relations.contextCandidates) {
  const key = [edge.fromId, edge.toId, edge.type].join(':');
  check(known.has(edge.fromId) && known.has(edge.toId), `Unknown context endpoint ${key}`);
  check(['context-member', 'context-overlap', 'uses-technique'].includes(edge.type), `Unknown context type ${key}`);
  check(!seen.context.has(key), `Duplicate context ${key}`);
  seen.context.add(key);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ candidates: ids.size, decisions: decisionCounts, productionCards: production.size,
    researchSources: sourceIds.size, withReferences: catalog.items.filter((item) => item.sourceIds.length).length,
    historicalHypotheses: seen.historical.size, visualComparisons: seen.comparison.size, contextProposals: seen.context.size }, null, 2));
}
