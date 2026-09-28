/**
 * Russian plural helper for small UI counts.
 */

const FORMS = {
	achievement: ['достижение', 'достижения', 'достижений'],
	picture: ['картинка', 'картинки', 'картинок'],
} as const

export type PluralKind = keyof typeof FORMS

/**
 * Russian pluralization: 1 / 2-4 / 5-0 (including teens 11-14 → form 3).
 */
export function russianPlural(count: number, kind: PluralKind): string {
	const forms = FORMS[kind]
	const n = Math.abs(Math.floor(count)) % 100
	const n1 = n % 10
	if (n > 10 && n < 20) {
		return forms[2]
	}
	if (n1 === 1) {
		return forms[0]
	}
	if (n1 >= 2 && n1 <= 4) {
		return forms[1]
	}
	return forms[2]
}

export function formatAchievementCount(count: number): string {
	return `${count} ${russianPlural(count, 'achievement')}`
}
