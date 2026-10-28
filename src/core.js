// Pure calculation helpers shared by the page and the Node tests.
(function (root) {
  'use strict';

  // Inclusive date range plus exact-match filters; an empty filter value means "all".
  function filterRows(rows, f = {}) {
    if (f.start && f.end && f.start > f.end) throw new Error('開始日期不可晚於結束日期');
    return rows.filter(r =>
      (!f.start || r.date >= f.start) &&
      (!f.end || r.date <= f.end) &&
      ['source', 'category', 'platform'].every(k => !f[k] || r[k] === f[k]));
  }

  // Rows are order lines, so orders and customers are de-duplicated by ID.
  function ecommerceSummary(rows) {
    const sales = rows.reduce((s, r) => s + r.amount, 0), orders = new Set(rows.map(r => r.order)).size;
    return {
      sales,
      orders,
      customers: new Set(rows.map(r => r.customer)).size,
      units: rows.reduce((s, r) => s + r.quantity, 0),
      aov: orders ? sales / orders : null,
    };
  }

  // Unknown sentiment stays out of the share denominator; empty input gives null, not 0.
  function socialSummary(rows) {
    let posts = 0, scored = 0, topics = 0;
    const counts = { '正面': 0, '中性': 0, '負面': 0 };
    for (const r of rows) {
      posts += r.count;
      if (Object.hasOwn(counts, r.label)) {
        counts[r.label] += r.count;
        scored += r.count;
      }
      if (r.topic !== null) topics += r.count;
    }
    return {
      posts,
      scored,
      unknown: posts - scored,
      coverage: posts ? scored / posts : null,
      topics,
      counts,
      shares: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, scored ? v / scored : null])),
    };
  }

  // Sum a metric (default: the row's count, else 1) by key; largest first, ties by name.
  function group(rows, key, metric) {
    const m = new Map();
    for (const r of rows) {
      const k = typeof key === 'function' ? key(r) : r[key], v = metric ? metric(r) : (r.count ?? 1);
      m.set(k, (m.get(k) || 0) + v);
    }
    return [...m]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
  }

  const api = { filterRows, ecommerceSummary, socialSummary, group };
  if (typeof module !== 'undefined') module.exports = api;
  else root.SMACore = api;
})(globalThis);
