import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { invoke } from '@tauri-apps/api/core'
import { StopwatchData } from '../StopwatchItem'

function localDateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateKeyFromSession(session: { startedAtIso?: string, date: string }): string {
  if (session.startedAtIso) {
    return localDateKeyFromDate(new Date(session.startedAtIso))
  }
  return session.date
}

export function Stats() {
  const [data, setData] = useState<StopwatchData[]>([])

  useEffect(() => {
    let isActive = true

    const applyFromStorage = (raw: string | null): boolean => {
      if (!raw) return false
      try {
        const parsed = JSON.parse(raw) as StopwatchData[]
        if (Array.isArray(parsed)) {
          setData(parsed)
          return true
        }
      } catch {
        // Ignore malformed localStorage payload and fallback to invoke.
      }
      return false
    }

    const fetchData = async () => {
      const usedStorage = applyFromStorage(localStorage.getItem('wyd-stopwatches'))
      if (usedStorage || !isActive) return

      const saved = await invoke<StopwatchData[]>('load_data')
      if (isActive && Array.isArray(saved)) {
        setData(saved)
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'wyd-stopwatches') {
        applyFromStorage(event.newValue)
      }
    }

    const onDataUpdated = () => {
      applyFromStorage(localStorage.getItem('wyd-stopwatches'))
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }

    fetchData()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onVisibilityOrFocus)
    window.addEventListener('wyd:data-updated', onDataUpdated)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)

    return () => {
      isActive = false
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onVisibilityOrFocus)
      window.removeEventListener('wyd:data-updated', onDataUpdated)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
    }
  }, [])

  // Derived Data
  const dailyData = useMemo(() => {
    const datesMap: Record<string, { date: string, totalMs: number }> = {}
    data.forEach(sw => {
      if (sw.sessions) {
        sw.sessions.forEach(session => {
          const sessionDate = localDateKeyFromSession(session)
          if (!datesMap[sessionDate]) {
            datesMap[sessionDate] = { date: sessionDate, totalMs: 0 }
          }
          datesMap[sessionDate].totalMs += session.durationMs
        })
      }
    })

    // Convert to array and sort by date ascending
    const arr = Object.values(datesMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    // Keep last 7 items for chart
    return arr.slice(-7).map(item => ({
      ...item,
      label: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
      hours: Number((item.totalMs / (1000 * 60 * 60)).toFixed(2))
    }))
  }, [data])

  const subjectData = useMemo(() => {
    return data
      .map(sw => {
        const totalFromSessions = (sw.sessions || []).reduce((acc, session) => acc + session.durationMs, 0)
        return {
          ...sw,
          totalTrackedMs: totalFromSessions > 0 ? totalFromSessions : sw.accumulatedTime,
        }
      })
      .filter(sw => sw.totalTrackedMs > 0)
      .map(sw => ({
        name: sw.title,
        value: sw.totalTrackedMs,
        hours: Number((sw.totalTrackedMs / (1000 * 60 * 60)).toFixed(2)),
        color: sw.color || '#22c55e'
      }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const heatmapData = useMemo(() => {
    const datesMap: Record<string, number> = {}
    data.forEach(sw => {
      if (sw.sessions) {
        sw.sessions.forEach(session => {
          const sessionDate = localDateKeyFromSession(session)
          datesMap[sessionDate] = (datesMap[sessionDate] || 0) + session.durationMs
        })
      }
    })
    
    // Generate last 30 days
    const days = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        date: dateStr,
        totalMs: datesMap[dateStr] || 0
      })
    }
    return days
  }, [data])

  const totalTimeEverMs = subjectData.reduce((acc, curr) => acc + curr.value, 0)

  const totalHoursEver = (totalTimeEverMs / (1000 * 60 * 60)).toFixed(1)

  const todayDateKey = localDateKeyFromDate(new Date())

  const totalTimeTodayMs = dailyData.length > 0 && dailyData[dailyData.length - 1].date === todayDateKey
    ? dailyData[dailyData.length - 1].totalMs : 0
  const totalHoursToday = (totalTimeTodayMs / (1000 * 60 * 60)).toFixed(1)

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col">
      <div className="h-8 shrink-0 flex items-center px-4 bg-muted/20 border-b border-border/40" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="text-xs font-medium text-muted-foreground/80">Statistics</div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="text-2xl font-bold mb-6 tracking-tight">Your Performance</h1>

        <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-1">All-Time Logged</div>
          <div className="text-3xl font-bold">{totalHoursEver} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-1">Today's Study Time</div>
          <div className="text-3xl font-bold">{totalHoursToday} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Daily Bar Chart */}
        <div className="p-5 rounded-xl border bg-card shadow-sm flex flex-col h-80">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 shrink-0">Study Time Per Day (Last 7 Days)</h2>
          <div className="flex-1 w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#888' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#888' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#222' }}
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No daily data yet complete a session.
              </div>
            )}
          </div>
        </div>

        {/* Subject Pie Chart */}
        <div className="p-5 rounded-xl border bg-card shadow-sm flex flex-col h-80">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 shrink-0">Time per Subject</h2>
          <div className="flex-1 w-full">
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {subjectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No subjects tracked yet.
              </div>
            )}
          </div>
          {/* Custom Legend */}
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {subjectData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 rounded-xl border bg-card shadow-sm flex flex-col mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-4 shrink-0">Activity Map (Last 30 Days)</h2>
        <div className="flex gap-1.5 flex-wrap">
          {heatmapData.map((day, i) => {
            const intensity = day.totalMs === 0 ? 0 : 
              day.totalMs < 1000 * 60 * 60 ? 1 : // < 1hr
              day.totalMs < 1000 * 60 * 60 * 3 ? 2 : // < 3hr
              day.totalMs < 1000 * 60 * 60 * 6 ? 3 : 4 // < 6hr then 6+
            
            const bgClass = [
              'bg-muted', 
              'bg-emerald-900/40', 
              'bg-emerald-700/60', 
              'bg-emerald-500/80', 
              'bg-emerald-400'
            ][intensity]

            return (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-sm ${bgClass}`}
                title={`${day.date}: ${(day.totalMs / (1000 * 60 * 60)).toFixed(1)} hrs`}
              />
            )
          })}
        </div>
      </div>

    </div>
    </div>
  )
}
