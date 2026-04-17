import { useEffect, useState, useMemo } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area,
  RenderableText,
  TooltipValueType
} from 'recharts'
import { invoke } from '@tauri-apps/api/core'
import { SubjectData } from '../SubjectItem'
import { Flame, Clock, TrendingUp, Target, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

function localDateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

export function Stats() {
  const [data, setData] = useState<SubjectData[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')

  useEffect(() => {
    const fetchData = async () => {
      const saved = await invoke<SubjectData[]>('load_data')
      if (Array.isArray(saved)) setData(saved)
    }
    fetchData()
  }, [])

  const { dailyData, subjectData, categoryData } = useMemo(() => {
    const datesMap: Record<string, number> = {}
    const subjectMap: Record<string, { name: string, value: number, color: string }> = {}
    const categoryMap: Record<string, number> = {}

    const now = new Date()
    const cutoff = timeRange === 'all' ? 0 : now.getTime() - (timeRange === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000

    data.forEach(sw => {
      sw.sessions?.forEach(session => {
        const sessionDate = session.startedAtIso ? new Date(session.startedAtIso) : new Date(session.date + 'T00:00:00')
        if (sessionDate.getTime() < cutoff) return

        const dateKey = session.startedAtIso ? session.startedAtIso.split('T')[0] : session.date
        datesMap[dateKey] = (datesMap[dateKey] || 0) + session.durationMs

        subjectMap[sw.id] = {
          name: sw.title,
          value: (subjectMap[sw.id]?.value || 0) + session.durationMs,
          color: sw.color || '#22c55e'
        }

        if (sw.category) {
          categoryMap[sw.category] = (categoryMap[sw.category] || 0) + session.durationMs
        }
      })
    })

    const daily = Object.entries(datesMap).map(([date, ms]) => {
      const [year, month, day] = date.split('-').map(Number)
      const localDate = new Date(year, month - 1, day)
      return {
        date,
        hours: Number((ms / 3600000).toFixed(2)),
        label: localDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      }
    }).sort((a, b) => a.date.localeCompare(b.date))

    return {
      dailyData: daily,
      subjectData: Object.values(subjectMap).sort((a, b) => b.value - a.value),
      categoryData: Object.entries(categoryMap).map(([name, value]) => ({ name, value }))
    }
  }, [data, timeRange])

  const totalHours = (Object.values(subjectData).reduce((acc, s) => acc + s.value, 0) / 3600000).toFixed(1)
  const streak = calculateStreak(useMemo(() => {
    const m: Record<string, number> = {}
    data.forEach(sw => sw.sessions?.forEach(s => {
      const d = s.startedAtIso ? s.startedAtIso.split('T')[0] : s.date
      m[d] = (m[d] || 0) + s.durationMs
    }))
    return m
  }, [data]))

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1 font-medium">Insights into your learning habits.</p>
        </div>
        <div className="flex p-1 bg-muted rounded-xl gap-1">
          {['7d', '30d', 'all'].map(r => (
            <Button
              key={r}
              variant={timeRange === r ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(r as any)}
              className="px-4 font-bold capitalize"
            >
              {r === 'all' ? 'Lifetime' : r}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Focused', value: totalHours, unit: 'hrs', icon: Clock, color: 'text-blue-500' },
          { label: 'Study Streak', value: streak, unit: 'days', icon: Flame, color: 'text-orange-500' },
          { label: 'Daily Average', value: (Number(totalHours) / Math.max(dailyData.length, 1)).toFixed(1), unit: 'hrs', icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Active Goals', value: data.filter(s => (s.dailyGoalMs || 0) > 0).length, unit: 'subjects', icon: Target, color: 'text-emerald-500' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-lg shadow-black/5 bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("p-2 rounded-xl bg-muted", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black tabular-nums">{stat.value}</span>
                <span className="text-sm font-bold text-muted-foreground uppercase">{stat.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-lg shadow-black/5 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Focus Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="hours" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg shadow-black/5 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Category Split</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex flex-col justify-center">
            {categoryData.length > 0 ? (
               <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={[`#3b82f6`, `#a855f7`, `#f97316`, `#22c55e`][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatMsToHhMm} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                <Tag className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-widest">No Categories</span>
              </div>
            )}
            <div className="mt-6 space-y-2">
              {categoryData.map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-bold uppercase">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: [`#3b82f6`, `#a855f7`, `#f97316`, `#22c55e`][i % 4] }} />
                    {cat.name}
                  </span>
                  <span className="text-muted-foreground">{formatMsToHhMm(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}