import { useState, useEffect, useCallback } from 'react'

export interface Settings {
  dailyGoalMs: number
  dailyGoalByDayMs: number[]
  pomodoroDurationMs: number
  breakDurationMs: number
  idleDetectionEnabled: boolean
  idleThresholdMs: number
  autoPauseEnabled: boolean
  soundVolume: number
  categories: string[]
}

const DEFAULT_SETTINGS: Settings = {
  dailyGoalMs: 4 * 60 * 60 * 1000, // 4 hours
  dailyGoalByDayMs: Array(7).fill(4 * 60 * 60 * 1000),
  pomodoroDurationMs: 25 * 60 * 1000, // 25 minutes
  breakDurationMs: 5 * 60 * 1000, // 5 minutes
  idleDetectionEnabled: true,
  idleThresholdMs: 5 * 60 * 1000, // 5 minutes
  autoPauseEnabled: false,
  soundVolume: 0.5,
  categories: ["Study", "Work", "Hobby", "Exercise"],
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
    const savedIdleDetection = localStorage.getItem('wyd-idle-detection-enabled')
    const savedIdleThreshold = localStorage.getItem('wyd-idle-threshold-ms')
    const savedAutoPause = localStorage.getItem('wyd-auto-pause-enabled')
    const savedVolume = localStorage.getItem('wyd-sound-volume')
    const savedCategories = localStorage.getItem('wyd-categories')

    const validateNum = (val: string | null, def: number, min?: number, max?: number) => {
      const n = val !== null ? Number(val) : def
      if (!Number.isFinite(n)) return def
      if (min !== undefined && n < min) return def
      if (max !== undefined && n > max) return def
      return n
    }

    const parsedDefaultGoal = validateNum(savedGoal, DEFAULT_SETTINGS.dailyGoalMs, 0)
    let parsedGoalsByDay = Array(7).fill(parsedDefaultGoal)

    if (savedGoalsByDay) {
      try {
        const parsed = JSON.parse(savedGoalsByDay)
        if (Array.isArray(parsed) && parsed.length === 7 && parsed.every((v) => Number.isFinite(v) && v > 0)) {
          parsedGoalsByDay = parsed
        }
      } catch { /* ignore */ }
    }

    let parsedCategories = DEFAULT_SETTINGS.categories
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories)
        if (Array.isArray(parsed)) parsedCategories = parsed
      } catch { /* ignore */ }
    }

    setSettings({
      dailyGoalMs: parsedDefaultGoal,
      dailyGoalByDayMs: parsedGoalsByDay,
      pomodoroDurationMs: validateNum(savedPomodoro, DEFAULT_SETTINGS.pomodoroDurationMs, 1),
      breakDurationMs: validateNum(savedBreak, DEFAULT_SETTINGS.breakDurationMs, 1),
      idleDetectionEnabled: savedIdleDetection !== null ? savedIdleDetection === 'true' : DEFAULT_SETTINGS.idleDetectionEnabled,
      idleThresholdMs: validateNum(savedIdleThreshold, DEFAULT_SETTINGS.idleThresholdMs, 0),
      autoPauseEnabled: savedAutoPause !== null ? savedAutoPause === 'true' : DEFAULT_SETTINGS.autoPauseEnabled,
      soundVolume: validateNum(savedVolume, DEFAULT_SETTINGS.soundVolume, 0, 1),
      categories: parsedCategories,
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

  const updateIdleDetection = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, idleDetectionEnabled: enabled }))
    localStorage.setItem('wyd-idle-detection-enabled', enabled.toString())
  }, [])

  const updateIdleThreshold = useCallback((ms: number) => {
    const sanitized = Number.isFinite(ms) ? Math.max(0, ms) : DEFAULT_SETTINGS.idleThresholdMs
    setSettings(prev => ({ ...prev, idleThresholdMs: sanitized }))
    localStorage.setItem('wyd-idle-threshold-ms', sanitized.toString())
  }, [])

  const updateAutoPause = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, autoPauseEnabled: enabled }))
    localStorage.setItem('wyd-auto-pause-enabled', enabled.toString())
  }, [])

  const updateSoundVolume = useCallback((volume: number) => {
    const sanitized = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : DEFAULT_SETTINGS.soundVolume
    setSettings(prev => ({ ...prev, soundVolume: sanitized }))
    localStorage.setItem('wyd-sound-volume', sanitized.toString())
  }, [])

  const updateCategories = useCallback((categories: string[]) => {
    setSettings(prev => ({ ...prev, categories }))
    localStorage.setItem('wyd-categories', JSON.stringify(categories))
  }, [])

  return {
    settings,
    isLoaded,
    updateDailyGoal,
    updateDailyGoalByDay,
    updatePomodoroDuration,
    updateBreakDuration,
    updateIdleDetection,
    updateIdleThreshold,
    updateAutoPause,
    updateSoundVolume,
    updateCategories,
    getTargetStudyTimeMs,
  }
}
