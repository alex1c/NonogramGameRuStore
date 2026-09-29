/**
 * Extra ultra-simple production beginners (5×5 / 6×6 solid icons).
 * Tuned for score < 28 while still passing reward-quality (not line-like).
 */

import { normalizeConceptId, type CollectionId } from '../constants'
import type { ContentKind, SourceKind } from '../types'

export interface ExpansionTemplate {
	readonly id: string
	readonly titleRu: string
	readonly collectionId: CollectionId
	readonly conceptId: string
	readonly compositionId: string
	readonly family: string
	readonly kind: ContentKind
	readonly sourceKind: SourceKind
	readonly ascii: readonly string[]
}

function c(
	id: string,
	titleRu: string,
	collectionId: CollectionId,
	conceptId: string,
	compositionId: string,
	ascii: readonly string[],
	kind: ContentKind = 'symbol',
	family?: string,
): ExpansionTemplate {
	return {
		id,
		titleRu,
		collectionId,
		conceptId: normalizeConceptId(conceptId),
		compositionId,
		family: family ?? `authored-${normalizeConceptId(conceptId)}`,
		kind,
		sourceKind: 'authored',
		ascii,
	}
}

/** Solid / chunky 5×5 icons that force quickly. */
export const B250_TRUE_BEGINNER_FILL: readonly ExpansionTemplate[] = Object.freeze([
	c('tbeg-square', 'Квадратик', 'symbols', 'mini-square', 'solid5', [
		'#####',
		'#####',
		'#####',
		'#####',
		'#####',
	]),
	c('tbeg-circle', 'Круг', 'symbols', 'mini-circle', 'blob5', [
		'.###.',
		'#####',
		'#####',
		'#####',
		'.###.',
	]),
	c('tbeg-plus', 'Крест', 'symbols', 'chunky-plus', '5', [
		'..#..',
		'..#..',
		'#####',
		'..#..',
		'..#..',
	]),
	c('tbeg-heart', 'Сердечко', 'symbols', 'mini-heart', '5', [
		'#.#.#',
		'#####',
		'#####',
		'.###.',
		'..#..',
	]),
	c('tbeg-star', 'Звёздочка', 'symbols', 'mini-star', '5', [
		'..#..',
		'#####',
		'.###.',
		'#.#.#',
		'#...#',
	]),
	c('tbeg-arrow', 'Стрелка', 'symbols', 'mini-arrow-up', '5', [
		'..#..',
		'.###.',
		'#####',
		'..#..',
		'..#..',
	]),
	c('tbeg-note', 'Нотка', 'music', 'mini-note', '5', [
		'..##.',
		'..#.#',
		'..#..',
		'###..',
		'###..',
	]),
	c('tbeg-house', 'Домик', 'home', 'mini-cottage', '5', [
		'..#..',
		'.###.',
		'#####',
		'#.###',
		'#.###',
	], 'object'),
	c('tbeg-tree', 'Ёлочка', 'plants', 'mini-fir', '5', [
		'..#..',
		'.###.',
		'#####',
		'..#..',
		'..#..',
	], 'object'),
	c('tbeg-fish', 'Рыбка', 'sea', 'mini-fish', '5', [
		'.....',
		'.###.',
		'#####',
		'.###.',
		'#...#',
	], 'object'),
	c('tbeg-cup', 'Чашечка', 'drinks', 'mini-cup', '5', [
		'.....',
		'#####',
		'#.###',
		'.###.',
		'.###.',
	], 'object'),
	c('tbeg-boot', 'Ботинок', 'clothing', 'mini-boot', '5', [
		'.....',
		'.##..',
		'.##..',
		'#####',
		'#####',
	], 'object'),
	c('tbeg-sun', 'Солнышко', 'weather', 'mini-sun', '5', [
		'#.#.#',
		'.###.',
		'#####',
		'.###.',
		'#.#.#',
	]),
	c('tbeg-moon', 'Луна', 'space', 'mini-moon', '5', [
		'.###.',
		'####.',
		'###..',
		'####.',
		'.###.',
	]),
	c('tbeg-cloud', 'Облачко', 'weather', 'mini-cloud', '5', [
		'.....',
		'.##..',
		'#####',
		'#####',
		'.....',
	]),
	c('tbeg-apple', 'Яблочко', 'food', 'mini-apple', '5', [
		'..#..',
		'.###.',
		'#####',
		'#####',
		'.###.',
	], 'object'),
	c('tbeg-mushroom', 'Грибочек', 'plants', 'mini-mushroom', '5', [
		'.###.',
		'#####',
		'#####',
		'..#..',
		'..#..',
	], 'object'),
	c('tbeg-car', 'Машинка', 'transport', 'mini-car', '5', [
		'.....',
		'.###.',
		'#####',
		'#.#.#',
		'.....',
	], 'object'),
	c('tbeg-boat', 'Лодочка', 'transport', 'mini-boat', '5', [
		'.....',
		'..#..',
		'..#..',
		'#####',
		'.###.',
	], 'object'),
	c('tbeg-flower', 'Цветочек', 'plants', 'mini-bloom', '5', [
		'.#.#.',
		'.###.',
		'#####',
		'.###.',
		'..#..',
	], 'object'),
	c('tbeg-paw', 'Лапка', 'animals', 'mini-paw', '5', [
		'#.#.#',
		'.###.',
		'#####',
		'.###.',
		'.....',
	], 'object'),
	c('tbeg-bird', 'Птичка', 'birds', 'mini-bird', '5', [
		'.....',
		'..##.',
		'.####',
		'#####',
		'..#..',
	], 'object'),
	c('tbeg-leaf', 'Листик', 'plants', 'mini-leaf', '5', [
		'..#..',
		'.###.',
		'#####',
		'.###.',
		'..#..',
	], 'object'),
	c('tbeg-key', 'Ключик', 'objects', 'mini-key', '5', [
		'###..',
		'#.#..',
		'###..',
		'..#..',
		'..###',
	], 'object'),
	c('tbeg-lock', 'Замочек', 'objects', 'mini-lock', '5', [
		'.###.',
		'#...#',
		'#####',
		'##.##',
		'#####',
	], 'object'),
	c('tbeg-gift', 'Подарок', 'objects', 'mini-gift', '5', [
		'..#..',
		'#####',
		'##.##',
		'#####',
		'#####',
	], 'object'),
	c('tbeg-ball', 'Мячик', 'sport', 'mini-ball', '5', [
		'.###.',
		'#####',
		'##.##',
		'#####',
		'.###.',
	], 'object'),
	c('tbeg-book', 'Книжка', 'objects', 'mini-book', '5', [
		'#####',
		'#.###',
		'#.###',
		'#.###',
		'#####',
	], 'object'),
	c('tbeg-phone', 'Телефон', 'objects', 'mini-phone', '5', [
		'#####',
		'#...#',
		'#.###',
		'#...#',
		'#####',
	], 'object'),
	c('tbeg-lamp', 'Лампа', 'home', 'mini-lamp', '5', [
		'..#..',
		'.###.',
		'#####',
		'..#..',
		'.###.',
	], 'object'),
	c('tbeg-chair', 'Стул', 'home', 'mini-chair', '5', [
		'##...',
		'##...',
		'#####',
		'#...#',
		'#...#',
	], 'object'),
	c('tbeg-table', 'Стол', 'home', 'mini-table', '5', [
		'#####',
		'#####',
		'#...#',
		'#...#',
		'#...#',
	], 'object'),
	c('tbeg-umbrella', 'Зонтик', 'weather', 'mini-umbrella', '5', [
		'.###.',
		'#####',
		'..#..',
		'..#..',
		'..##.',
	], 'object'),
	c('tbeg-ice', 'Мороженое', 'food', 'mini-icecream', '5', [
		'.###.',
		'#####',
		'.###.',
		'..#..',
		'..#..',
	], 'object'),
	c('tbeg-cake', 'Тортик', 'food', 'mini-cake', '5', [
		'..#..',
		'.###.',
		'#####',
		'#.#.#',
		'#####',
	], 'object'),
	c('tbeg-ring', 'Кольцо', 'symbols', 'mini-ring', '5', [
		'.###.',
		'#...#',
		'#...#',
		'#...#',
		'.###.',
	]),
	c('tbeg-flag', 'Флажок', 'symbols', 'mini-flag', '5', [
		'#....',
		'####.',
		'####.',
		'#....',
		'#....',
	]),
	c('tbeg-crown', 'Корона', 'symbols', 'mini-crown', '5', [
		'#.#.#',
		'#####',
		'#####',
		'.###.',
		'.....',
	]),
	c('tbeg-shield', 'Щит', 'symbols', 'mini-shield', '5', [
		'#####',
		'#...#',
		'#...#',
		'.#.#.',
		'..#..',
	]),
	c('tbeg-diamond', 'Ромбик', 'symbols', 'mini-diamond', '5', [
		'..#..',
		'.###.',
		'#####',
		'.###.',
		'..#..',
	]),
	c('tbeg-smiley', 'Смайлик', 'symbols', 'mini-smiley', '5', [
		'.###.',
		'#.#.#',
		'#...#',
		'#.###',
		'.###.',
	]),
	c('tbeg-butterfly', 'Бабочка', 'animals', 'mini-butterfly', '5', [
		'#...#',
		'##.##',
		'.###.',
		'##.##',
		'#...#',
	], 'object'),
	c('tbeg-snail', 'Улитка', 'animals', 'mini-snail', '5', [
		'.....',
		'.###.',
		'##.##',
		'#####',
		'.....',
	], 'object'),
	c('tbeg-cat', 'Котик', 'animals', 'mini-cat-face', '5', [
		'#...#',
		'#####',
		'#.#.#',
		'#####',
		'.###.',
	], 'object'),
	c('tbeg-dog', 'Пёсик', 'animals', 'mini-dog-face', '5', [
		'#...#',
		'#####',
		'#.#.#',
		'#####',
		'##.##',
	], 'object'),
])
