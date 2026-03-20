import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, PieSectorShapeProps, Sector, ReferenceLine,
} from 'recharts'
import { invoke } from '@tauri-apps/api/core'
import { SubjectData } from '../SubjectItem'
import { Flame, Clock, TrendingUp, Calendar, Trophy, X } from 'lucide-react'

function localDateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateKeyFromSession(session: { startedAtIso?: string; date: string }): string {
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

function calculateStreak(datesMap: Record<string, number>): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  let currentDate = new Date(today)

  while (true) {
    const dateKey = localDateKeyFromDate(currentDate)
    if (datesMap[dateKey] && datesMap[dateKey] > 0) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      if (streak === 0 && currentDate.getTime() === today.getTime()) {
        currentDate.setDate(currentDate.getDate() - 1)
        continue
      }
      break
    }
  }
  return streak
}

// ─── Heatmap grid aligned to weeks (Sun–Sat), 5 weeks = 35 cells ───────────
function WeeklyHeatmap({
  datesMap,
  selectedDate,
  onSelectDate,
}: {
  datesMap: Record<string, number>
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}) {
  const cells = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Go back to 34 days ago → 35 total days
    const start = new Date(today)
    start.setDate(today.getDate() - 34)

    // Pad left so first cell is Sunday
    const startDow = start.getDay() // 0 = Sun
    const paddedStart = new Date(start)
    paddedStart.setDate(start.getDate() - startDow)

    const grid: Array<{ date: string; totalMs: number; isInRange: boolean }> = []
    const d = new Date(paddedStart)

    for (let i = 0; i < 35; i++) {
      const key = localDateKeyFromDate(d)
      const isInRange = d >= start && d <= today
      grid.push({ date: key, totalMs: datesMap[key] || 0, isInRange })
      d.setDate(d.getDate() + 1)
    }
    return grid
  }, [datesMap])

  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div>
      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground/50">
            {d}
          </div>
        ))}
      </div>
      {/* 5-row × 7-col grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day.isInRange) {
            return <div key={i} className="w-full aspect-square" />
          }

          const intensity =
            day.totalMs === 0
              ? 0
              : day.totalMs < 1000 * 60 * 60
              ? 1
              : day.totalMs < 1000 * 60 * 60 * 3
              ? 2
              : day.totalMs < 1000 * 60 * 60 * 6
              ? 3
              : 4

          const bgClass = [
            'bg-muted/50 border border-border/50',
            'bg-emerald-900/50 border border-emerald-900/20',
            'bg-emerald-700/60 border border-emerald-700/20',
            'bg-emerald-500/80 border border-emerald-500/20',
            'bg-emerald-400 border border-emerald-400/20 shadow-[0_0_6px_rgba(52,211,153,0.35)]',
          ][intensity]

          const isSelected = selectedDate === day.date
          const isToday = day.date === localDateKeyFromDate(new Date())

          return (
            <div
              key={i}
              onClick={() =>
                isSelected ? onSelectDate(null) : onSelectDate(day.date)
              }
              className={`w-full aspect-square rounded-[3px] ${bgClass} transition-transform hover:scale-110 cursor-pointer ${
                isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
              } ${isToday ? 'ring-1 ring-white/30' : ''}`}
              title={`${day.date}: ${formatMsToHhMm(day.totalMs)}`}
            />
          )
        })}
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground justify-end">
        <span>Less</span>
        {[
          'bg-muted/50 border border-border/50',
          'bg-emerald-900/50',
          'bg-emerald-700/60',
          'bg-emerald-500/80',
          'bg-emerald-400',
        ].map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// ─── Time-of-Day horizontal bar chart ──────────────────────────────────────
function TimeOfDayBars({
  data,
}: {
  data: Array<{ name: string; value: number; color: string }>
}) {
  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No data available.
      </div>
    )
  }
  const maxMs = Math.max(...data.map(d => d.value), 1)
  const shortLabel = (name: string) => name.split(' ')[0]

  return (
    <div className="space-y-3 w-full">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20 shrink-0">{shortLabel(item.name)}</span>
          <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(item.value / maxMs) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground w-14 text-right shrink-0">
            {formatMsToHhMm(item.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Stats component ───────────────────────────────────────────────────
export function Stats() {
  const [data, setData] = useState<SubjectData[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const PieShape = (props: PieSectorShapeProps) => (
    <Sector {...props} fill={(props.payload as any)?.color} />
  )

  useEffect(() => {
    let isActive = true

    const applyFromStorage = (raw: string | null): boolean => {
      if (!raw) return false
      try {
        const parsed = JSON.parse(raw) as SubjectData[]
        if (Array.isArray(parsed)) {
          setData(parsed)
          return true
        }
      } catch {
        // ignore malformed payload
      }
      return false
    }

    const fetchData = async () => {
      const usedStorage = applyFromStorage(localStorage.getItem('wyd-subjects'))
      if (usedStorage || !isActive) return

      const saved = await invoke<SubjectData[]>('load_data')
      if (isActive && Array.isArray(saved)) {
        setData(saved)
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'wyd-subjects') applyFromStorage(event.newValue)
    }
    const onDataUpdated = () => applyFromStorage(localStorage.getItem('wyd-subjects'))
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') fetchData()
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

  const todayDateKey = localDateKeyFromDate(new Date())

  const rangeStartTimeMs = useMemo(() => {
    if (timeRange === 'all') return 0
    const d = new Date()
    if (timeRange === '7d') d.setDate(d.getDate() - 6)
    if (timeRange === '30d') d.setDate(d.getDate() - 29)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [timeRange])

  const { dailyData, subjectData, timeOfDayData } = useMemo(() => {
    const datesMap: Record<string, { date: string; totalMs: number }> = {}
    const subjectMap: Record<string, { name: string; totalMs: number; color: string }> = {}
    const todMap: Record<string, number> = {
      'Morning (6AM-12PM)': 0,
      'Afternoon (12PM-6PM)': 0,
      'Evening (6PM-12AM)': 0,
      'Night (12AM-6AM)': 0,
    }

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
          const sessionDateObj = session.startedAtIso
            ? new Date(session.startedAtIso)
            : new Date(session.date + 'T00:00:00')
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

      const isInRangeToday = timeRange === 'all' || new Date().getTime() >= rangeStartTimeMs
      const isSelectedToday = selectedDate ? todayDateKey === selectedDate : true
      if (isInRangeToday && isSelectedToday) {
        const todaySessions = (sw.sessions || []).filter(
          s => localDateKeyFromSession(s) === todayDateKey
        )
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
        subjectMap[sw.id] = {
          name: sw.title,
          totalMs: swTotalMsInRange,
          color: sw.color || '#22c55e',
        }
      }
    })

    const dailyArr = Object.values(datesMap).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    const formattedDaily = dailyArr.map(item => {
      const d = new Date(item.date + 'T00:00:00')
      const label =
        timeRange === '7d'
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { ...item, label, hours: Number((item.totalMs / (1000 * 60 * 60)).toFixed(2)) }
    })

    const formattedSubject = Object.values(subjectMap)
      .map(sw => ({
        name: sw.name,
        value: sw.totalMs,
        hours: Number((sw.totalMs / (1000 * 60 * 60)).toFixed(2)),
        color: sw.color,
      }))
      .sort((a, b) => b.value - a.value)

    const formattedTod = Object.entries(todMap)
      .filter(([_, val]) => val > 0)
      .map(([name, val]) => ({
        name,
        value: val,
        hours: Number((val / (1000 * 60 * 60)).toFixed(2)),
        color: name.includes('Morning')
          ? '#fcd34d'
          : name.includes('Afternoon')
          ? '#f97316'
          : name.includes('Evening')
          ? '#3b82f6'
          : '#1e3a8a',
      }))

    return { dailyData: formattedDaily, subjectData: formattedSubject, timeOfDayData: formattedTod }
  }, [data, timeRange, rangeStartTimeMs, todayDateKey, selectedDate])

  const allTimeDatesMap = useMemo(() => {
    const datesMap: Record<string, number> = {}
    data.forEach(sw => {
      if (sw.sessions) {
        sw.sessions.forEach(session => {
          const sessionDate = localDateKeyFromSession(session)
          datesMap[sessionDate] = (datesMap[sessionDate] || 0) + session.durationMs
        })
      }
      const todaySessions = (sw.sessions || []).filter(
        s => localDateKeyFromSession(s) === todayDateKey
      )
      const todaySessionsSum = todaySessions.reduce((sum, s) => sum + s.durationMs, 0)
      if (sw.accumulatedTime > todaySessionsSum) {
        datesMap[todayDateKey] =
          (datesMap[todayDateKey] || 0) + (sw.accumulatedTime - todaySessionsSum)
      }
    })
    return datesMap
  }, [data, todayDateKey])

  const studyStreak = useMemo(() => calculateStreak(allTimeDatesMap), [allTimeDatesMap])

  // Best single day
  const bestDayMs = useMemo(
    () => Math.max(...Object.values(allTimeDatesMap), 0),
    [allTimeDatesMap]
  )

  const totalTimeEverMs = Object.values(data).reduce((acc, sw) => {
    const fromSessions = (sw.sessions || []).reduce((sum, s) => sum + s.durationMs, 0)
    return acc + Math.max(fromSessions, sw.accumulatedTime)
  }, 0)
  const totalHoursEver = (totalTimeEverMs / (1000 * 60 * 60)).toFixed(1)

  const activeDaysCount = Object.values(allTimeDatesMap).filter(ms => ms > 0).length
  const avgDailyMs = activeDaysCount > 0 ? totalTimeEverMs / activeDaysCount : 0
  const avgDailyHours = (avgDailyMs / (1000 * 60 * 60)).toFixed(1)
  const avgDailyHoursNum = Number(avgDailyHours)

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
      const todaySessions = (sw.sessions || []).filter(
        s => localDateKeyFromSession(s) === todayDateKey
      )
      const todaySessionsSum = todaySessions.reduce((sum, s) => sum + s.durationMs, 0)
      return acc + todaySessionsSum
    }, 0)
  }, [data, todayDateKey])

  const totalTimeTodayMs = completedTimeTodayMs + runningTimeTodayMs
  const totalHoursToday = (totalTimeTodayMs / (1000 * 60 * 60)).toFixed(1)

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col font-sans">
      {/* Title bar */}
      <div
        className="h-8 shrink-0 flex items-center px-4 bg-muted/20 border-b border-border/40"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="text-xs font-medium text-muted-foreground/80">Statistics</div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Your Performance</h1>

          <div className="flex p-1 bg-muted rounded-xl gap-0.5">
            {(['7d', '30d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => { setTimeRange(range); setSelectedDate(null) }}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === range && !selectedDate
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}

            {selectedDate && (
              <button
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/15 text-primary transition-colors"
                onClick={() => setSelectedDate(null)}
              >
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
                <X className="h-3 w-3 ml-0.5 opacity-70" />
              </button>
            )}
          </div>
        </div>

        {/* Selected date banner */}
        {selectedDate && (
          <div className="mb-6 flex items-center gap-2 text-sm text-primary/80 bg-primary/8 border border-primary/15 rounded-lg px-4 py-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              Showing data for{' '}
              <strong>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </strong>
              .{' '}
              <button
                className="underline underline-offset-2 hover:text-primary transition-colors"
                onClick={() => setSelectedDate(null)}
              >
                Clear filter
              </button>
            </span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: <Clock className="w-4 h-4 text-blue-500" />,
              bg: 'bg-blue-500/20',
              gradient: 'from-blue-500/10',
              label: 'All-Time',
              value: totalHoursEver,
              unit: 'hrs',
            },
            {
              icon: <Calendar className="w-4 h-4 text-emerald-500" />,
              bg: 'bg-emerald-500/20',
              gradient: 'from-emerald-500/10',
              label: 'Today',
              value: totalHoursToday,
              unit: 'hrs',
            },
            {
              icon: <Flame className="w-4 h-4 text-orange-500" />,
              bg: 'bg-orange-500/20',
              gradient: 'from-orange-500/10',
              label: 'Streak',
              value: String(studyStreak),
              unit: 'days',
            },
            {
              icon: <TrendingUp className="w-4 h-4 text-purple-500" />,
              bg: 'bg-purple-500/20',
              gradient: 'from-purple-500/10',
              label: 'Daily Avg',
              value: avgDailyHours,
              unit: 'hrs',
            },
          ].map((card, i) => (
            <div
              key={i}
              className={`p-5 rounded-2xl border bg-linear-to-br ${card.gradient} to-transparent shadow-sm flex flex-col justify-between`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${card.bg}`}>{card.icon}</div>
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              </div>
              <div className="text-3xl font-black tabular-nums">
                {card.value}
                <span className="text-sm font-normal text-muted-foreground ml-1">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Best Day card — only show if there's data */}
        {bestDayMs > 0 && (
          <div className="mb-8 p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium">Personal Best</div>
              <div className="text-sm font-bold">
                {formatMsToHhMm(bestDayMs)}
                <span className="font-normal text-muted-foreground ml-1.5 text-xs">
                  in a single day
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Daily Bar Chart */}
        <div
          className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col mb-8"
          style={{ minHeight: '340px' }}
        >
          <h2 className="text-base font-bold mb-6 shrink-0 flex items-center justify-between">
            <span>Study Time Per Day</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : timeRange === '7d'
                ? 'Last 7 Days'
                : timeRange === '30d'
                ? 'Last 30 Days'
                : 'History'}
            </span>
          </h2>
          <div className="flex-1 w-full h-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyData} margin={{ top: 8, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="color-mix(in oklch, var(--muted-foreground), transparent 80%)"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    dy={10}
                    minTickGap={20}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip
                    cursor={{
                      fill: 'color-mix(in oklch, var(--muted), transparent 50%)',
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: any) => [`${value} hrs`, 'Study Time']}
                    labelStyle={{
                      color: 'var(--foreground)',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                    }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  {/* Average reference line */}
                  {avgDailyHoursNum > 0 && (
                    <ReferenceLine
                      y={avgDailyHoursNum}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      label={{
                        value: `avg ${avgDailyHours}h`,
                        position: 'insideTopRight',
                        fontSize: 10,
                        fill: 'var(--muted-foreground)',
                        dy: -4,
                      }}
                    />
                  )}
                  <Bar
                    dataKey="hours"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    onClick={(d: any) => {
                      const targetDate = d?.payload?.date || d?.date
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
                      shape={PieShape}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        fontWeight: '500',
                        color: 'var(--card-foreground)',
                      }}
                      itemStyle={{ color: 'var(--foreground)' }}
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
            <div className="mt-6 w-full grid grid-cols-2 gap-2">
              {subjectData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-lg"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-foreground font-medium truncate flex-1 text-xs">
                    {item.name}
                  </span>
                  <span className="text-muted-foreground text-xs font-semibold">
                    {formatMsToHhMm(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Time of Day — replaced pie with horizontal bars */}
          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col">
            <h2 className="text-base font-bold mb-6 w-full text-left">Time of Day</h2>
            <div className="flex-1 flex flex-col justify-center">
              <TimeOfDayBars data={timeOfDayData} />
            </div>
            {timeOfDayData.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground/60">
                Most productive: <span className="font-medium text-muted-foreground">
                  {timeOfDayData[0]?.name.split(' ')[0]}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Activity Heatmap — weekly grid */}
        <div className="p-6 rounded-2xl border bg-card/50 shadow-sm flex flex-col mb-4">
          <h2 className="text-base font-bold mb-5">
            Activity Heatmap
            <span className="ml-2 text-xs font-normal text-muted-foreground">Last 35 days</span>
          </h2>
          <WeeklyHeatmap
            datesMap={allTimeDatesMap}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
      </div>
    </div>
  )
}
