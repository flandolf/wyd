import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { StopwatchData } from '../StopwatchItem'

export function Stats() {
  const [data, setData] = useState<StopwatchData[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const saved = await window.api.loadData()
      if (saved) {
        setData(saved)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 5000) // refresh every 5s
    return () => clearInterval(interval)
  }, [])

  // Derived Data
  const dailyData = useMemo(() => {
    const datesMap: Record<string, { date: string, totalMs: number }> = {}
    data.forEach(sw => {
      if (sw.sessions) {
        sw.sessions.forEach(session => {
          if (!datesMap[session.date]) {
            datesMap[session.date] = { date: session.date, totalMs: 0 }
          }
          datesMap[session.date].totalMs += session.durationMs
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
      .filter(sw => sw.accumulatedTime > 0)
      .map(sw => ({
        name: sw.title,
        value: sw.accumulatedTime,
        hours: Number((sw.accumulatedTime / (1000 * 60 * 60)).toFixed(2)),
        color: sw.color || '#22c55e'
      }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const totalTimeEverMs = subjectData.reduce((acc, curr) => acc + curr.value, 0)
  const totalHoursEver = (totalTimeEverMs / (1000 * 60 * 60)).toFixed(1)

  const totalTimeTodayMs = dailyData.length > 0 && dailyData[dailyData.length - 1].date === new Date().toISOString().split('T')[0]
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
          <div className="text-sm font-medium text-muted-foreground mb-1">Total Study Time</div>
          <div className="text-3xl font-bold">{totalHoursEver} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-1">Today's Study Time</div>
          <div className="text-3xl font-bold">{totalHoursToday} <span className="text-sm font-normal text-muted-foreground">hrs</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Daily Bar Chart */}
        <div className="p-5 rounded-xl border bg-card shadow-sm flex flex-col h-[320px]">
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
        <div className="p-5 rounded-xl border bg-card shadow-sm flex flex-col h-[320px]">
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
    </div>
    </div>
  )
}
