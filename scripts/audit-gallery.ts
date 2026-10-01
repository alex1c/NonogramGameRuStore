/**
 * Gallery audit CLI — npm run audit:gallery
 */

import { auditGallery, formatGalleryAudit } from '../src/gallery/audit'
import { GALLERY_EXCLUDED } from '../src/gallery/definitions'

const summary = auditGallery()

console.log(formatGalleryAudit(summary))

if (GALLERY_EXCLUDED.length > 0) {
	console.log('excludedDetails:')
	for (const item of GALLERY_EXCLUDED) {
		console.log(`- ${item.puzzleId}: ${item.reason}`)
	}
}

const ok =
	summary.collections === 20 &&
	summary.items === 1000 &&
	summary.duplicateIds === 0 &&
	summary.duplicateOrders === 0 &&
	summary.missingPuzzles === 0 &&
	summary.campaignCoverageMissing === 0 &&
	summary.untitledUnlockedItems === 0

if (!ok) {
	process.exitCode = 1
}
