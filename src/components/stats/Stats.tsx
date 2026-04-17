import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
  RenderableText,
  TooltipValueType
} from 'recharts'
import { invoke } from '@tauri-apps/api/core'
import { SubjectData } from '../SubjectItem'
import { Flame, Clock, TrendingUp, Calendar } from 'lucide-react'

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
  const cells = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(today.getDate() - 34)
    const startDow = start.getDay()
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
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground/50">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day.isInRange) return <div key={i} className="w-full aspect-square" />
          const intensity = day.totalMs === 0 ? 0 : day.totalMs < 3600000 ? 1 : day.totalMs < 10800000 ? 2 : day.totalMs < 21600000 ? 3 : 4
          const bgClass = [
            'bg-muted/50 border border-border/50',
            'bg-emerald-900/50 border border-emerald-900/20',
            'bg-emerald-700/60 border border-emerald-700/20',
            'bg-emerald-500/80 border border-emerald-500/20',
            'bg-emerald-400 border border-emerald-400/20 shadow-[0_0_6px_rgba(52,211,153,0.35)]',
          ][intensity]

          return (
            <div
              key={i}
              onClick={() => onSelectDate(selectedDate === day.date ? null : day.date)}
              className={`w-full aspect-square rounded-[3px] ${bgClass} transition-transform hover:scale-110 cursor-pointer ${
                selectedDate === day.date ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                }`}
              title={`${day.date}: ${formatMsToHhMm(day.totalMs)}`}
            />
          )
        })}
      </div>
    </div>
  )
}

function TimeOfDayBars({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (data.length === 0) return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data available.</div>
  const maxMs = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-4 w-full">
      {data.map((item, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-medium px-0.5">
            <span className="text-muted-foreground">{item.name.split(' ')[0]}</span>
            <span className="tabular-nums">{formatMsToHhMm(item.value)}</span>
          </div>
          <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
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

  const todayDateKey = localDateKeyFromDate(new Date())

  const rangeStartTimeMs = useMemo(() => {
    if (timeRange === 'all') return 0
    const d = new Date()
    d.setDate(d.getDate() - (timeRange === '7d' ? 6 : 29))
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [timeRange])

  const { dailyData, subjectData, timeOfDayData } = useMemo(() => {
    const datesMap: Record<string, { date: string; totalMs: number }> = {}
    const subjectMap: Record<string, { name: string; totalMs: number; color: string }> = {}
    const todMap: Record<string, number> = { 'Morning (6AM-12PM)': 0, 'Afternoon (12PM-6PM)': 0, 'Evening (6PM-12AM)': 0, 'Night (12AM-6AM)': 0 }

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
      if (swTotalMsInRange > 0) subjectMap[sw.id] = { name: sw.title, totalMs: swTotalMsInRange, color: sw.color || '#22c55e' }
    })

    const dailyArr = Object.values(datesMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const formattedDaily = dailyArr.map(item => ({
      ...item,
      label: timeRange === '7d' ? new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }) : new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      hours: Number((item.totalMs / 3600000).toFixed(2))
    }))

    return {
      dailyData: formattedDaily,
      subjectData: Object.values(subjectMap).map(sw => ({ name: sw.name, value: sw.totalMs, color: sw.color })).sort((a, b) => b.value - a.value),
      timeOfDayData: Object.entries(todMap).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value, color: name.includes('Morning') ? '#fcd34d' : name.includes('Afternoon') ? '#f97316' : name.includes('Evening') ? '#3b82f6' : '#1e3a8a' }))
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
      <div className="h-8 shrink-0 flex items-center px-4 bg-muted/20 border-b border-border/40" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="text-xs font-medium text-muted-foreground/80">Statistics</div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Your Performance</h1>
          <div className="flex p-1 bg-muted rounded-xl gap-0.5">
            {(['7d', '30d', 'all'] as const).map(range => (
              <button key={range} onClick={() => { setTimeRange(range); setSelectedDate(null) }} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${timeRange === range && !selectedDate ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'All-Time', value: totalHoursEver, unit: 'hrs', icon: <Clock className="w-4 h-4 text-blue-500" />, bg: 'bg-blue-500/10' },
            { label: 'Daily Avg', value: avgDailyHours, unit: 'hrs', icon: <TrendingUp className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-500/10' },
            { label: 'Streak', value: String(studyStreak), unit: 'days', icon: <Flame className="w-4 h-4 text-orange-500" />, bg: 'bg-orange-500/10' },
            { label: 'Today', value: ((allTimeDatesMap[todayDateKey] || 0) / 3600000).toFixed(1), unit: 'hrs', icon: <Calendar className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-500/10' },
          ].map((card, i) => (
            <div key={i} className="p-5 rounded-2xl border bg-card/50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${card.bg}`}>{card.icon}</div>
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              </div>
              <div className="text-2xl font-black tabular-nums">{card.value}<span className="text-xs font-normal text-muted-foreground ml-1">{card.unit}</span></div>
            </div>
          ))}
        </div>

        {/* Study Time Chart - Fixed Height Container */}
        <div className="p-6 rounded-2xl border bg-card/50 shadow-sm mb-8">
          <h2 className="text-base font-bold mb-6">Study Time Per Day</h2>
          <div className="h-70 w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Pie Chart - Fixed Height Container */}
          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm">
            <h2 className="text-base font-bold mb-6">Time by Subject</h2>
            <div className="h-60 w-full">
              {subjectData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={subjectData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {subjectData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={formatMsToHhMm} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground">No subjects</div>}
            </div>
          </div>

          <div className="p-6 rounded-2xl border bg-card/50 shadow-sm">
            <h2 className="text-base font-bold mb-6">Time of Day</h2>
            <TimeOfDayBars data={timeOfDayData} />
          </div>
        </div>

        <div className="p-6 rounded-2xl border bg-card/50 shadow-sm mb-8">
          <h2 className="text-base font-bold mb-5">Activity Heatmap <span className="ml-2 text-xs font-normal text-muted-foreground">Last 35 days</span></h2>
          <WeeklyHeatmap datesMap={allTimeDatesMap} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </div>
      </div>
    </div>
  )
}