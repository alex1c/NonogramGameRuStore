/**
 * AppMetrica wrapper — activate once; failures never block gameplay.
 * API key is client configuration; do not print it in production logs.
 */

import AppMetrica from '@appmetrica/react-native-analytics'
import {
	buildAnalyticsEvent,
	type AnalyticsEventName,
} from './events'

/** Production AppMetrica API key (Phase 9). */
const APPMETRICA_API_KEY = '1ba2848b-3a54-4b05-93ae-f869731c1aa3'

let initialized = false

/** Masked form for reports (never log the full key). */
export function getMaskedAppMetricaKey(): string {
	return `${APPMETRICA_API_KEY.slice(0, 8)}…${APPMETRICA_API_KEY.slice(-4)}`
}

export function initializeAnalytics(): void {
	if (initialized) {
		return
	}
	initialized = true
	try {
		AppMetrica.activate({
			apiKey: APPMETRICA_API_KEY,
			appOpenTrackingEnabled: false,
			advIdentifiersTracking: false,
			logs: __DEV__,
		})
	} catch {
		// Analytics must never block rendering or gameplay.
	}
}

export function trackEvent(
	name: AnalyticsEventName,
	parameters: Record<string, unknown> = {},
): void {
	try {
		const event = buildAnalyticsEvent(name, parameters)
		AppMetrica.reportEvent(event.name, event.parameters)
	} catch {
		// Native analytics availability is optional at runtime.
	}
}

/** Test helper — reset one-shot init guard. */
export function __resetAnalyticsForTests(): void {
	initialized = false
}

export function __isAnalyticsInitializedForTests(): boolean {
	return initialized
}

export { buildAnalyticsEvent, ANALYTICS_EVENT_NAMES } from './events'
export type {
	AnalyticsEvent,
	AnalyticsEventName,
	AnalyticsParameter,
} from './events'
