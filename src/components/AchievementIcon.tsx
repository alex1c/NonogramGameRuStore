/**
 * Simple achievement icons — View geometry, no emoji, no new dependency.
 */

import { StyleSheet, View } from 'react-native'
import type { AchievementIconKey } from '../achievements/definitions'
import { colors } from '../theme'

interface AchievementIconProps {
	readonly iconKey: AchievementIconKey
	readonly unlocked: boolean
	readonly size?: number
}

export function AchievementIcon({
	iconKey,
	unlocked,
	size = 28,
}: AchievementIconProps) {
	const tone = unlocked ? colors.accent : colors.textMuted
	const dim = unlocked ? 1 : 0.45
	return (
		<View
			style={[
				styles.box,
				{
					width: size,
					height: size,
					borderColor: tone,
					opacity: dim,
				},
			]}
			accessibilityElementsHidden
		>
			<IconGlyph iconKey={iconKey} color={tone} size={size} />
		</View>
	)
}

function IconGlyph({
	iconKey,
	color,
	size,
}: {
	iconKey: AchievementIconKey
	color: string
	size: number
}) {
	const s = size * 0.35
	switch (iconKey) {
		case 'first':
			return <View style={[styles.dot, { backgroundColor: color, width: s, height: s }]} />
		case 'star':
		case 'five':
		case 'ten':
		case 'collector':
			return (
				<View
					style={[
						styles.diamond,
						{
							borderBottomColor: color,
							borderBottomWidth: s,
							borderLeftWidth: s * 0.6,
							borderRightWidth: s * 0.6,
						},
					]}
				/>
			)
		case 'hard':
		case 'expert':
			return (
				<View
					style={[
						styles.bar,
						{ backgroundColor: color, width: s * 1.4, height: s * 0.35 },
					]}
				/>
			)
		case 'grid':
			return (
				<View style={styles.grid}>
					<View style={[styles.gridCell, { borderColor: color }]} />
					<View style={[styles.gridCell, { borderColor: color }]} />
					<View style={[styles.gridCell, { borderColor: color }]} />
					<View style={[styles.gridCell, { borderColor: color }]} />
				</View>
			)
		case 'collection':
			return (
				<View
					style={[
						styles.stack,
						{ borderColor: color, width: s * 1.2, height: s * 1.2 },
					]}
				/>
			)
		case 'beginner':
		case 'easy':
		case 'medium':
		case 'replay':
		case 'fallback':
		default:
			return (
				<View
					style={[
						styles.ring,
						{
							borderColor: color,
							width: s * 1.2,
							height: s * 1.2,
							borderRadius: s,
						},
					]}
				/>
			)
	}
}

const styles = StyleSheet.create({
	box: {
		borderWidth: 1.5,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#FFFFFF',
	},
	dot: {
		borderRadius: 99,
	},
	diamond: {
		width: 0,
		height: 0,
		borderLeftColor: 'transparent',
		borderRightColor: 'transparent',
	},
	bar: {
		borderRadius: 2,
	},
	grid: {
		width: 14,
		height: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	gridCell: {
		width: 5,
		height: 5,
		margin: 1,
		borderWidth: 1,
	},
	stack: {
		borderWidth: 2,
		borderRadius: 3,
	},
	ring: {
		borderWidth: 2,
	},
})
