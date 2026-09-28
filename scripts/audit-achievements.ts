/**
 * Achievements audit CLI — npm run audit:achievements
 */

import { auditAchievements } from '../src/achievements/audit'

const summary = auditAchievements()

console.log(
	[
		`total=${summary.total}`,
		`reachable=${summary.reachable}`,
		`unreachable=${summary.unreachable}`,
		`duplicateIds=${summary.duplicateIds}`,
		`duplicateOrders=${summary.duplicateOrders}`,
		`invalidTargets=${summary.invalidTargets}`,
	].join('\n'),
)

if (summary.issues.length > 0) {
	for (const issue of summary.issues) {
		console.error(`- ${issue}`)
	}
}

if (!summary.ok) {
	process.exitCode = 1
}
