/**
 * Placeholder navigation root for Phase 0.
 * Production navigation arrives in a later phase.
 *
 * Kept under src/navigation (not src/app) so Expo does not treat the tree as
 * an Expo Router app directory.
 */

import { HomeScreen } from '../screens/HomeScreen'

export function RootNavigation() {
	return <HomeScreen />
}
