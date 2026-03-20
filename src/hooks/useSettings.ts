import { useState, useEffect, useCallback } from 'react'

export interface Settings {
  dailyGoalMs: number
  dailyGoalByDayMs: number[]
  pomodoroDurationMs: number
  breakDurationMs: number
}

const DEFAULT_SETTINGS: Settings = {
  dailyGoalMs: 4 * 60 * 60 * 1000, // 4 hours
  dailyGoalByDayMs: Array(7).fill(4 * 60 * 60 * 1000),
  pomodoroDurationMs: 25 * 60 * 1000, // 25 minutes
  breakDurationMs: 5 * 60 * 1000, // 5 minutes
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedGoal = localStorage.getItem('wyd-daily-goal')
    const savedGoalsByDay = localStorage.getItem('wyd-daily-goal-by-day-ms')
    const savedPomodoro = localStorage.getItem('wyd-pomodoro-duration-ms')
    const savedBreak = localStorage.getItem('wyd-break-duration-ms')

    const parsedDefaultGoal = savedGoal ? Number(savedGoal) : DEFAULT_SETTINGS.dailyGoalMs
    let parsedGoalsByDay = Array(7).fill(parsedDefaultGoal)

    if (savedGoalsByDay) {
      try {
        const parsed = JSON.parse(savedGoalsByDay) as number[]
        if (Array.isArray(parsed) && parsed.length === 7 && parsed.every((value) => Number.isFinite(value) && value > 0)) {
          parsedGoalsByDay = parsed
        }
      } catch {
        parsedGoalsByDay = Array(7).fill(parsedDefaultGoal)
      }
    }

    setSettings({
      dailyGoalMs: parsedDefaultGoal,
      dailyGoalByDayMs: parsedGoalsByDay,
      pomodoroDurationMs: savedPomodoro ? Number(savedPomodoro) : DEFAULT_SETTINGS.pomodoroDurationMs,
      breakDurationMs: savedBreak ? Number(savedBreak) : DEFAULT_SETTINGS.breakDurationMs,
    })
    setIsLoaded(true)
  }, [])

  const updateDailyGoal = useCallback((ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return
    setSettings(prev => ({ ...prev, dailyGoalMs: ms, dailyGoalByDayMs: Array(7).fill(ms) }))
    localStorage.setItem('wyd-daily-goal', ms.toString())
    localStorage.setItem('wyd-daily-goal-by-day-ms', JSON.stringify(Array(7).fill(ms)))
  }, [])

  const updateDailyGoalByDay = useCallback((dayIndex: number, ms: number) => {
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return
    if (!Number.isFinite(ms) || ms <= 0) return

    setSettings(prev => {
      const nextGoalsByDay = [...prev.dailyGoalByDayMs]
      nextGoalsByDay[dayIndex] = ms
      localStorage.setItem('wyd-daily-goal-by-day-ms', JSON.stringify(nextGoalsByDay))
      return {
        ...prev,
        dailyGoalByDayMs: nextGoalsByDay,
      }
    })
  }, [])

  const getTargetStudyTimeMs = useCallback((date: Date = new Date()) => {
    const dayIndex = date.getDay()
    return settings.dailyGoalByDayMs[dayIndex] ?? settings.dailyGoalMs
  }, [settings.dailyGoalByDayMs, settings.dailyGoalMs])

  const updatePomodoroDuration = useCallback((ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return
    setSettings(prev => ({ ...prev, pomodoroDurationMs: ms }))
    localStorage.setItem('wyd-pomodoro-duration-ms', ms.toString())
  }, [])

  const updateBreakDuration = useCallback((ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return
    setSettings(prev => ({ ...prev, breakDurationMs: ms }))
    localStorage.setItem('wyd-break-duration-ms', ms.toString())
  }, [])

  return {
    settings,
    isLoaded,
    updateDailyGoal,
    updateDailyGoalByDay,
    updatePomodoroDuration,
    updateBreakDuration,
    getTargetStudyTimeMs,
  }
}
