import { useState, useEffect, useCallback } from 'react'

export interface Settings {
  dailyGoalMs: number
  pomodoroDurationMs: number
  breakDurationMs: number
}

const DEFAULT_SETTINGS: Settings = {
  dailyGoalMs: 4 * 60 * 60 * 1000, // 4 hours
  pomodoroDurationMs: 25 * 60 * 1000, // 25 minutes
  breakDurationMs: 5 * 60 * 1000, // 5 minutes
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedGoal = localStorage.getItem('wyd-daily-goal')
    const savedPomodoro = localStorage.getItem('wyd-pomodoro-duration-ms')
    const savedBreak = localStorage.getItem('wyd-break-duration-ms')

    setSettings({
      dailyGoalMs: savedGoal ? Number(savedGoal) : DEFAULT_SETTINGS.dailyGoalMs,
      pomodoroDurationMs: savedPomodoro ? Number(savedPomodoro) : DEFAULT_SETTINGS.pomodoroDurationMs,
      breakDurationMs: savedBreak ? Number(savedBreak) : DEFAULT_SETTINGS.breakDurationMs,
    })
    setIsLoaded(true)
  }, [])

  const updateDailyGoal = useCallback((ms: number) => {
    setSettings(prev => ({ ...prev, dailyGoalMs: ms }))
    localStorage.setItem('wyd-daily-goal', ms.toString())
  }, [])

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
    updatePomodoroDuration,
    updateBreakDuration,
  }
}
