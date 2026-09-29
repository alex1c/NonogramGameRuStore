/**
 * Transient Hint / Teach Me board highlight model.
 * Never persisted — preview only until Apply or dismiss.
 */

import type { HintAction, HintTargetCell } from '../hints/types'
import type { LineOrientation } from '../solver/logicalSolver'

export interface HintHighlight {
	readonly orientation: LineOrientation
	readonly lineIndex: number
	readonly action: HintAction
	readonly targets: readonly HintTargetCell[]
}
