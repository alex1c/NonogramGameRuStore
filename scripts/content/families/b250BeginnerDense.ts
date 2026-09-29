/**
 * Additional dense beginner silhouettes (score target < 28).
 * Pattern: heavy fill / few ambiguous lines — inspired by book/phone/gift/cloud.
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
	kind: ContentKind = 'object',
): ExpansionTemplate {
	return {
		id,
		titleRu,
		collectionId,
		conceptId: normalizeConceptId(conceptId),
		compositionId,
		family: `authored-${normalizeConceptId(conceptId)}`,
		kind,
		sourceKind: 'authored',
		ascii,
	}
}

export const B250_BEGINNER_DENSE: readonly ExpansionTemplate[] = Object.freeze([
	c('dens-brick', 'Кирпич', 'objects', 'brick-block', 'solid', [
		'#####',
		'#####',
		'#####',
		'.....',
		'.....',
	]),
	c('dens-slab', 'Плита', 'objects', 'stone-slab', 'solid', [
		'.....',
		'#####',
		'#####',
		'#####',
		'.....',
	]),
	c('dens-wall', 'Стена', 'city', 'brick-wall', 'row', [
		'#####',
		'#.#.#',
		'#####',
		'#.#.#',
		'#####',
	]),
	c('dens-box', 'Коробка', 'objects', 'closed-box', 'front', [
		'#####',
		'#...#',
		'#...#',
		'#...#',
		'#####',
	]),
	c('dens-frame', 'Рамка', 'symbols', 'picture-frame', '5', [
		'#####',
		'#...#',
		'#.#.#',
		'#...#',
		'#####',
	], 'symbol'),
	c('dens-window2', 'Окошко', 'home', 'window-panes', '4', [
		'#####',
		'#.#.#',
		'#####',
		'#.#.#',
		'#####',
	]),
	c('dens-door', 'Дверь', 'home', 'closed-door', 'front', [
		'#####',
		'#...#',
		'#..##',
		'#...#',
		'#####',
	]),
	c('dens-bag', 'Сумка', 'clothing', 'hand-bag', 'front', [
		'.#.#.',
		'#####',
		'#...#',
		'#...#',
		'#####',
	]),
	c('dens-tv', 'Телевизор', 'home', 'old-tv', 'front', [
		'#####',
		'#...#',
		'#...#',
		'#####',
		'.#.#.',
	]),
	c('dens-radio', 'Радио', 'music', 'radio-box', 'front', [
		'#####',
		'#.#.#',
		'#####',
		'#####',
		'#...#',
	]),
	c('dens-fridge', 'Холодильник', 'home', 'fridge-front', 'front', [
		'#####',
		'#...#',
		'#####',
		'#...#',
		'#####',
	]),
	c('dens-washer', 'Стиралка', 'home', 'washer-front', 'front', [
		'#####',
		'#.###',
		'#.#.#',
		'#.###',
		'#####',
	]),
	c('dens-oven', 'Печь', 'home', 'oven-front', 'front', [
		'#####',
		'#.#.#',
		'#####',
		'#...#',
		'#####',
	]),
	c('dens-safe', 'Сейф', 'objects', 'metal-safe', 'front', [
		'#####',
		'#.#.#',
		'##.##',
		'#...#',
		'#####',
	]),
	c('dens-crate', 'Ящик', 'objects', 'wood-crate', 'front', [
		'#####',
		'#.#.#',
		'#####',
		'#.#.#',
		'#####',
	]),
	c('dens-battery', 'Батарейка', 'objects', 'aa-battery', 'side', [
		'.###.',
		'#####',
		'#...#',
		'#...#',
		'#####',
	]),
	c('dens-usb', 'Флешка', 'objects', 'usb-stick', 'side', [
		'..##.',
		'#####',
		'#...#',
		'#...#',
		'#####',
	]),
	c('dens-card', 'Карточка', 'objects', 'id-card', 'front', [
		'#####',
		'#...#',
		'#.###',
		'#...#',
		'#####',
	]),
	c('dens-stamp', 'Марка', 'objects', 'postage-stamp', 'front', [
		'#####',
		'#.#.#',
		'#...#',
		'#.#.#',
		'#####',
	]),
	c('dens-tile', 'Плитка', 'home', 'floor-tile', 'ornament', [
		'#####',
		'#.#.#',
		'##.##',
		'#.#.#',
		'#####',
	]),
	c('dens-cookie', 'Печенье', 'food', 'round-cookie', 'top', [
		'.###.',
		'#####',
		'##.##',
		'#####',
		'.###.',
	]),
	c('dens-toast', 'Тост', 'food', 'bread-toast', 'front', [
		'#####',
		'#...#',
		'#...#',
		'#...#',
		'#####',
	]),
	c('dens-cheese', 'Сыр', 'food', 'cheese-wedge', 'side', [
		'..###',
		'.##.#',
		'##..#',
		'#####',
		'#####',
	]),
	c('dens-soap', 'Мыло', 'home', 'soap-bar', 'top', [
		'.....',
		'#####',
		'#####',
		'#####',
		'.....',
	]),
	c('dens-sponge', 'Губка', 'home', 'kitchen-sponge', 'side', [
		'#####',
		'#.#.#',
		'#####',
		'#.#.#',
		'#####',
	]),
	c('dens-eraser', 'Ластик', 'objects', 'pencil-eraser', 'side', [
		'.....',
		'#####',
		'#####',
		'.###.',
		'.....',
	]),
	c('dens-notebook', 'Блокнот', 'objects', 'spiral-notebook', 'front', [
		'#####',
		'##.##',
		'#...#',
		'##.##',
		'#####',
	]),
	c('dens-wallet', 'Кошелёк', 'clothing', 'leather-wallet', 'closed', [
		'#####',
		'#...#',
		'#####',
		'#...#',
		'#####',
	]),
	c('dens-pillow', 'Подушка', 'home', 'soft-pillow', 'front', [
		'.###.',
		'#####',
		'#...#',
		'#####',
		'.###.',
	]),
	c('dens-mat', 'Коврик', 'home', 'door-mat', 'top', [
		'.....',
		'#####',
		'#.#.#',
		'#####',
		'.....',
	]),
])
