/**
 * Rescore B250-R1 with Phase 8B.1 analyzer for calibration.
 * Title-independent: uses ascii + kind only.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parseAscii } from './bitmap'
import { contentPaths } from './paths'
import {
	analyzeRewardQuality,
	compareRiskDesc,
} from './rewardQuality'
import type { ContentKind, PilotManifest } from './types'

const HUMAN_WEAK = [
	'b250mb-brick',
	'beg-l',
	'b250mb-safe2',
	'b250-salt',
] as const

const HUMAN_GOOD = [
	'ani-bear',
	'ani-hedgehog',
	'b250-lightning',
	'b250-peace',
	'hx2-harp',
	'hx2-kraken',
	'sea-octopus',
	'b250hf-clocktower',
	'hx4-palm-hut',
] as const

function main(): void {
	const paths = contentPaths()
	const manifest = JSON.parse(
		fs.readFileSync(paths.b250R1Manifest, 'utf8'),
	) as PilotManifest

	const scored = manifest.puzzles.map((p) => {
		const bitmap = parseAscii(p.ascii.split('\n'))
		const rq = analyzeRewardQuality(bitmap, p.kind as ContentKind)
		return {
			id: p.id,
			titleRu: p.titleRu,
			kind: p.kind,
			tier: p.tier,
			sizeKey: `${p.width}x${p.height}`,
			hardReject: rq.hardReject,
			hardRejectReason: rq.hardRejectReason,
			riskScore: rq.riskScore,
			flags: rq.flags,
			metrics: {
				rowDiv: rq.metrics.rowDiversity,
				colDiv: rq.metrics.columnDiversity,
				trans: rq.metrics.transitionDensity,
				fillBbox: rq.metrics.fillInBbox,
			},
		}
	})

	scored.sort(compareRiskDesc)
	scored.forEach((row, i) => {
		;(row as { rank?: number }).rank = i + 1
	})

	const hardRejects = scored.filter((s) => s.hardReject)
	const warnings = scored.filter((s) => !s.hardReject && s.flags.length > 0)
	const clean = scored.filter((s) => !s.hardReject && s.flags.length === 0)
	const risks = scored.map((s) => s.riskScore).sort((a, b) => a - b)
	const pct = (p: number) =>
		risks[Math.min(risks.length - 1, Math.floor((p / 100) * risks.length))] ?? 0

	const reasonCounts: Record<string, number> = {}
	for (const s of scored) {
		for (const f of s.flags) {
			reasonCounts[f] = (reasonCounts[f] ?? 0) + 1
		}
	}

	const byKind: Record<
		string,
		{ n: number; hard: number; warn: number; risks: number[] }
	> = {}
	for (const s of scored) {
		const bag = byKind[s.kind] ?? { n: 0, hard: 0, warn: 0, risks: [] }
		bag.n += 1
		if (s.hardReject) {
			bag.hard += 1
		} else if (s.flags.length > 0) {
			bag.warn += 1
		}
		bag.risks.push(s.riskScore)
		byKind[s.kind] = bag
	}

	const report = {
		catalogVersion: manifest.catalogVersion,
		checksum: manifest.checksum,
		total: scored.length,
		hardReject: hardRejects.length,
		hardRejectShare: hardRejects.length / scored.length,
		warning: warnings.length,
		clean: clean.length,
		overreachStop: hardRejects.length / scored.length > 0.3,
		riskDistribution: {
			min: risks[0] ?? 0,
			median: pct(50),
			p75: pct(75),
			p90: pct(90),
			p95: pct(95),
			max: risks[risks.length - 1] ?? 0,
		},
		reasonCounts,
		byKind: Object.fromEntries(
			Object.entries(byKind).map(([k, v]) => [
				k,
				{
					selected: v.n,
					hardRejects: v.hard,
					warnings: v.warn,
					medianRisk: [...v.risks].sort((a, b) => a - b)[
						Math.floor(v.risks.length / 2)
					],
				},
			]),
		),
		humanWeak: HUMAN_WEAK.map((id) => {
			const row = scored.find((s) => s.id === id)
			return row ?? { id, missing: true }
		}),
		humanGood: HUMAN_GOOD.map((id) => {
			const row = scored.find((s) => s.id === id)
			return row ?? { id, missing: true }
		}),
		worst20: scored.slice(0, 20),
		hardRejectIds: hardRejects.map((s) => s.id),
		ranked: scored,
	}

	const outDir = path.join(paths.root, 'generated', 'content-b250')
	fs.writeFileSync(
		path.join(outDir, 'rescore-8b1.json'),
		`${JSON.stringify(report, null, 2)}\n`,
	)
	console.log(
		JSON.stringify(
			{
				hardReject: report.hardReject,
				hardRejectShare: report.hardRejectShare,
				overreachStop: report.overreachStop,
				warning: report.warning,
				clean: report.clean,
				riskDistribution: report.riskDistribution,
				humanWeak: report.humanWeak.map((r) => ({
					id: (r as { id: string }).id,
					rank: (r as { rank?: number }).rank,
					hard: (r as { hardReject?: boolean }).hardReject,
					risk: (r as { riskScore?: number }).riskScore,
					flags: (r as { flags?: string[] }).flags,
				})),
				humanGood: report.humanGood.map((r) => ({
					id: (r as { id: string }).id,
					rank: (r as { rank?: number }).rank,
					hard: (r as { hardReject?: boolean }).hardReject,
					risk: (r as { riskScore?: number }).riskScore,
					flags: (r as { flags?: string[] }).flags,
				})),
			},
			null,
			2,
		),
	)
}

main()
