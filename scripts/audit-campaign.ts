/**
 * Campaign audit CLI — npm run audit:campaign
 */

import { auditCampaign } from '../src/campaign/audit'

const summary = auditCampaign()

console.log(
	[
		`total=${summary.total}`,
		`PASS=${summary.pass}`,
		`FAIL=${summary.fail}`,
		`duplicateIds=${summary.duplicateIds}`,
		`duplicateOrders=${summary.duplicateOrders}`,
		`missing=${summary.missing}`,
		`notProductionReady=${summary.notProductionReady}`,
	].join('\n'),
)

if (summary.issues.length > 0) {
	for (const issue of summary.issues) {
		console.error(`- ${issue.code}: ${issue.message}`)
	}
}

if (summary.fail > 0 || summary.pass !== summary.total) {
	process.exitCode = 1
}
