"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { useDeveloperAuthStore } from "@/store/developerAuthStore"

export interface ServerStatsSnapshot {
  timestamp: number
  cpu: { loadPercent: number }
  memory: { totalBytes: number; usedBytes: number; usedPercent: number }
  disk: { mount: string; totalBytes: number; usedBytes: number; usedPercent: number } | null
  network: { rxBytesPerSec: number; txBytesPerSec: number }
  uptime: { processSeconds: number; systemSeconds: number }
}

export interface RequestLogEntry {
  id: string
  timestamp: number
  method: string
  path: string
  status: number
  ip: string
  durationMs: number
}

// ~5 minutes of history at the backend's 5s push interval.
const MAX_HISTORY = 60
const MAX_LOGS = 200

export function useDeveloperStatsSocket() {
  const { token } = useDeveloperAuthStore()
  const [history, setHistory] = useState<ServerStatsSnapshot[]>([])
  const [logs, setLogs] = useState<RequestLogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) return

    // Connecting to the /developer-stats namespace path (not the default
    // namespace + a room-join emit) is what actually engages the backend's
    // nsp.use() auth gate.
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}/developer-stats`, {
      auth: { token },
      transports: ["websocket"],
    })
    socketRef.current = socket

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("connect_error", () => setConnected(false))
    socket.on("stats", (snapshot: ServerStatsSnapshot) => {
      setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), snapshot])
    })
    socket.on("log", (entry: RequestLogEntry) => {
      setLogs((prev) => [entry, ...prev].slice(0, MAX_LOGS))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  return { history, latest: history[history.length - 1] ?? null, logs, setLogs, connected }
}
