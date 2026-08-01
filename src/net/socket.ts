import { io, type Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@shared/game/types.ts'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

function resolveServerUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }
  // Same origin → Vite proxy /socket.io → backend
  return window.location.origin
}

let socket: AppSocket | null = null

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(resolveServerUrl(), {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
