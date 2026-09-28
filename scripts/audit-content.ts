/**
 * Production catalog audit harness.
 *
 * Run: npm run audit:content
 * Exits non-zero if any production puzzle fails the gate or IDs duplicate.
 */

import { MINI_PRODUCTION_CATALOG } from '../src/content/miniCatalog'
import { validateCatalog } from '../src/content/validateCatalog'

function main(): void {
	const result = validateCatalog(MINI_PRODUCTION_CATALOG)
	const { summary, rows } = result

	console.log('Nonogram content audit')
	console.log('ID | Size | Tier | Score | Unique | Logical | Production | Complete(ms) | Logical(ms)')
	for (const row of rows) {
		console.log(
			[
				row.id,
				row.size,
				row.tier,
				row.score === null ? 'n/a' : row.score.toFixed(2),
				String(row.unique),
				String(row.logicallySolvable),
				String(row.productionReady),
				row.completeMs.toFixed(2),
				row.logicalMs.toFixed(2),
			].join(' | '),
		)
	}

	console.log('')
	console.log('Summary')
	console.log(`total=${summary.total}`)
	console.log(`PASS=${summary.pass}`)
	console.log(`FAIL=${summary.fail}`)
	console.log(`duplicateIds=${summary.duplicateIds}`)
	console.log(`bySize=${JSON.stringify(summary.bySize)}`)
	console.log(`byDifficulty=${JSON.stringify(summary.byDifficulty)}`)
	console.log(
		`worstId=${summary.worstId} maxCompleteMs=${summary.maxCompleteMs.toFixed(2)} (${summary.slowestCompleteId}) maxLogicalMs=${summary.maxLogicalMs.toFixed(2)} (${summary.slowestLogicalId})`,
	)

	if (!result.ok) {
		console.error('')
		console.error('Issues:')
		for (const issue of result.issues) {
			console.error(`- [${issue.code}] ${issue.message}`)
		}
		process.exitCode = 1
	}
}

main()
