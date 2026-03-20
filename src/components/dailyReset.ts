/**
 * dailyReset.ts
 *
 * Call `applyDailyReset(subjects)` when loading subjects from storage.
 * If the data was last saved on a previous calendar day, this will:
 *   1. Stop any running timers.
 *   2. Save their elapsed time as a completed session on the day they started.
 *   3. Zero out `accumulatedTime` so the timer starts fresh for today.
 *
 * The function is pure — it returns a new array and a boolean indicating
 * whether any reset actually happened (so the caller can persist the result).
 */

import type { SubjectData, StudySession } from './SubjectItem'

const LAST_SAVE_KEY = 'wyd-last-save-date'

/** Returns "YYYY-MM-DD" for a given timestamp (or now). */
function dateKey(timestampMs = Date.now()): string {
  const d = new Date(timestampMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface ResetResult {
  subjects: SubjectData[]
  /** True when at least one subject was reset. Persist subjects if true. */
  didReset: boolean
}

export function applyDailyReset(subjects: SubjectData[]): ResetResult {
  const todayKey = dateKey()
  const lastSaveDate = localStorage.getItem(LAST_SAVE_KEY)

  // Update the stored date to today on every call.
  localStorage.setItem(LAST_SAVE_KEY, todayKey)

  // If we've already saved today, nothing to reset.
  if (lastSaveDate === todayKey) {
    return { subjects, didReset: false }
  }

  // It's a new day (or first ever load). Reset each subject.
  let didReset = false

  const updated = subjects.map((subject): SubjectData => {
    const needsReset = subject.accumulatedTime > 0 || subject.isRunning

    if (!needsReset) return subject

    didReset = true

    // Calculate the final elapsed time, including any still-running segment.
    const now = Date.now()
    const elapsed =
      subject.isRunning && subject.startTime !== null
        ? subject.accumulatedTime + (now - subject.startTime)
        : subject.accumulatedTime

    // Build a session record for yesterday's (or whenever) work.
    const sessionDate = subject.startTime ? dateKey(subject.startTime) : (lastSaveDate ?? dateKey(now - 86_400_000))
    const endedAtMs = subject.isRunning && subject.startTime !== null ? now : undefined

    const newSession: StudySession | null =
      elapsed > 0
        ? {
            date: sessionDate,
            durationMs: elapsed,
            startedAtIso: subject.startTime
              ? new Date(subject.startTime).toISOString()
              : undefined,
            endedAtIso: endedAtMs ? new Date(endedAtMs).toISOString() : undefined,
          }
        : null

    const updatedSessions = [
      ...(subject.sessions ?? []),
      ...(newSession ? [newSession] : []),
    ]

    return {
      ...subject,
      accumulatedTime: 0,
      isRunning: false,
      startTime: null,
      sessions: updatedSessions,
    }
  })

  return { subjects: updated, didReset }
}

/**
 * Call this from your App's midnight-rollover effect so a long-running
 * session that crosses midnight is captured without needing an app restart.
 *
 * Usage in App.tsx:
 *   useMidnightReset(subjects, setSubjects, persistSubjects)
 */
export function useMidnightReset(
  subjects: SubjectData[],
  setSubjects: (s: SubjectData[]) => void,
  persist: (s: SubjectData[]) => void,
) {
  // We import useEffect lazily so this file stays importable in non-React contexts.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useEffect } = require('react')

  useEffect(() => {
    /** Milliseconds until the next local midnight. */
    function msUntilMidnight(): number {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0) // next midnight
      return midnight.getTime() - now.getTime()
    }

    let timeout: ReturnType<typeof setTimeout>

    function scheduleReset() {
      timeout = setTimeout(() => {
        // Force last-save-date to yesterday so applyDailyReset triggers.
        const yesterday = dateKey(Date.now() - 86_400_000)
        localStorage.setItem(LAST_SAVE_KEY, yesterday)

        const { subjects: reset, didReset } = applyDailyReset(subjects)
        if (didReset) {
          setSubjects(reset)
          persist(reset)
        }

        // Schedule the next midnight reset.
        scheduleReset()
      }, msUntilMidnight() + 500) // +500 ms buffer past midnight
    }

    scheduleReset()
    return () => clearTimeout(timeout)
  // Re-schedule whenever subjects change so we always have the latest state.
  }, [subjects, setSubjects, persist])
}
