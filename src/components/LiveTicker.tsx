import { useState, useEffect } from 'react'

type Participant = { name: string; units: number; joined_at?: number }
export default function LiveTicker({ participants }: { participants: Record<string, Participant> }) {
  const [now, setNow] = useState<number>(Date.now)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const ticks = Object.entries(participants || {})
    .map(([id, p]) => ({ id, name: p.name, units: p.units, joined_at: p.joined_at || 0 }))
    .sort((a, b) => (b.joined_at || 0) - (a.joined_at || 0))

  const timeAgo = (ts?: number, currentTime: number = now) => {
    if (!ts) return 'just now'
    const diff = Math.floor((currentTime - ts) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Live Ticker</h4>
      <div className="space-y-2 max-h-48 overflow-auto">
        {ticks.length === 0 && <div className="text-sm text-gray-500">No recent activity</div>}
        {ticks.map(t => (
          <div key={t.id} className="flex items-center justify-between text-sm animate-slide-in">
            <div className="dark:text-gray-300"><span className="font-medium text-gray-900 dark:text-white">{t.name}</span> joined — <span className="text-primary-green font-semibold">{t.units}</span> bag(s)</div>
            <div className="text-xs text-gray-400">{timeAgo(t.joined_at)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}