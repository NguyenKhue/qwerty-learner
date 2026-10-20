import { getConnectionState, onConnectionState } from './events'
import type { ConnectionState } from './events'
import { useSyncExternalStore } from 'react'

/** Whether the data server is answering: `down` as soon as a request or the live stream fails. */
export function useConnectionState(): ConnectionState {
  return useSyncExternalStore((notify) => onConnectionState(() => notify()), getConnectionState)
}
