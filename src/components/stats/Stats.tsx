import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, PieSectorShapeProps, Sector } from 'recharts'
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

function formatMsToHhMm(ms: number) {
  if (ms < 60000) return '< 1m'
  const hrs = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hrs === 0) return `${mins}m`
  return `${hrs}h ${mins}m`
}

export function Stats() {
  const [data, setData] = useState<StopwatchData[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const MyCustomPie = (props: PieSectorShapeProps) => <Sector {...props} fill={(props.payload as any)?.color} />

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
        // Ignore malformed localStorage payload
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
      if (event.key === 'wyd-stopwatches') applyFromStorage(event.newValue)
    }

    const onDataUpdated = () => applyFromStorage(localStorage.getItem('wyd-stopwatches'))
    const onVisibilityOrFocus = () => { if (document.visibilityState === 'visible') fetchData() }

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

  const todayDateKey = localDateKeyFromDate(new Date())

  // Time Range Parsing
  const rangeStartTimeMs = useMemo(() => {
    if (timeRange === 'all') return 0
    const d = new Date()
    if (timeRange === '7d') d.setDate(d.getDate() - 6)
    if (timeRange === '30d') d.setDate(d.getDate() - 29)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [timeRange])

  // Derive Daily & Subject Data (filtered)
  const { dailyData, subjectData, timeOfDayData } = useMemo(() => {
    const datesMap: Record<string, { date: string, totalMs: number }> = {}
    const subjectMap: Record<string, { name: string, totalMs: number, color: string }> = {}
    const todMap: Record<string, number> = {
      'Morning (6AM-12PM)': 0,
      'Afternoon (12PM-6PM)': 0,
      'Evening (6PM-12AM)': 0,
      'Night (12AM-6AM)': 0
    }

    // Initialize daily map for 7d or 30d to ensure no gaps
    const today = new Date()
    const daysToGen = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 0
    if (daysToGen > 0) {
      for (let i = daysToGen - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const dateStr = localDateKeyFromDate(d)
        datesMap[dateStr] = { date: dateStr, totalMs: 0 }
      }
    }

    data.forEach(sw => {
      let swTotalMsInRange = 0

      if (sw.sessions) {
        sw.sessions.forEach(session => {
          const sessionDateStr = localDateKeyFromSession(session)
          const sessionDateObj = session.startedAtIso ? new Date(session.startedAtIso) : new Date(session.date + 'T00:00:00')
          const sessionTimeMs = sessionDateObj.getTime()

          const isInRange = timeRange === 'all' || sessionTimeMs >= rangeStartTimeMs
          const isSelectedDay = selectedDate ? sessionDateStr === selectedDate : true

          if (isInRange && isSelectedDay) {
            swTotalMsInRange += session.durationMs

            if (timeRange === 'all' && !datesMap[sessionDateStr]) {
              datesMap[sessionDateStr] = { date: sessionDateStr, totalMs: 0 }
            }
            if (datesMap[sessionDateStr]) {
              datesMap[sessionDateStr].totalMs += session.durationMs
            }

            const h = sessionDateObj.getHours()
            if (h >= 6 && h < 12) todMap['Morning (6AM-12PM)'] += session.durationMs
            else if (h >= 12 && h < 18) todMap['Afternoon (12PM-6PM)'] += session.durationMs
            else if (h >= 18) todMap['Evening (6PM-12AM)'] += session.durationMs
            else todMap['Night (12AM-6AM)'] += session.durationMs
          }
        })
      }

      // Explicitly include todays manual modifications if within range
      const isInRangeToday = timeRange === 'all' || new Date().getTime() >= rangeStartTimeMs
      const isSelectedToday = selectedDate ? todayDateKey === selectedDate : true
      if (isInRangeToday && isSelectedToday) {
        const todaySessions = (sw.sessions || []).filter(s => localDateKeyFromSession(s) === todayDateKey)
        const todaySum = todaySessions.reduce((sum, s) => sum + s.durationMs, 0)
        if (sw.accumulatedTime > todaySum) {
          const extra = sw.accumulatedTime - todaySum
          swTotalMsInRange += extra
          if (!datesMap[todayDateKey]) datesMap[todayDateKey] = { date: todayDateKey, totalMs: 0 }
          datesMap[todayDateKey].totalMs += extra
          todMap['Afternoon (12PM-6PM)'] += extra
        }
      }

      if (swTotalMsInRange > 0) {
        subjectMap[sw.id] = { name: sw.title, totalMs: swTotalMsInRange, color: sw.color || '#22c55e' }
      }
    })

    const dailyArr = Object.values(datesMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const formattedDaily = dailyArr.map(item => {
      const d = new Date(item.date + 'T00:00:00')
      const label = timeRange === '7d' 
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { ...item, label, hours: Number((item.totalMs / (1000 * 60 * 60)).toFixed(2)) }
    })

    const formattedSubject = Object.values(subjectMap)
      .map(sw => ({
        name: sw.name,
        value: sw.totalMs,
        hours: Number((sw.totalMs / (1000 * 60 * 60)).toFixed(2)),
        color: sw.color
      }))
      .sort((a, b) => b.value - a.value)

    const formattedTod = Object.entries(todMap)
      .filter(([_, val]) => val > 0)
      .map(([name, val]) => ({
        name,
        value: val,
        hours: Number((val / (1000 * 60 * 60)).toFixed(2)),
        color: name.includes('Morning') ? '#fcd34d' : name.includes('Afternoon') ? '#f97316' : name.includes('Evening') ? '#3b82f6' : '#1e3a8a'
      }))

    return { dailyData: formattedDaily, subjectData: formattedSubject, timeOfDayData: formattedTod }
  }, [data, timeRange, rangeStartTimeMs, todayDateKey, selectedDate])

  // All time and Heatmap Data
  const heatmapData = useMemo(() => {
    const datesMap: Record<string, number> = {}
    data.forEach(sw => {
      if (sw.sessions) {
        sw.sessions.forEach(session => {
          const sessionDate = localDateKeyFromSession(session)
          datesMap[sessionDate] = (datesMap[sessionDate] || 0) + session.durationMs
        })
      }
      const todaySessions = (sw.sessions || []).filter(s => localDateKeyFromSession(s) === todayDateKey)
      const todaySessionsSum = todaySessions.reduce((sum, s) => sum + s.durationMs, 0)
      if (sw.accumulatedTime > todaySessionsSum) {
        datesMap[todayDateKey] = (datesMap[todayDateKey] || 0) + (sw.accumulatedTime - todaySessionsSum)
      }
    })

    const days = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = localDateKeyFromDate(d)
      days.push({ date: dateStr, totalMs: datesMap[dateStr] || 0 })
    }
    return days
  }, [data, todayDateKey])

  // Totals calculations
  const totalTimeEverMs = Object.values(data).reduce((acc, sw) => {
    const fromSessions = (sw.sessions || []).reduce((sum, s) => sum + s.durationMs, 0)
    return acc + Math.max(fromSessions, sw.accumulatedTime)
  }, 0)
  const totalHoursEver = (totalTimeEverMs / (1000 * 60 * 60)).toFixed(1)

  const isAnyRunning = data.some(sw => sw.isRunning)
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now())

  useEffect(() => {
    if (!isAnyRunning) return
    let raf: number
    const tick = () => {
      setCurrentTimeMs(Date.now())
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [isAnyRunning])

  const runningTimeTodayMs = useMemo(() => {
    return data.reduce((acc, sw) => {
      if (sw.isRunning && sw.startTime) {
        const startKey = localDateKeyFromDate(new Date(sw.startTime))
        if (startKey === todayDateKey) {
          return acc + (currentTimeMs - sw.startTime)
        }
        const midnightToday = new Date()
        midnightToday.setHours(0, 0, 0, 0)
        return acc + (currentTimeMs - midnightToday.getTime())
      }
      return acc
    }, 0)
  }, [data, currentTimeMs, todayDateKey])

  const completedTimeTodayMs = useMemo(() => {
    return data.reduce((acc, sw) => {
      const todaySessions = (sw.sessions || []).filter(s => localDateKeyFromSession(s) === todayDateKey)
      const todaySessionsSum = todaySessions.reduce((sum, s) => sum + s.durationMs, 0)
      return acc + Math.max(todaySessionsSum, sw.accumulatedTime)
    }, 0)
  }, [data, todayDateKey])

  const totalTimeTodayMs = completedTimeTodayMs + runningTimeTodayMs
  const totalHoursToday = (totalTimeTodayMs / (1000 * 60 * 60)).toFixed(1)

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col font-sans">
      <div className="h-8 shrink-0 flex items-center px-4 bg-muted/20 border-b border-border/40" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="text-xs font-medium text-muted-foreground/80">Statistics</div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Your Performance</h1>
          
          <div className="flex p-1 bg-muted rounded-xl">
            <button 
              onClick={() => { setTimeRange('7d'); setSelectedDate(null); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${(timeRange === '7d' && !selectedDate) ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => { setTimeRange('30d'); setSelectedDate(null); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${(timeRange === '30d' && !selectedDate) ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              30 Days
            </button>
            <button 
              onClick={() => { setTimeRange('all'); setSelectedDate(null); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${(timeRange === 'all' && !selectedDate) ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All Time
            </button>
            {selectedDate && (
              <button 
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors bg-background shadow-sm text-foreground`}
              >
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <span className="ml-2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedDate(null); }}>×</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col justify-center items-start">
            <div className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div> All-Time Logged
            </div>
            <div className="text-4xl font-black">{totalHoursEver} <span className="text-lg font-normal text-muted-foreground">hrs</span></div>
          </div>
          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col justify-center items-start">
            <div className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Today's Study Time
            </div>
            <div className="text-4xl font-black">{totalHoursToday} <span className="text-lg font-normal text-muted-foreground">hrs</span></div>
          </div>
        </div>

        {/* Daily Bar Chart */}
        <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col mb-8" style={{ minHeight: '340px' }}>
          <h2 className="text-base font-bold mb-6 shrink-0 flex items-center justify-between">
            <span>Study Time Per Day</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-md">{timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : 'History'}</span>
          </h2>
          <div className="flex-1 w-full h-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    dy={10}
                    minTickGap={20}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [`${value} hrs`, 'Study Time']}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar 
                    dataKey="hours" 
                    fill="#3b82f6" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={40} 
                    onClick={(data: any) => {
                      const targetDate = data?.payload?.date || data?.date;
                      if (targetDate) setSelectedDate(targetDate)
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No daily data in this period.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Subject Pie Chart */}
          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col items-center">
            <h2 className="text-base font-bold mb-6 w-full text-left">Time by Subject</h2>
            <div className="w-full flex-1 min-h-55">
              {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={subjectData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      shape={MyCustomPie}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontWeight: '500', color: 'hsl(var(--card-foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: any, name: any) => [formatMsToHhMm(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No subjects tracked.
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="mt-6 w-full grid grid-cols-2 gap-3">
              {subjectData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-lg">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-foreground font-medium truncate flex-1">{item.name}</span>
                  <span className="text-muted-foreground text-xs font-semibold">{formatMsToHhMm(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Time of Day Pie Chart */}
          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col items-center">
            <h2 className="text-base font-bold mb-6 w-full text-left">Time of Day</h2>
            <div className="w-full flex-1 min-h-55">
              {timeOfDayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={timeOfDayData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {timeOfDayData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontWeight: '500', color: 'hsl(var(--card-foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: any, name: any) => [formatMsToHhMm(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No data available.
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="mt-6 w-full grid grid-cols-2 gap-3">
              {timeOfDayData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-lg">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-foreground font-medium truncate flex-1">{item.name.split(' ')[0]}</span>
                  <span className="text-muted-foreground text-xs font-semibold">{formatMsToHhMm(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Map */}
        <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col mb-4">
          <h2 className="text-base font-bold mb-6">Activity Heatmap (Last 30 Days)</h2>
          <div className="flex gap-2 flex-wrap items-center">
            {heatmapData.map((day, i) => {
              const intensity = day.totalMs === 0 ? 0 :
                day.totalMs < 1000 * 60 * 60 ? 1 :
                  day.totalMs < 1000 * 60 * 60 * 3 ? 2 :
                    day.totalMs < 1000 * 60 * 60 * 6 ? 3 : 4

              const bgClass = [
                'bg-muted/50 border border-border/50',
                'bg-emerald-900/50 border border-emerald-900/20',
                'bg-emerald-700/60 border border-emerald-700/20',
                'bg-emerald-500/80 border border-emerald-500/20',
                'bg-emerald-400 border border-emerald-400/20 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
              ][intensity]

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(day.date)}
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md ${bgClass} transition-transform hover:scale-110 cursor-pointer`}
                  title={`${day.date}: ${formatMsToHhMm(day.totalMs)}`}
                />
              )
            })}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground font-medium justify-end">
            <span>Less</span>
            <div className="w-3 h-3 rounded bg-muted/50 border border-border/50" />
            <div className="w-3 h-3 rounded bg-emerald-900/50" />
            <div className="w-3 h-3 rounded bg-emerald-700/60" />
            <div className="w-3 h-3 rounded bg-emerald-500/80" />
            <div className="w-3 h-3 rounded bg-emerald-400" />
            <span>More</span>
          </div>
        </div>

      </div>
    </div>
  )
}
