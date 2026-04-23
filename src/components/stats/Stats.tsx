import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  RenderableText,
  TooltipValueType
} from 'recharts'
import { invoke } from '@tauri-apps/api/core'
import { SubjectData } from '../SubjectItem'
import { DEFAULT_SUBJECT_COLOR, CHART_COLORS } from '../../lib/constants'

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

function formatMsToHhMm(ms: RenderableText | TooltipValueType): string {
  const msValue = typeof ms === 'number' ? ms : Number(ms) || 0
  if (msValue < 60000) return '< 1m'
  const hrs = Math.floor(msValue / (1000 * 60 * 60))
  const mins = Math.floor((msValue % (1000 * 60 * 60)) / (1000 * 60))
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

function WeeklyHeatmap({
  datesMap,
  selectedDate,
  onSelectDate,
}: {
  datesMap: Record<string, number>
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}) {
  const { weeks, monthLabels, totalActive, longestStreak, peakDay } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weeksToShow = 26
    // Start from the Sunday that begins the first week
    const end = new Date(today)
    const startRaw = new Date(today)
    startRaw.setDate(today.getDate() - (weeksToShow * 7 - 1))
    const startDow = startRaw.getDay()
    const alignedStart = new Date(startRaw)
    alignedStart.setDate(startRaw.getDate() - startDow)

    // Build week columns: each week is an array of 7 days (Sun–Sat)
    const weekCols: Array<Array<{ date: string; totalMs: number; isInRange: boolean }>> = []
    const monthLabelMap: Array<{ label: string; weekIndex: number }> = []
    let lastMonth = -1
    const d = new Date(alignedStart)

    while (d <= end) {
      const week: Array<{ date: string; totalMs: number; isInRange: boolean }> = []
      for (let dow = 0; dow < 7; dow++) {
        const key = localDateKeyFromDate(d)
        const isInRange = d >= startRaw && d <= today
        week.push({ date: key, totalMs: datesMap[key] || 0, isInRange })
        if (isInRange && d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth()
          monthLabelMap.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), weekIndex: weekCols.length })
        }
        d.setDate(d.getDate() + 1)
      }
      weekCols.push(week)
    }

    // Compute extra stats
    let totalActive = 0
    let peakMs = 0
    let peakDay = ''
    Object.entries(datesMap).forEach(([date, ms]) => {
      if (ms > 0) { totalActive++; if (ms > peakMs) { peakMs = ms; peakDay = date } }
    })

    // Longest streak calc
    const sortedDays = Object.keys(datesMap).filter(k => datesMap[k] > 0).sort()
    let longest = 0, cur = 0, prev: Date | null = null
    sortedDays.forEach(d => {
      const dt = new Date(d + 'T00:00:00')
      if (prev) {
        const diff = (dt.getTime() - prev.getTime()) / 86400000
        cur = diff === 1 ? cur + 1 : 1
      } else { cur = 1 }
      if (cur > longest) longest = cur
      prev = dt
    })

    return { weeks: weekCols, monthLabels: monthLabelMap, totalActive, longestStreak: longest, peakDay }
  }, [datesMap])

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const INTENSITY_LABELS = ['None', '< 1h', '1–3h', '3–6h', '6h+']

  const getCellStyle = (intensity: number, isSelected: boolean) => {
    const base = [
      { bg: 'var(--muted)', opacity: 0.15, shadow: 'none' },
      { bg: 'var(--foreground)', opacity: 0.12, shadow: 'none' },
      { bg: 'var(--foreground)', opacity: 0.32, shadow: 'none' },
      { bg: 'var(--foreground)', opacity: 0.62, shadow: 'none' },
      { bg: 'var(--foreground)', opacity: 1, shadow: '0 0 10px rgba(255,255,255,0.15)' },
    ][intensity]
    return {
      backgroundColor: base.bg,
      opacity: base.opacity,
      boxShadow: isSelected ? '0 0 0 2px var(--foreground), 0 0 0 3px var(--background)' : base.shadow,
    }
  }

  return (
    <div className="space-y-5">
      {/* Month labels row */}
      <div className="flex" style={{ paddingLeft: 32 }}>
        {weeks.map((_, wi) => {
          const label = monthLabels.find(m => m.weekIndex === wi)
          return (
            <div key={wi} className="flex-1 min-w-0">
              {label && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  {label.label}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid: DOW labels + week columns */}
      <div className="flex gap-0">
        {/* Day-of-week labels */}
        <div className="flex flex-col justify-around pr-2" style={{ width: 30 }}>
          {DOW_LABELS.map((d, i) => (
            i % 2 === 1
              ? <div key={i} className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">{d[0]}</div>
              : <div key={i} />
          ))}
        </div>

        {/* Week columns */}
        <div className="flex flex-1 gap-0.75">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col flex-1 gap-0.75">
              {week.map((day, di) => {
                if (!day.isInRange) return <div key={di} className="flex-1 rounded-xs" />
                const intensity = day.totalMs === 0 ? 0 : day.totalMs < 3600000 ? 1 : day.totalMs < 10800000 ? 2 : day.totalMs < 21600000 ? 3 : 4
                const isSelected = selectedDate === day.date
                const cellStyle = getCellStyle(intensity, isSelected)
                return (
                  <div
                    key={di}
                    onClick={() => onSelectDate(isSelected ? null : day.date)}
                    title={`${day.date}: ${formatMsToHhMm(day.totalMs)}`}
                    className="flex-1 rounded-xs cursor-pointer transition-transform duration-150 hover:scale-105"
                    style={{
                      ...cellStyle,
                      minHeight: '2.5vh',
                      transform: isSelected ? 'scale(1.05)' : undefined,
                      zIndex: isSelected ? 10 : undefined,
                      position: 'relative',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer: legend + mini stats */}
      <div className="flex items-center justify-between pt-1">
        {/* Legend */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Less</span>
          <div className="flex gap-0.75">
            {[0, 1, 2, 3, 4].map(i => {
              const style = getCellStyle(i, false)
              return (
                <div
                  key={i}
                  title={INTENSITY_LABELS[i]}
                  className="rounded-xs"
                  style={{ ...style, width: 10, height: 10 }}
                />
              )
            })}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">More</span>
        </div>

        {/* Mini stats */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Active Days</div>
            <div className="text-xs font-black tabular-nums">{totalActive}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Longest Streak</div>
            <div className="text-xs font-black tabular-nums">{longestStreak}d</div>
          </div>
          {peakDay && (
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Best Day</div>
              <div className="text-xs font-black tabular-nums">{new Date(peakDay + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimeOfDayBars({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (data.length === 0) return <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">No data</div>
  const maxMs = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-4 w-full">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold px-0.5 uppercase tracking-wider">
            <span className="text-muted-foreground/60">{item.name.split(' ')[0]}</span>
            <span className="tabular-nums text-muted-foreground">{formatMsToHhMm(item.value)}</span>
          </div>
          <div className="flex-1 bg-muted/20 rounded-full h-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.value / maxMs) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Stats() {
  const [data, setData] = useState<SubjectData[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const applyFromStorage = (raw: string | null): boolean => {
      if (!raw) return false
      try {
        const parsed = JSON.parse(raw) as SubjectData[]
        if (Array.isArray(parsed)) { setData(parsed); return true }
      } catch { /* ignore */ }
      return false
    }

    const fetchData = async () => {
      const usedStorage = applyFromStorage(localStorage.getItem('wyd-subjects'))
      if (usedStorage || !isActive) return
      const saved = await invoke<SubjectData[]>('load_data')
      if (isActive && Array.isArray(saved)) setData(saved)
    }

    fetchData()
    const onDataUpdated = () => applyFromStorage(localStorage.getItem('wyd-subjects'))
    window.addEventListener('wyd:data-updated', onDataUpdated)
    return () => { isActive = false; window.removeEventListener('wyd:data-updated', onDataUpdated) }
  }, [])


  const rangeStartTimeMs = useMemo(() => {
    if (timeRange === 'all') return 0
    const d = new Date()
    d.setDate(d.getDate() - (timeRange === '7d' ? 6 : 29))
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [timeRange])

  const { dailyData, subjectData, timeOfDayData, extraMetrics } = useMemo(() => {
    const datesMap: Record<string, { date: string; totalMs: number }> = {}
    const subjectMap: Record<string, { name: string; totalMs: number; color: string }> = {}
    const todMap: Record<string, number> = { 'Morning (6AM-12PM)': 0, 'Afternoon (12PM-6PM)': 0, 'Evening (6PM-12AM)': 0, 'Night (12AM-6AM)': 0 }
    
    let totalSessions = 0
    let totalDurationMs = 0
    let activeDays = new Set<string>()

    const daysToGen = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 0
    if (daysToGen > 0) {
      for (let i = 0; i < daysToGen; i++) {
        const d = new Date(); d.setDate(d.getDate() - i)
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
          const isInRange = timeRange === 'all' || sessionDateObj.getTime() >= rangeStartTimeMs
          const isSelectedDay = selectedDate ? sessionDateStr === selectedDate : true

          if (isInRange && isSelectedDay) {
            swTotalMsInRange += session.durationMs
            totalDurationMs += session.durationMs
            totalSessions++
            activeDays.add(sessionDateStr)

            if (!datesMap[sessionDateStr]) datesMap[sessionDateStr] = { date: sessionDateStr, totalMs: 0 }
            datesMap[sessionDateStr].totalMs += session.durationMs
            const h = sessionDateObj.getHours()
            if (h >= 6 && h < 12) todMap['Morning (6AM-12PM)'] += session.durationMs
            else if (h >= 12 && h < 18) todMap['Afternoon (12PM-6PM)'] += session.durationMs
            else if (h >= 18) todMap['Evening (6PM-12AM)'] += session.durationMs
            else todMap['Night (12AM-6AM)'] += session.durationMs
          }
        })
      }
      if (swTotalMsInRange > 0) subjectMap[sw.id] = { name: sw.title, totalMs: swTotalMsInRange, color: sw.color || DEFAULT_SUBJECT_COLOR }
    })

    const dailyArr = Object.values(datesMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const formattedDaily = dailyArr.map(item => ({
      ...item,
      label: timeRange === '7d' ? new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }) : new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: Number((item.totalMs / 3600000).toFixed(2))
    }))

    const avgSessionMs = totalSessions > 0 ? totalDurationMs / totalSessions : 0
    const intensityScore = activeDays.size > 0 ? (totalDurationMs / activeDays.size / 3600000).toFixed(1) : '0'

    return {
      dailyData: formattedDaily,
      subjectData: Object.values(subjectMap).map(sw => ({ name: sw.name, value: sw.totalMs, color: sw.color })).sort((a, b) => b.value - a.value),
      timeOfDayData: Object.entries(todMap).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value, color: name.includes('Morning') ? CHART_COLORS.morning : name.includes('Afternoon') ? CHART_COLORS.afternoon : name.includes('Evening') ? CHART_COLORS.evening : CHART_COLORS.night })),
      extraMetrics: {
        avgSession: formatMsToHhMm(avgSessionMs),
        totalSessions,
        intensityScore
      }
    }
  }, [data, timeRange, rangeStartTimeMs, selectedDate])

  const allTimeDatesMap = useMemo(() => {
    const datesMap: Record<string, number> = {}
    data.forEach(sw => {
      sw.sessions?.forEach(s => {
        const key = localDateKeyFromSession(s); datesMap[key] = (datesMap[key] || 0) + s.durationMs
      })
    })
    return datesMap
  }, [data])

  const studyStreak = useMemo(() => calculateStreak(allTimeDatesMap), [allTimeDatesMap])
  const totalHoursEver = (Object.values(data).reduce((acc, sw) => acc + Math.max(sw.sessions?.reduce((s, sess) => s + sess.durationMs, 0) || 0, sw.accumulatedTime), 0) / 3600000).toFixed(1)
  const avgDailyHours = (Object.values(allTimeDatesMap).length > 0 ? (Object.values(allTimeDatesMap).reduce((a, b) => a + b, 0) / Object.values(allTimeDatesMap).length / 3600000) : 0).toFixed(1)

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <div className="h-10 shrink-0 flex items-center justify-between px-4 bg-muted/20 border-b border-border/40" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="text-xs font-medium text-muted-foreground/80 uppercase tracking-widest">Stats</div>
        <div className="flex bg-muted/50 p-0.5 rounded-lg">
          {(['7d', '30d', 'all'] as const).map(range => (
            <button key={range} onClick={() => { setTimeRange(range); setSelectedDate(null) }} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${timeRange === range && !selectedDate ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-10">
          
          <div className="flex flex-wrap gap-x-12 gap-y-6 mb-16">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Focused</span>
              <div className="text-3xl font-black tabular-nums">{totalHoursEver}<span className="text-sm font-medium text-muted-foreground ml-1">h</span></div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daily Avg</span>
              <div className="text-3xl font-black tabular-nums">{avgDailyHours}<span className="text-sm font-medium text-muted-foreground ml-1">h</span></div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Current Streak</span>
              <div className="text-3xl font-black tabular-nums text-orange-500">{studyStreak}<span className="text-sm font-medium text-muted-foreground ml-1">d</span></div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sessions</span>
              <div className="text-3xl font-black tabular-nums">{extraMetrics.totalSessions}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Session</span>
              <div className="text-3xl font-black tabular-nums">{extraMetrics.avgSession}</div>
            </div>
          </div>

          <div className="space-y-20">
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Study Distribution</h2>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }} />
                      <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.1 }} contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '10px' }} />
                      <Bar dataKey="hours" fill="var(--foreground)" radius={[2, 2, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Subjects</h3>
                    <div className="space-y-2">
                      {subjectData.slice(0, 5).map((s, i) => (
                        <div key={i} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-xs font-medium truncate max-w-30">{s.name}</span>
                          </div>
                          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{formatMsToHhMm(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Routine</h3>
                    <TimeOfDayBars data={timeOfDayData} />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Activity Intensity</h2>
                <div className="h-px flex-1 bg-border/40" />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-0.5 rounded-md border border-border/40 hover:border-border"
                  >
                    {selectedDate} ✕
                  </button>
                )}
              </div>
              <div className="bg-muted/5 rounded-2xl border border-border/30 p-6 pb-5">
                <WeeklyHeatmap datesMap={allTimeDatesMap} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}