/**
 * Board color palettes — light and dark foundations.
 * Values are not the only signal: FILLED vs CROSSED also differ by shape (X).
 */

export interface BoardPalette {
	readonly name: 'light' | 'dark'
	readonly screenBackground: string
	readonly boardBackground: string
	readonly clueBackground: string
	readonly clueText: string
	readonly clueTextDimmed: string
	readonly gridLine: string
	readonly gridLineStrong: string
	readonly cellEmpty: string
	readonly cellFilled: string
	readonly cross: string
	readonly highlight: string
	readonly headerText: string
	readonly controlBackground: string
	readonly controlSelected: string
	readonly controlText: string
	readonly controlBorder: string
}

export const LIGHT_BOARD_PALETTE: BoardPalette = Object.freeze({
	name: 'light',
	screenBackground: '#F3F6F2',
	boardBackground: '#F7FAF6',
	clueBackground: '#E8EEE6',
	clueText: '#1F2A24',
	clueTextDimmed: '#8A968E',
	gridLine: '#B7C4BA',
	gridLineStrong: '#4E5F54',
	cellEmpty: '#FFFFFF',
	cellFilled: '#2A3A32',
	cross: '#5A6B62',
	highlight: 'rgba(47, 107, 79, 0.18)',
	headerText: '#1F2A24',
	controlBackground: '#FFFFFF',
	controlSelected: '#2F6B4F',
	controlText: '#1F2A24',
	controlBorder: '#C5D2C8',
})

export const DARK_BOARD_PALETTE: BoardPalette = Object.freeze({
	name: 'dark',
	screenBackground: '#121816',
	boardBackground: '#1A221E',
	clueBackground: '#222C27',
	clueText: '#E6EEE8',
	clueTextDimmed: '#7E8C84',
	gridLine: '#3A4840',
	gridLineStrong: '#A8B8AE',
	cellEmpty: '#1E2823',
	cellFilled: '#D7E4DB',
	cross: '#A9B8B0',
	highlight: 'rgba(120, 180, 150, 0.22)',
	headerText: '#E6EEE8',
	controlBackground: '#1E2823',
	controlSelected: '#3D8F6A',
	controlText: '#E6EEE8',
	controlBorder: '#3A4840',
})
