/**
 * Gallery audit CLI — npm run audit:gallery
 */

import { auditGallery } from '../src/gallery/audit'
import { GALLERY_EXCLUDED } from '../src/gallery/definitions'

const summary = auditGallery()

console.log(
	[
		`collections=${summary.collections}`,
		`items=${summary.items}`,
		`included=${summary.included}`,
		`excluded=${summary.excluded}`,
		`duplicateIds=${summary.duplicateIds}`,
		`duplicateOrders=${summary.duplicateOrders}`,
		`missingPuzzles=${summary.missingPuzzles}`,
		`notProductionReady=${summary.notProductionReady}`,
		`untitledUnlockedItems=${summary.untitledUnlockedItems}`,
	].join('\n'),
)

if (GALLERY_EXCLUDED.length > 0) {
	console.log('excludedDetails:')
	for (const item of GALLERY_EXCLUDED) {
		console.log(`- ${item.puzzleId}: ${item.reason}`)
	}
}

if (summary.orphanCampaign.length > 0) {
	console.log(`orphanCampaign=${summary.orphanCampaign.join(',')}`)
}

if (summary.issues.length > 0) {
	for (const issue of summary.issues) {
		console.error(`- ${issue}`)
	}
}

if (!summary.ok) {
	process.exitCode = 1
}
