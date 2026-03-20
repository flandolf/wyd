import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { SubjectData, StudySession } from '../components/SubjectItem'

function localDateKeyFromMs(ms: number): string {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function completeRunningSession(sw: SubjectData, now: number): SubjectData {
  const addedTime = sw.startTime ? now - sw.startTime : 0
  const currentSessions = sw.sessions || []
  const sessionStartMs = sw.startTime ?? now
  const endedAtIso = new Date(now).toISOString()
  const startedAtIso = new Date(sessionStartMs).toISOString()
  const date = localDateKeyFromMs(sessionStartMs)

  const newSessions: StudySession[] = [
    ...currentSessions,
    {
      date,
      durationMs: addedTime,
      startedAtIso,
      endedAtIso,
    },
  ]

  return {
    ...sw,
    isRunning: false,
    startTime: null,
    accumulatedTime: sw.accumulatedTime + addedTime,
    sessions: newSessions,
  }
}

function normalizeSubjects(data: SubjectData[]): SubjectData[] {
  return data.map((sw, index) => ({
    ...sw,
    order: sw.order ?? index,
    sessions: (sw.sessions || []).map((session) => {
      if (session.startedAtIso && session.endedAtIso) return session

      const fallbackStart = new Date(`${session.date}T00:00:00.000Z`).toISOString()
      const fallbackEnd = new Date(new Date(fallbackStart).getTime() + Math.max(0, session.durationMs)).toISOString()

      return {
        ...session,
        startedAtIso: session.startedAtIso || fallbackStart,
        endedAtIso: session.endedAtIso || fallbackEnd,
      }
    }),
  }))
}

export interface ActiveBreak {
  subjectId: string
  endsAt: number
}

export function useSubjects(breakDurationMs: number) {
  const [subjects, setSubjects] = useState<SubjectData[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isStudySessionActive, setIsStudySessionActive] = useState(false)
  const [restStartTime, setRestStartTime] = useState<number | null>(null)
  const [activeBreak, setActiveBreak] = useState<ActiveBreak | null>(null)

  // Load subjects on mount
  useEffect(() => {
    invoke<SubjectData[]>('load_data').then(saved => {
      let loadedData: SubjectData[] = []
      if (saved && saved.length > 0) {
        loadedData = saved
      } else {
        const lsSaved = localStorage.getItem('wyd-subjects')
        if (lsSaved) loadedData = JSON.parse(lsSaved)
      }

      const todayDate = localDateKeyFromMs(Date.now())
      const lastActiveDate = localStorage.getItem('wyd-last-active-date')
      const savedSessionActive = localStorage.getItem('wyd-study-session-active')
      const sessionActive = savedSessionActive === 'true'

      loadedData = normalizeSubjects(loadedData)

      // Reset daily accumulatedTime on new day, archiving any unfinished work as a session
      if (lastActiveDate && lastActiveDate !== todayDate) {
        const resetAt = Date.now()
        loadedData = loadedData.map((sw: SubjectData) => {
          // 1. Capture any still-running time into a session
          let archived = sw.isRunning ? completeRunningSession(sw, resetAt) : sw

          // 2. If there's accumulated time with no matching session yet, archive it
          const hasUnarchivedTime = archived.accumulatedTime > 0 && (() => {
            const sessionTotal = (archived.sessions || [])
              .filter(s => {
                const d = s.startedAtIso
                  ? localDateKeyFromMs(new Date(s.startedAtIso).getTime())
                  : s.date
                return d === lastActiveDate
              })
              .reduce((sum, s) => sum + s.durationMs, 0)
            return sessionTotal < archived.accumulatedTime
          })()

          if (hasUnarchivedTime) {
            const unarchived = archived.accumulatedTime -
              (archived.sessions || [])
                .filter(s => {
                  const d = s.startedAtIso
                    ? localDateKeyFromMs(new Date(s.startedAtIso).getTime())
                    : s.date
                  return d === lastActiveDate
                })
                .reduce((sum, s) => sum + s.durationMs, 0)

            if (unarchived > 0) {
              const session: StudySession = {
                date: lastActiveDate,
                durationMs: unarchived,
                startedAtIso: new Date(resetAt - unarchived).toISOString(),
                endedAtIso: new Date(resetAt).toISOString(),
              }
              archived = { ...archived, sessions: [...(archived.sessions || []), session] }
            }
          }

          // 3. Zero out today's timer
          return {
            ...archived,
            accumulatedTime: 0,
            isRunning: false,
            startTime: null,
            isCompleted: false,
          }
        })
      }

      localStorage.setItem('wyd-last-active-date', todayDate)
      setIsStudySessionActive(sessionActive)
      setSubjects(loadedData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setIsLoaded(true)

      // Restore break timer
      const savedBreak = localStorage.getItem('wyd-active-break')
      if (savedBreak) {
        try {
          const parsed = JSON.parse(savedBreak) as ActiveBreak
          if (parsed.endsAt > Date.now()) {
            setActiveBreak(parsed)
          } else {
            localStorage.removeItem('wyd-active-break')
          }
        } catch {
          localStorage.removeItem('wyd-active-break')
        }
      }

      const isAnyRunning = loadedData.some((sw: SubjectData) => sw.isRunning)
      if (sessionActive && !isAnyRunning) {
        const savedRestStart = localStorage.getItem('wyd-rest-start')
        if (savedRestStart) setRestStartTime(Number(savedRestStart))
        else {
          setRestStartTime(Date.now())
          localStorage.setItem('wyd-rest-start', Date.now().toString())
        }
      } else {
        setRestStartTime(null)
        localStorage.removeItem('wyd-rest-start')
      }
    })
  }, [])

  // Save subjects when they change
  useEffect(() => {
    if (isLoaded) {
      invoke('save_data', { data: subjects })
      localStorage.setItem('wyd-subjects', JSON.stringify(subjects))
      localStorage.setItem('wyd-last-active-date', localDateKeyFromMs(Date.now()))
      localStorage.setItem('wyd-study-session-active', isStudySessionActive ? 'true' : 'false')
      window.dispatchEvent(new Event('wyd:data-updated'))
    }
  }, [subjects, isLoaded, isStudySessionActive])

  // Persist active break
  useEffect(() => {
    if (activeBreak) {
      localStorage.setItem('wyd-active-break', JSON.stringify(activeBreak))
    } else {
      localStorage.removeItem('wyd-active-break')
    }
  }, [activeBreak])

  // Automatic daily reset at midnight
  useEffect(() => {
    if (!isLoaded) return

    const scheduleMidnightReset = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()

      return setTimeout(() => {
        const todayDate = localDateKeyFromMs(Date.now())
        const lastActiveDate = localStorage.getItem('wyd-last-active-date')

        if (lastActiveDate !== todayDate) {
          setSubjects(prev => {
            const now = Date.now()
            return prev.map(sw => {
              // 1. Complete any running session
              let archived = sw.isRunning ? completeRunningSession(sw, now) : sw

              // 2. Archive any accumulated time not yet in a session for lastActiveDate
              if (archived.accumulatedTime > 0 && lastActiveDate) {
                const sessionTotal = (archived.sessions || [])
                  .filter(s => {
                    const d = s.startedAtIso
                      ? localDateKeyFromMs(new Date(s.startedAtIso).getTime())
                      : s.date
                    return d === lastActiveDate
                  })
                  .reduce((sum, s) => sum + s.durationMs, 0)

                const unarchived = archived.accumulatedTime - sessionTotal
                if (unarchived > 0) {
                  const session: StudySession = {
                    date: lastActiveDate,
                    durationMs: unarchived,
                    startedAtIso: new Date(now - unarchived).toISOString(),
                    endedAtIso: new Date(now).toISOString(),
                  }
                  archived = { ...archived, sessions: [...(archived.sessions || []), session] }
                }
              }

              // 3. Zero out the daily timer
              return {
                ...archived,
                accumulatedTime: 0,
                isRunning: false,
                startTime: null,
                isCompleted: false,
              }
            })
          })
          localStorage.setItem('wyd-last-active-date', todayDate)
          setRestStartTime(null)
          localStorage.removeItem('wyd-rest-start')
          setActiveBreak(null)
        }

        // Schedule next midnight reset
        timeoutRef = scheduleMidnightReset()
      }, msUntilMidnight)
    }

    let timeoutRef = scheduleMidnightReset()

    return () => clearTimeout(timeoutRef)
  }, [isLoaded])

  const isTimerRunning = subjects.some(sw => sw.isRunning)

  const handleRemoteUpdate = useCallback((data: SubjectData[]) => {
    setSubjects(normalizeSubjects(data).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
  }, [])

  const addSubject = useCallback((title: string, color: string) => {
    if (!title.trim()) return

    const newSubject: SubjectData = {
      id: crypto.randomUUID(),
      title: title.trim(),
      startTime: null,
      accumulatedTime: 0,
      isRunning: false,
      color,
      order: subjects.length,
    }

    setSubjects(prev => [...prev, newSubject])
  }, [subjects.length])

  const toggleSubject = useCallback((id: string) => {
    setSubjects(prev => {
      const targetRunning = prev.find(s => s.id === id)?.isRunning
      if (targetRunning === undefined) return prev

      const now = Date.now()

      return prev.map(sw => {
        if (sw.id === id) {
          if (sw.isRunning) {
            if (isStudySessionActive) {
              setRestStartTime(now)
              localStorage.setItem('wyd-rest-start', now.toString())
            } else {
              setRestStartTime(null)
              localStorage.removeItem('wyd-rest-start')
            }
            return completeRunningSession(sw, now)
          } else {
            if (!isStudySessionActive) {
              setIsStudySessionActive(true)
              localStorage.setItem('wyd-study-session-active', 'true')
            }
            setRestStartTime(null)
            localStorage.removeItem('wyd-rest-start')
            setActiveBreak(null)
            return {
              ...sw,
              isRunning: true,
              startTime: now,
              isCompleted: false
            }
          }
        } else {
          if (!targetRunning && sw.isRunning) {
            setRestStartTime(null)
            localStorage.removeItem('wyd-rest-start')
            return completeRunningSession(sw, now)
          }
          return sw
        }
      })
    })
  }, [isStudySessionActive])

  const resetSubject = useCallback((id: string) => {
    const todayDate = localDateKeyFromMs(Date.now())
    setSubjects(prev => prev.map(sw => {
      if (sw.id !== id) return sw
      return {
        ...sw,
        isRunning: false,
        startTime: null,
        accumulatedTime: 0,
        sessions: (sw.sessions || []).filter(s => {
          const sessionDate = s.startedAtIso
            ? localDateKeyFromMs(new Date(s.startedAtIso).getTime())
            : s.date
          return sessionDate !== todayDate
        })
      }
    }))
  }, [])

  const resetAllSubjects = useCallback(() => {
    const todayDate = localDateKeyFromMs(Date.now())
    setSubjects(prev => prev.map(sw => {
      // Filter out today's sessions for this subject
      const remainingSessions = (sw.sessions || []).filter(s => {
        const sessionDate = s.startedAtIso
          ? localDateKeyFromMs(new Date(s.startedAtIso).getTime())
          : s.date
        return sessionDate !== todayDate
      })

      // Reset all activity state
      return {
        ...sw,
        isRunning: false,
        startTime: null,
        accumulatedTime: 0,
        isCompleted: false, // Reset completion status too
        sessions: remainingSessions
      }
    }))
    
    // Also reset global session state
    setIsStudySessionActive(false)
    localStorage.setItem('wyd-study-session-active', 'false')
    setRestStartTime(null)
    localStorage.removeItem('wyd-rest-start')
    setActiveBreak(null)
    localStorage.removeItem('wyd-active-break')
  }, [])

  const deleteSubject = useCallback((id: string) => {
    setSubjects(prev => prev.filter(sw => sw.id !== id))
  }, [])

  const updateSubject = useCallback((id: string, updates: Partial<SubjectData>) => {
    setSubjects(prev => prev.map(sw =>
      sw.id === id ? { ...sw, ...updates } : sw
    ))
  }, [])

  const setSubjectTime = useCallback((id: string, totalMs: number) => {
    const now = Date.now()
    const todayDate = localDateKeyFromMs(now)

    setSubjects(prev => prev.map(sw => {
      if (sw.id !== id) return sw

      const pastSessions = (sw.sessions || []).filter(s => {
        const sessionDate = s.startedAtIso
          ? localDateKeyFromMs(new Date(s.startedAtIso).getTime())
          : s.date
        return sessionDate !== todayDate
      })

      const newSessions: StudySession[] = totalMs > 0 ? [
        ...pastSessions,
        {
          date: todayDate,
          durationMs: totalMs,
          startedAtIso: new Date(now - totalMs).toISOString(),
          endedAtIso: new Date(now).toISOString(),
        }
      ] : pastSessions

      return {
        ...sw,
        accumulatedTime: totalMs,
        sessions: newSessions
      }
    }))
  }, [])

  const togglePomodoro = useCallback((id: string) => {
    setSubjects(prev => prev.map(sw =>
      sw.id === id ? { ...sw, isPomodoro: !sw.isPomodoro } : sw
    ))
  }, [])

  const toggleComplete = useCallback((id: string) => {
    const now = Date.now()
    setSubjects(prev => prev.map(sw => {
      if (sw.id !== id) return sw
      if (sw.isRunning) {
        // Stop the timer and mark complete in one atomic update
        const stopped = completeRunningSession(sw, now)
        return { ...stopped, isCompleted: true }
      }
      return { ...sw, isCompleted: !sw.isCompleted }
    }))
  }, [])

  const handlePomodoroComplete = useCallback((id: string) => {
    const now = Date.now()
    setSubjects(prev => prev.map(sw => {
      if (sw.id !== id || !sw.isRunning) return sw
      return completeRunningSession(sw, now)
    }))
    setRestStartTime(null)
    localStorage.removeItem('wyd-rest-start')
    setActiveBreak({ subjectId: id, endsAt: now + breakDurationMs })
  }, [breakDurationMs])

  const moveSubject = useCallback((id: string, direction: 'up' | 'down') => {
    setSubjects(prev => {
      const clone = [...prev]
      const index = clone.findIndex(sw => sw.id === id)
      
      if (index === -1) return prev
      if (direction === 'up' && index === 0) return prev
      if (direction === 'down' && index === clone.length - 1) return prev

      const swapIndex = direction === 'up' ? index - 1 : index + 1
      const temp = clone[index]
      clone[index] = clone[swapIndex]
      clone[swapIndex] = temp

      // Update order field for all items
      return clone.map((sw, i) => ({ ...sw, order: i }))
    })
  }, [])

  const startStudySession = useCallback(() => {
    if (isStudySessionActive) return
    setIsStudySessionActive(true)
    localStorage.setItem('wyd-study-session-active', 'true')
    if (!isTimerRunning) {
      const now = Date.now()
      setRestStartTime(now)
      localStorage.setItem('wyd-rest-start', now.toString())
    }
  }, [isStudySessionActive, isTimerRunning])

  const stopStudySession = useCallback(() => {
    const now = Date.now()
    setSubjects(prev => prev.map(sw => {
      if (!sw.isRunning) return sw
      return completeRunningSession(sw, now)
    }))
    setIsStudySessionActive(false)
    localStorage.setItem('wyd-study-session-active', 'false')
    setActiveBreak(null)
    setRestStartTime(null)
    localStorage.removeItem('wyd-rest-start')
  }, [])

  // Handle break ending
  const checkBreakEnded = useCallback((currentTimeMs: number) => {
    if (!activeBreak) return
    if (currentTimeMs < activeBreak.endsAt) return

    const resumedAt = Date.now()
    setSubjects(prev => prev.map(sw => {
      if (sw.id !== activeBreak.subjectId || sw.isRunning) return sw
      return {
        ...sw,
        isRunning: true,
        startTime: resumedAt,
        isCompleted: false,
      }
    }))
    setActiveBreak(null)
  }, [activeBreak])

  return {
    subjects,
    isLoaded,
    isTimerRunning,
    isStudySessionActive,
    restStartTime,
    activeBreak,
    handleRemoteUpdate,
    addSubject,
    toggleSubject,
    resetSubject,
    resetAllSubjects,
    deleteSubject,
    updateSubject,
    setSubjectTime,
    togglePomodoro,
    toggleComplete,
    handlePomodoroComplete,
    moveSubject,
    startStudySession,
    stopStudySession,
    checkBreakEnded,
  }
}
