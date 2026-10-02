/**
 * App-level progress hydration context.
 * Screens read save snapshots; mutations go through GameProgressService.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import { createAsyncStorageAdapter } from '../storage/asyncStorageAdapter'
import {
	createGameProgressService,
	createRealClock,
	createSaveRepository,
	type GameProgressService,
	type HydrationStatus,
	type PersistenceHealth,
	type SaveRoot,
} from '../persistence'
import { createDefaultSave } from '../persistence/createDefaultSave'

interface ProgressContextValue {
	readonly status: HydrationStatus
	readonly save: SaveRoot
	readonly service: GameProgressService
	readonly refresh: () => void
	readonly reason?: string
	/** Durable-write readiness (N1). */
	readonly persistenceHealth: PersistenceHealth
	/** Re-run hydrate (IO retry). Does not invent a default over unread data. */
	readonly retryHydrate: () => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

function createDefaultService(): GameProgressService {
	return createGameProgressService(
		createSaveRepository(createAsyncStorageAdapter()),
		createRealClock(),
	)
}

interface ProgressProviderProps {
	readonly children: ReactNode
	/** Optional inject for tests. */
	readonly service?: GameProgressService
}

export function ProgressProvider({
	children,
	service: injected,
}: ProgressProviderProps) {
	const service = useMemo(
		() => injected ?? createDefaultService(),
		[injected],
	)
	const [status, setStatus] = useState<HydrationStatus>('LOADING')
	const [save, setSave] = useState<SaveRoot>(createDefaultSave)
	const [reason, setReason] = useState<string | undefined>()
	const [persistenceHealth, setPersistenceHealth] =
		useState<PersistenceHealth>('READY')
	const [hydrateNonce, setHydrateNonce] = useState(0)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const result = await service.hydrate()
			if (cancelled) {
				return
			}
			setStatus(result.status)
			setSave(result.save)
			setReason(result.reason)
			setPersistenceHealth(service.getPersistenceHealth())
		})().catch(() => {
			if (cancelled) {
				return
			}
			setStatus('ERROR_IO_READ')
			setSave(createDefaultSave())
			setReason('Hydration failed')
			setPersistenceHealth('READ_ERROR')
		})
		return () => {
			cancelled = true
		}
	}, [service, hydrateNonce])

	const refresh = useCallback(() => {
		setSave(service.getSave())
		setPersistenceHealth(service.getPersistenceHealth())
	}, [service])

	const retryHydrate = useCallback(() => {
		setStatus('LOADING')
		setHydrateNonce((n) => n + 1)
	}, [])

	const value = useMemo(
		() => ({
			status,
			save,
			service,
			refresh,
			reason,
			persistenceHealth,
			retryHydrate,
		}),
		[
			status,
			save,
			service,
			refresh,
			reason,
			persistenceHealth,
			retryHydrate,
		],
	)

	return (
		<ProgressContext.Provider value={value}>
			{children}
		</ProgressContext.Provider>
	)
}

export function useProgress(): ProgressContextValue {
	const ctx = useContext(ProgressContext)
	if (ctx === null) {
		throw new Error('useProgress must be used within ProgressProvider')
	}
	return ctx
}
