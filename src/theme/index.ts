/**
 * Theme foundation — minimal tokens for the shell and future UI.
 */

export const colors = {
	background: '#F3F6F2',
	surface: '#E7EEE4',
	text: '#1F2A24',
	textMuted: '#5C6B62',
	accent: '#2F6B4F',
	border: '#C5D2C8',
} as const

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
} as const

export const typography = {
	title: {
		fontSize: 28,
		fontWeight: '700' as const,
	},
	subtitle: {
		fontSize: 16,
		fontWeight: '500' as const,
	},
	badge: {
		fontSize: 14,
		fontWeight: '700' as const,
		letterSpacing: 1,
	},
	caption: {
		fontSize: 13,
		fontWeight: '400' as const,
	},
} as const
