/**
 * Offline HTML contact sheet for human pilot review (no CDN, no framework).
 */

import type { CandidateAuditRecord } from './types'

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
	},
): string {
	const payload = records.map((row) => ({
		id: row.id,
		titleRu: row.titleRu,
		collectionId: row.collectionId,
		family: row.family,
		tier: row.tier,
		sizeKey: row.sizeKey,
		width: row.width,
		height: row.height,
		score: row.score,
		kind: row.kind,
		ascii: row.ascii,
	}))

	const cards = payload
		.map((row) => {
			const svg = bitmapToSvg(row.ascii, row.width, row.height)
			return `<article class="card" data-collection="${escapeHtml(row.collectionId)}" data-tier="${escapeHtml(String(row.tier))}" data-size="${escapeHtml(row.sizeKey)}" data-family="${escapeHtml(row.family)}" data-kind="${escapeHtml(row.kind)}">
  <div class="thumb">${svg}</div>
  <h3>${escapeHtml(row.titleRu)}</h3>
  <div class="meta">${escapeHtml(row.id)}</div>
  <div class="meta">${escapeHtml(row.sizeKey)} · ${escapeHtml(String(row.tier))}</div>
  <div class="meta">${escapeHtml(row.collectionId)} · ${escapeHtml(row.family)}</div>
</article>`
		})
		.join('\n')

	return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>Phase 8A Pilot Contact Sheet</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Segoe UI, Tahoma, sans-serif; margin: 16px; background: #e8e6e1; color: #222; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; align-items: end; }
  label { font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
  select, input { min-width: 140px; padding: 4px 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .card { background: #fff; border: 1px solid #cfcbc3; padding: 10px; }
  .card.hidden { display: none; }
  .thumb { display: flex; justify-content: center; align-items: center; min-height: 160px; background: #f4f4f0; border: 1px solid #ddd; margin-bottom: 8px; overflow: auto; }
  .thumb svg { image-rendering: pixelated; max-width: 100%; height: auto; }
  h3 { font-size: 15px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #555; word-break: break-all; }
  .stats { font-size: 12px; color: #444; margin-bottom: 8px; }
</style>
</head>
<body>
<h1>Phase 8A Pilot Contact Sheet (CANDIDATE)</h1>
<p class="stats">catalog=${escapeHtml(meta.catalogVersion)} · generator=${escapeHtml(meta.generatorVersion)} · items=<span id="visibleCount">${records.length}</span>/${records.length}<br/>checksum=${escapeHtml(meta.checksum)}</p>
<div class="toolbar">
  <label>Collection<select id="fCollection"><option value="">All</option></select></label>
  <label>Tier<select id="fTier"><option value="">All</option></select></label>
  <label>Size<select id="fSize"><option value="">All</option></select></label>
  <label>Family<select id="fFamily"><option value="">All</option></select></label>
  <label>Kind<select id="fKind"><option value="">All</option>
    <option value="object">object</option>
    <option value="scene">scene</option>
    <option value="pattern">pattern</option>
  </select></label>
  <label>Search<input id="fSearch" type="search" placeholder="title / id"/></label>
</div>
<div class="grid" id="grid">
${cards}
</div>
<script>
(function () {
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
  function apply() {
    var col = document.getElementById('fCollection').value;
    var tier = document.getElementById('fTier').value;
    var size = document.getElementById('fSize').value;
    var family = document.getElementById('fFamily').value;
    var kind = document.getElementById('fKind').value;
    var q = document.getElementById('fSearch').value.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (col && c.getAttribute('data-collection') !== col) ok = false;
      if (tier && c.getAttribute('data-tier') !== tier) ok = false;
      if (size && c.getAttribute('data-size') !== size) ok = false;
      if (family && c.getAttribute('data-family') !== family) ok = false;
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
  ['fCollection','fTier','fSize','fFamily','fKind','fSearch'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', apply);
    document.getElementById(id).addEventListener('change', apply);
  });
})();
</script>
</body>
</html>
`
}
