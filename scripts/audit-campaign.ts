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
		`sets=${summary.setCount}`,
		`unlockAfter=${summary.unlockAfter}`,
	].join('\n'),
)

if (
	summary.fail > 0 ||
	summary.pass !== summary.total ||
	summary.setCount !== 20 ||
	summary.total !== 1000
) {
	process.exitCode = 1
}
