/**
 * Offline HTML contact sheet for Phase 8B Production Batch 250.
 * Views: All / Blind / Expert / Small / Warnings / Random / Repeated / Shortlist / Worst.
 * Review: APPROVE / REJECT / FIX / UNREVIEWED — localStorage + JSON export.
 * No CDN / external fonts / network images.
 */

import type { CandidateAuditRecord, SimilarityPair } from './types'

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function bitmapToSvg(
	ascii: string,
	width: number,
	height: number,
	cell = 8,
): string {
	const rows = ascii.split('\n')
	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width * cell}" height="${height * cell}" shape-rendering="crispEdges">`,
		`<rect width="100%" height="100%" fill="#f4f4f0"/>`,
	]
	for (let r = 0; r < height; r += 1) {
		const line = rows[r] ?? ''
		for (let c = 0; c < width; c += 1) {
			if (line[c] === '#') {
				parts.push(
					`<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#1a1a1a"/>`,
				)
			}
		}
	}
	parts.push('</svg>')
	return parts.join('')
}

export function buildContactSheetHtml(
	records: readonly CandidateAuditRecord[],
	meta: {
		readonly catalogVersion: string
		readonly generatorVersion: string
		readonly checksum: string
		readonly nearDuplicates?: readonly SimilarityPair[]
		readonly repeatedConcepts?: readonly {
			readonly conceptId: string
			readonly ids: readonly string[]
			readonly compositions: readonly string[]
			readonly titles: readonly string[]
		}[]
		readonly blindShortlist?: readonly string[]
		readonly randomSample30?: readonly string[]
		readonly worstCase20?: readonly string[]
		readonly distinctConcepts?: number
		readonly patternShare?: number
	},
): string {
	const shortlist = new Set(meta.blindShortlist ?? [])
	const randomSet = new Set(meta.randomSample30 ?? [])
	const worstSet = new Set(meta.worstCase20 ?? [])
	const repeatedIds = new Set(
		(meta.repeatedConcepts ?? []).flatMap((r) => r.ids),
	)

	const payload = records.map((row) => ({
		id: row.id,
		titleRu: row.titleRu,
		collectionId: row.collectionId,
		conceptId: row.conceptId,
		compositionId: row.compositionId,
		family: row.family,
		tier: row.tier,
		sizeKey: row.sizeKey,
		width: row.width,
		height: row.height,
		score: row.score,
		kind: row.kind,
		ascii: row.ascii,
		warnings: row.warnings,
		hintSteps: row.hintSteps,
		flags: row.rewardQualityFlags,
	}))

	const cards = payload
		.map((row) => {
			const svg = bitmapToSvg(row.ascii, row.width, row.height)
			const warn = row.warnings
				.filter((w) => w !== 'needs_human_recognizability_review')
				.map((w) => `<span class="badge">${escapeHtml(w)}</span>`)
				.join('')
			const flags = row.flags
				.map((f) => `<span class="badge bad">${escapeHtml(f)}</span>`)
				.join('')
			const hasWarn =
				row.warnings.some((w) => w !== 'needs_human_recognizability_review') ||
				row.flags.length > 0
			const isSmall = row.width <= 5 && row.height <= 5
			const isExpert = String(row.tier) === 'EXPERT'
			return `<article class="card" data-collection="${escapeHtml(row.collectionId)}" data-tier="${escapeHtml(String(row.tier))}" data-size="${escapeHtml(row.sizeKey)}" data-family="${escapeHtml(row.family)}" data-kind="${escapeHtml(row.kind)}" data-concept="${escapeHtml(row.conceptId)}" data-id="${escapeHtml(row.id)}" data-shortlist="${shortlist.has(row.id) ? '1' : '0'}" data-random="${randomSet.has(row.id) ? '1' : '0'}" data-worst="${worstSet.has(row.id) ? '1' : '0'}" data-repeated="${repeatedIds.has(row.id) ? '1' : '0'}" data-warn="${hasWarn ? '1' : '0'}" data-small="${isSmall ? '1' : '0'}" data-expert="${isExpert ? '1' : '0'}">
  <div class="thumb">${svg}</div>
  <h3 class="title">${escapeHtml(row.titleRu)}</h3>
  <div class="meta default-meta">${escapeHtml(row.collectionId)} · ${escapeHtml(row.sizeKey)} · ${escapeHtml(String(row.tier))}</div>
  <div class="meta tech hidden">ID: ${escapeHtml(row.id)}<br/>concept: ${escapeHtml(row.conceptId)} / ${escapeHtml(row.compositionId)}<br/>family: ${escapeHtml(row.family)} · score: ${row.score ?? 'n/a'} · hints: ${row.hintSteps}<br/>${warn}${flags}</div>
  <div class="review">
    <button type="button" data-dec="APPROVE">Approve</button>
    <button type="button" data-dec="REJECT">Reject</button>
    <button type="button" data-dec="FIX">Fix</button>
    <select class="reason">
      <option value="">Причина</option>
      <option value="unrecognizable">unrecognizable</option>
      <option value="duplicate">duplicate</option>
      <option value="too_similar">too_similar</option>
      <option value="too_simple">too_simple</option>
      <option value="ugly">ugly</option>
      <option value="title_mismatch">title_mismatch</option>
      <option value="wrong_collection">wrong_collection</option>
      <option value="strange_difficulty">strange_difficulty</option>
      <option value="other">other</option>
    </select>
  </div>
</article>`
		})
		.join('\n')

	const nearSection = (meta.nearDuplicates ?? [])
		.map(
			(p) =>
				`<li>${escapeHtml(p.idA)} (${escapeHtml(p.titleA)} / ${escapeHtml(p.conceptA)}) ↔ ${escapeHtml(p.idB)} (${escapeHtml(p.titleB)} / ${escapeHtml(p.conceptB)}) · ${escapeHtml(p.sizeKey)} · ${p.similarity.toFixed(4)}</li>`,
		)
		.join('\n')

	const repeatedSection = (meta.repeatedConcepts ?? [])
		.map(
			(r) =>
				`<li><strong>${escapeHtml(r.conceptId)}</strong>: ${escapeHtml(r.compositions.join(' + '))} — ${escapeHtml(r.titles.join(' / '))} — ${escapeHtml(r.ids.join(', '))}</li>`,
		)
		.join('\n')

	const patternPct = ((meta.patternShare ?? 0) * 100).toFixed(1)

	return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>Phase 8B Production 250 — CANDIDATE</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Segoe UI, Tahoma, sans-serif; margin: 16px; background: #e8e6e1; color: #222; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .toolbar, .modes, .views { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; align-items: end; }
  label { font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
  select, input, button { padding: 4px 8px; }
  .views button.active { outline: 2px solid #1565c0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  body.blind .grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .card { background: #fff; border: 1px solid #cfcbc3; padding: 10px; }
  .card.hidden { display: none; }
  .thumb { display: flex; justify-content: center; align-items: center; min-height: 160px; background: #f4f4f0; border: 1px solid #ddd; margin-bottom: 8px; overflow: auto; }
  body.blind .thumb { min-height: 200px; }
  .thumb svg { image-rendering: pixelated; max-width: 100%; height: auto; }
  h3 { font-size: 15px; margin: 0 0 4px; }
  body.blind .title, body.blind-collection .default-meta { visibility: hidden; }
  body.blind .title::after { content: '(скрыто)'; visibility: visible; color: #888; font-weight: normal; font-size: 12px; }
  .meta { font-size: 11px; color: #555; word-break: break-all; }
  .tech.hidden { display: none; }
  body.tech .tech.hidden { display: block; }
  .badge { display: inline-block; background: #fff3cd; border: 1px solid #e0c36a; padding: 1px 4px; margin: 2px 2px 0 0; font-size: 10px; }
  .badge.bad { background: #ffebee; border-color: #ef9a9a; }
  .stats { font-size: 12px; color: #444; margin-bottom: 8px; }
  .counters { font-size: 12px; margin-bottom: 8px; }
  .review button { margin-right: 4px; }
  .card[data-decision="APPROVE"] { outline: 2px solid #2e7d32; }
  .card[data-decision="REJECT"] { outline: 2px solid #c62828; }
  .card[data-decision="FIX"] { outline: 2px solid #ef6c00; }
  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .panel { background: #fff; border: 1px solid #cfcbc3; padding: 10px; font-size: 12px; }
  @media (max-width: 900px) { .panels { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Phase 8B Production 250 — CANDIDATE</h1>
<p class="stats">catalog=${escapeHtml(meta.catalogVersion)} · generator=${escapeHtml(meta.generatorVersion)} · selected=${records.length}<br/>
checksum=${escapeHtml(meta.checksum)} · distinctConcepts=${meta.distinctConcepts ?? 'n/a'} · patternShare=${patternPct}%<br/>
visible=<span id="visibleCount">${records.length}</span>/${records.length}</p>
<p class="counters">Reviewed <span id="cReviewed">0</span> / ${records.length} · Approved <span id="cApproved">0</span> · Rejected <span id="cRejected">0</span> · Fix <span id="cFix">0</span> · Unreviewed <span id="cUnreviewed">${records.length}</span></p>
<div class="views">
  <button type="button" class="viewBtn active" data-view="all">All 250</button>
  <button type="button" class="viewBtn" data-view="blind">Blind shortlist</button>
  <button type="button" class="viewBtn" data-view="random">Random 30</button>
  <button type="button" class="viewBtn" data-view="worst">Worst-case 20</button>
  <button type="button" class="viewBtn" data-view="expert">Expert</button>
  <button type="button" class="viewBtn" data-view="small">5×5 / small</button>
  <button type="button" class="viewBtn" data-view="warnings">Warnings</button>
  <button type="button" class="viewBtn" data-view="repeated">Repeated concepts</button>
</div>
<div class="modes">
  <button type="button" id="toggleBlind">Проверка без названий</button>
  <button type="button" id="toggleTech">Технические данные</button>
  <button type="button" id="exportReview">Export review JSON</button>
</div>
<div class="toolbar">
  <label>Collection<select id="fCollection"><option value="">All</option></select></label>
  <label>Tier<select id="fTier"><option value="">All</option></select></label>
  <label>Size<select id="fSize"><option value="">All</option></select></label>
  <label>Family<select id="fFamily"><option value="">All</option></select></label>
  <label>Concept<select id="fConcept"><option value="">All</option></select></label>
  <label>Kind<select id="fKind"><option value="">All</option>
    <option value="object">object</option>
    <option value="scene">scene</option>
    <option value="symbol">symbol</option>
    <option value="pattern">pattern</option>
  </select></label>
  <label>Search<input id="fSearch" type="search" placeholder="title / id / concept"/></label>
</div>
<div class="panels">
  <div class="panel"><strong>Repeated concepts</strong><ul>${repeatedSection || '<li>none</li>'}</ul></div>
  <div class="panel"><strong>Near duplicates ≥0.92</strong><ul>${nearSection || '<li>none</li>'}</ul></div>
</div>
<div class="grid" id="grid">
${cards}
</div>
<script>
(function () {
  var CHECKSUM = ${JSON.stringify(meta.checksum)};
  var STORAGE_KEY = 'b250-r1-review-' + CHECKSUM;
  var currentView = 'all';
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  function unique(attr) {
    var set = {};
    cards.forEach(function (c) { set[c.getAttribute(attr)] = true; });
    return Object.keys(set).sort();
  }
  function fill(selectId, values) {
    var sel = document.getElementById(selectId);
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = v; sel.appendChild(opt);
    });
  }
  fill('fCollection', unique('data-collection'));
  fill('fTier', unique('data-tier'));
  fill('fSize', unique('data-size'));
  fill('fFamily', unique('data-family'));
  fill('fConcept', unique('data-concept'));

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  var state = loadState();

  function updateCounters() {
    var approved = 0, rejected = 0, fix = 0, reviewed = 0;
    cards.forEach(function (card) {
      var d = card.getAttribute('data-decision') || '';
      if (d === 'APPROVE') { approved += 1; reviewed += 1; }
      else if (d === 'REJECT') { rejected += 1; reviewed += 1; }
      else if (d === 'FIX') { fix += 1; reviewed += 1; }
    });
    document.getElementById('cApproved').textContent = String(approved);
    document.getElementById('cRejected').textContent = String(rejected);
    document.getElementById('cFix').textContent = String(fix);
    document.getElementById('cReviewed').textContent = String(reviewed);
    document.getElementById('cUnreviewed').textContent = String(cards.length - reviewed);
  }

  cards.forEach(function (card) {
    var id = card.getAttribute('data-id');
    var entry = state[id];
    if (entry && entry.decision) {
      card.setAttribute('data-decision', entry.decision);
      if (entry.reason) card.querySelector('.reason').value = entry.reason;
    }
    card.querySelectorAll('button[data-dec]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dec = btn.getAttribute('data-dec');
        card.setAttribute('data-decision', dec);
        state[id] = {
          puzzleId: id,
          decision: dec,
          reason: card.querySelector('.reason').value || null,
          note: null
        };
        saveState(state);
        updateCounters();
      });
    });
    card.querySelector('.reason').addEventListener('change', function () {
      var dec = card.getAttribute('data-decision') || 'REJECT';
      state[id] = {
        puzzleId: id,
        decision: dec,
        reason: card.querySelector('.reason').value || null,
        note: null
      };
      saveState(state);
    });
  });
  updateCounters();

  function viewMatch(c) {
    if (currentView === 'all') return true;
    if (currentView === 'blind') return c.getAttribute('data-shortlist') === '1';
    if (currentView === 'random') return c.getAttribute('data-random') === '1';
    if (currentView === 'worst') return c.getAttribute('data-worst') === '1';
    if (currentView === 'expert') return c.getAttribute('data-expert') === '1';
    if (currentView === 'small') return c.getAttribute('data-small') === '1';
    if (currentView === 'warnings') return c.getAttribute('data-warn') === '1';
    if (currentView === 'repeated') return c.getAttribute('data-repeated') === '1';
    return true;
  }

  function apply() {
    var col = document.getElementById('fCollection').value;
    var tier = document.getElementById('fTier').value;
    var size = document.getElementById('fSize').value;
    var family = document.getElementById('fFamily').value;
    var concept = document.getElementById('fConcept').value;
    var kind = document.getElementById('fKind').value;
    var q = document.getElementById('fSearch').value.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (c) {
      var ok = viewMatch(c);
      if (col && c.getAttribute('data-collection') !== col) ok = false;
      if (tier && c.getAttribute('data-tier') !== tier) ok = false;
      if (size && c.getAttribute('data-size') !== size) ok = false;
      if (family && c.getAttribute('data-family') !== family) ok = false;
      if (concept && c.getAttribute('data-concept') !== concept) ok = false;
      if (kind && c.getAttribute('data-kind') !== kind) ok = false;
      if (q) {
        var text = (c.textContent || '').toLowerCase();
        if (text.indexOf(q) === -1) ok = false;
      }
      c.classList.toggle('hidden', !ok);
      if (ok) visible += 1;
    });
    document.getElementById('visibleCount').textContent = String(visible);
  }
  ['fCollection','fTier','fSize','fFamily','fConcept','fKind','fSearch'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', apply);
    document.getElementById(id).addEventListener('change', apply);
  });

  document.querySelectorAll('.viewBtn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentView = btn.getAttribute('data-view');
      document.querySelectorAll('.viewBtn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      if (currentView === 'blind') {
        document.body.classList.add('blind');
        document.body.classList.add('blind-collection');
      }
      apply();
    });
  });

  document.getElementById('toggleBlind').addEventListener('click', function () {
    document.body.classList.toggle('blind');
    document.body.classList.toggle('blind-collection');
  });
  document.getElementById('toggleTech').addEventListener('click', function () {
    document.body.classList.toggle('tech');
  });
  document.getElementById('exportReview').addEventListener('click', function () {
    var decisions = Object.keys(state).sort().map(function (k) {
      var e = state[k];
      return {
        catalogChecksum: CHECKSUM,
        puzzleId: e.puzzleId,
        decision: e.decision,
        reason: e.reason || null,
        note: e.note || null
      };
    });
    var payload = {
      catalogChecksum: CHECKSUM,
      catalogVersion: ${JSON.stringify(meta.catalogVersion)},
      decisions: decisions
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'b250-r1-review.json';
    a.click();
  });
  apply();
})();
</script>
</body>
</html>
`
}
