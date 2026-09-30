/**
 * Re-export authored scale helpers from the barrel index.
 */

export {
	B1000_SCALE_AUTHORED,
	scaleAuthoredToRawCandidates,
} from './b1000ScaleIndex'
import { B1000_SCALE_AUTHORED } from './b1000ScaleIndex'

export function authoredScaleCount(): number {
	return B1000_SCALE_AUTHORED.length
}
