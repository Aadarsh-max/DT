export const round1 = (n) => Math.round(n * 10) / 10;

// Pass rate = passed / executed, where executed = passed + failed + error (skipped excluded)
export const rate = (passed, executed) => (executed ? round1((passed / executed) * 100) : null);

const emptyTally = () => ({ total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 });

function add(t, status) {
  t.total += 1;
  if (status === 'PASSED') t.passed += 1;
  else if (status === 'FAILED') t.failed += 1;
  else if (status === 'ERROR') t.errors += 1;
  else t.skipped += 1;
}

export function finishTally(name, t) {
  const executed = t.passed + t.failed + t.errors;
  return { name, ...t, executed, passRate: rate(t.passed, executed) };
}

// Groups results by a key and counts each status
export function tallyBy(results, keyFn) {
  const map = new Map();
  for (const r of results) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, emptyTally());
    add(map.get(key), r.status);
  }
  return [...map]
    .map(([name, t]) => finishTally(name, t))
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
}

export function tallyAll(results) {
  const t = emptyTally();
  for (const r of results) add(t, r.status);
  return finishTally('all', t);
}