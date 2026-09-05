"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Cpu, MemoryStick, Network, Clock, Server, Circle, Activity } from "lucide-react"
import { useDeveloperStatsSocket, type ServerStatsSnapshot, type RequestLogEntry } from "@/hooks/useDeveloperStatsSocket"
import { developerApi } from "@/lib/developerApi"

// Validated (scripts/validate_palette.js, light + dark) — see the dataviz skill.
const COLOR_CPU = "#3987e5" // categorical slot 1 (blue)
const COLOR_MEMORY = "#199e70" // categorical slot 3 (aqua)
const COLOR_RX = "#3987e5" // network slot 1
const COLOR_TX = "#d95926" // network slot 2 (orange)
const COLOR_GRID = "#2c2c2a"
const COLOR_AXIS = "#898781"
const STATUS_GOOD = "#0ca30c"
const STATUS_WARNING = "#fab219"
const STATUS_CRITICAL = "#d03b3b"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatRate(bytesPerSec: number) {
  return `${formatBytes(bytesPerSec)}/s`
}

function formatDuration(totalSeconds: number) {
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function statusColor(percent: number) {
  if (percent >= 90) return STATUS_CRITICAL
  if (percent >= 70) return STATUS_WARNING
  return STATUS_GOOD
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

function ChartCard({
  title,
  color,
  data,
  dataKey,
  unit,
}: {
  title: string
  color: string
  data: ServerStatsSnapshot[]
  dataKey: "cpu" | "memory"
  unit: string
}) {
  const chartData = data.map((s) => ({
    time: new Date(s.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    value: dataKey === "cpu" ? s.cpu.loadPercent : s.memory.usedPercent,
  }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: COLOR_AXIS, fontSize: 11 }} axisLine={{ stroke: COLOR_GRID }} tickLine={false} minTickGap={40} />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: COLOR_AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v) => `${v}${unit}`}
            />
            <Tooltip
              contentStyle={{ background: "#111110", border: "1px solid #2c2c2a", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#c3c2b7" }}
              formatter={(value: number) => [`${value}${unit}`, title]}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function NetworkChartCard({ data }: { data: ServerStatsSnapshot[] }) {
  const chartData = data.map((s) => ({
    time: new Date(s.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    rx: Math.round(s.network.rxBytesPerSec / 1024),
    tx: Math.round(s.network.txBytesPerSec / 1024),
  }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Network throughput</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-gray-400">
            <Circle className="h-2.5 w-2.5 fill-current" style={{ color: COLOR_RX }} />
            Received
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <Circle className="h-2.5 w-2.5 fill-current" style={{ color: COLOR_TX }} />
            Sent
          </span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: COLOR_AXIS, fontSize: 11 }} axisLine={{ stroke: COLOR_GRID }} tickLine={false} minTickGap={40} />
            <YAxis
              tick={{ fill: COLOR_AXIS, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v) => `${v} KB/s`}
            />
            <Tooltip
              contentStyle={{ background: "#111110", border: "1px solid #2c2c2a", borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: "#c3c2b7" }}
              formatter={(value: number, name: string) => [`${value} KB/s`, name === "rx" ? "Received" : "Sent"]}
            />
            <Line type="monotone" dataKey="rx" stroke={COLOR_RX} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="tx" stroke={COLOR_TX} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DiskMeter({ disk }: { disk: ServerStatsSnapshot["disk"] }) {
  if (!disk) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Disk usage</h3>
        <p className="text-sm text-gray-500">No disk data available</p>
      </div>
    )
  }

  const color = statusColor(disk.usedPercent)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Disk usage</h3>
        <span className="text-xs text-gray-500">{disk.mount}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-semibold text-gray-100">{disk.usedPercent}%</span>
        <span className="text-xs text-gray-500">
          {formatBytes(disk.usedBytes)} / {formatBytes(disk.totalBytes)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(disk.usedPercent, 100)}%`, background: color }}
        />
      </div>
    </div>
  )
}

function httpStatusColor(status: number) {
  if (status >= 500) return STATUS_CRITICAL
  if (status >= 400) return STATUS_WARNING
  return STATUS_GOOD
}

function RequestLogPanel({ logs }: { logs: RequestLogEntry[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-300">Live requests</h3>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">Waiting for requests…</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="py-1.5 pr-3 font-normal">Time</th>
                <th className="py-1.5 pr-3 font-normal">Method</th>
                <th className="py-1.5 pr-3 font-normal">Path</th>
                <th className="py-1.5 pr-3 font-normal">Status</th>
                <th className="py-1.5 pr-3 font-normal">IP</th>
                <th className="py-1.5 pr-3 font-normal">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-900 hover:bg-gray-800/40">
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300 font-mono">{log.method}</td>
                  <td className="py-1.5 pr-3 text-gray-400 font-mono truncate max-w-[280px]">{log.path}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className="inline-flex items-center gap-1 font-mono"
                      style={{ color: httpStatusColor(log.status) }}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400 font-mono whitespace-nowrap">{log.ip}</td>
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{log.durationMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function DeveloperDashboardPage() {
  const { history, latest, logs, setLogs, connected } = useDeveloperStatsSocket()
  const [initialSnapshot, setInitialSnapshot] = useState<ServerStatsSnapshot | null>(null)

  // Snapshot on mount so the dashboard isn't blank while waiting for the
  // first socket push (up to 5s).
  useEffect(() => {
    developerApi
      .get("/developer/stats")
      .then((res) => {
        if (res.status === "success") setInitialSnapshot(res.data)
      })
      .catch(() => {})

    developerApi
      .get("/developer/logs")
      .then((res) => {
        if (res.status !== "success") return
        setLogs((prev) => {
          const seen = new Set(prev.map((l: RequestLogEntry) => l.id))
          const merged = [...prev, ...res.data.filter((l: RequestLogEntry) => !seen.has(l.id))]
          return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 200)
        })
      })
      .catch(() => {})
  }, [setLogs])

  const display = latest ?? initialSnapshot

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Server className="h-4 w-4" />
          Server health
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Circle
            className="h-2 w-2 fill-current"
            style={{ color: connected ? STATUS_GOOD : STATUS_CRITICAL }}
          />
          <span className={connected ? "text-gray-400" : "text-red-400"}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          icon={Cpu}
          label="CPU load"
          value={display ? `${display.cpu.loadPercent}%` : "—"}
        />
        <StatTile
          icon={MemoryStick}
          label="Memory used"
          value={display ? `${display.memory.usedPercent}%` : "—"}
          sub={display ? formatBytes(display.memory.usedBytes) : undefined}
        />
        <StatTile
          icon={Clock}
          label="Process uptime"
          value={display ? formatDuration(display.uptime.processSeconds) : "—"}
        />
        <StatTile
          icon={Clock}
          label="System uptime"
          value={display ? formatDuration(display.uptime.systemSeconds) : "—"}
        />
      </div>

      {/* Trend charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="CPU load" color={COLOR_CPU} data={history} dataKey="cpu" unit="%" />
        <ChartCard title="Memory usage" color={COLOR_MEMORY} data={history} dataKey="memory" unit="%" />
      </div>

      <NetworkChartCard data={history} />

      <div className="grid md:grid-cols-2 gap-4">
        <DiskMeter disk={display?.disk ?? null} />
        <StatTile
          icon={Network}
          label="Network now"
          value={display ? formatRate(display.network.rxBytesPerSec + display.network.txBytesPerSec) : "—"}
          sub={display ? `↓ ${formatRate(display.network.rxBytesPerSec)}  ↑ ${formatRate(display.network.txBytesPerSec)}` : undefined}
        />
      </div>

      <RequestLogPanel logs={logs} />
    </div>
  )
}
