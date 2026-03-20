import { useState, useEffect, useMemo, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Plus, BarChart3, Settings, BookOpen, Cloud, CloudOff, AlertCircle, RefreshCw, RotateCcw } from "lucide-react"
import { SubjectItem, type SubjectData } from "./components/SubjectItem"
import { useAuth } from "./components/AuthProvider"
import { useFirebaseSync } from "./hooks/useFirebaseSync"
import { useSubjects } from "./hooks/useSubjects"
import { useSettings } from "./hooks/useSettings"
import { SettingsModal } from "./components/SettingsModal"
import { ThemeToggle } from "./components/ThemeToggle"
import { toast } from "sonner"

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#0ea5e9', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
]

function App(): React.JSX.Element {
  const [newTitle, setNewTitle] = useState("")
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[3])
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now())
  const [showSettings, setShowSettings] = useState(false)

  const { user, signInEmail, signUpEmail, logOut } = useAuth()
  const {
    settings,
    isLoaded: settingsLoaded,
    updateDailyGoal,
    updateDailyGoalByDay,
    updatePomodoroDuration,
    updateBreakDuration,
    getTargetStudyTimeMs,
  } = useSettings()

  const {
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
  } = useSubjects(settings.breakDurationMs)

  const { syncState, syncError, retrySync } = useFirebaseSync(user, subjects, isLoaded, handleRemoteUpdate)

  // Animation frame for live timer display
  useEffect(() => {
    if (!isTimerRunning && !restStartTime && !activeBreak) {
      setCurrentTimeMs(Date.now())
      return
    }

    let animationFrameId: number
    const updateTime = () => {
      setCurrentTimeMs(Date.now())
      animationFrameId = requestAnimationFrame(updateTime)
    }

    updateTime()
    return () => cancelAnimationFrame(animationFrameId)
  }, [isTimerRunning, restStartTime, activeBreak])

  // Check if break has ended
  useEffect(() => {
    checkBreakEnded(currentTimeMs)
  }, [activeBreak, currentTimeMs, checkBreakEnded])

  // Calculate time breakdown for progress bar
  const breakdown = useMemo(() => {
    return subjects.map(sw => {
      const current = sw.accumulatedTime + (sw.isRunning && sw.startTime ? currentTimeMs - sw.startTime : 0)
      return { ...sw, current }
    }).filter(sw => sw.current > 0).sort((a, b) => b.current - a.current)
  }, [subjects, currentTimeMs])

  const totalTime = useMemo(() => breakdown.reduce((acc, sw) => acc + sw.current, 0), [breakdown])
  const targetDailyGoalMs = getTargetStudyTimeMs(new Date(currentTimeMs))

  const formatTotalTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    addSubject(newTitle, selectedColor)
    setNewTitle("")
    toast.success(`Added "${newTitle.trim()}"`)
  }

  const handleImport = useCallback((importedData: SubjectData[]) => {
    // Merge imported data with existing
    importedData.forEach(importedItem => {
      const existsLocally = subjects.find(sw => sw.id === importedItem.id)
      if (!existsLocally) {
        addSubject(importedItem.title, importedItem.color || '#22c55e')
      }
    })
  }, [subjects, addSubject])

  const handleResetAll = () => {
    if (window.confirm("Are you sure you want to reset all progress for today? This cannot be undone.")) {
      resetAllSubjects()
      toast.info("All daily progress has been reset")
    }
  }

  if (!isLoaded || !settingsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground opacity-50 space-y-2">
        <div className="relative">
          <BookOpen className="w-8 h-8" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
        </div>
        <p className="text-xs font-medium">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-3 h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="mb-3 space-y-2 shrink-0">
        <div className="flex justify-between items-start">
          {/* Left: Session controls */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 group">
              <div className="text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-widest leading-none">
                Studied Today
              </div>
              <button
                onClick={handleResetAll}
                className="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-muted"
                title="Reset all progress for today"
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={isStudySessionActive ? 'secondary' : 'outline'}
                size="sm"
                className="h-6 px-2.5 text-[10px]"
                onClick={startStudySession}
                disabled={isStudySessionActive}
              >
                Start Session
              </Button>
              <Button
                variant={isStudySessionActive ? 'outline' : 'ghost'}
                size="sm"
                className="h-6 px-2.5 text-[10px]"
                onClick={stopStudySession}
                disabled={!isStudySessionActive && !isTimerRunning}
              >
                Stop Session
              </Button>
            </div>
            {activeBreak && (
              <div className="text-[10px] text-blue-500 font-medium leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Break: {formatTotalTime(Math.max(0, activeBreak.endsAt - currentTimeMs))}
              </div>
            )}
            {!activeBreak && restStartTime && !isTimerRunning && (
              <div className="text-[10px] text-amber-500 font-medium leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Resting: {formatTotalTime(currentTimeMs - restStartTime)}
              </div>
            )}
          </div>

          {/* Right: Actions & total time */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => invoke('open_stats')}
              title="Stats"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>

            {/* Sync status indicator */}
            {user && (
              <div className="flex items-center">
                {syncState === 'offline' && <span title="Offline"><CloudOff className="h-3.5 w-3.5 text-muted-foreground" /></span>}
                {syncState === 'syncing' && <span title="Syncing"><RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" /></span>}
                {syncState === 'synced' && <span title="Synced"><Cloud className="h-3.5 w-3.5 text-emerald-500" /></span>}
                {syncState === 'error' && (
                  <button onClick={retrySync} title={syncError || 'Sync failed - click to retry'}>
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>
            )}

            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>

            <div className="flex flex-col items-end ml-1">
              <div className="text-sm font-bold tabular-nums tracking-wide leading-none">
                {formatTotalTime(totalTime)}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                / {formatTotalTime(targetDailyGoalMs)}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1 w-full">
          <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-muted/40 border border-muted/60">
            {breakdown.length > 0 ? breakdown.map(sw => (
              <div
                key={sw.id}
                className="transition-all duration-300 ease-linear first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(sw.current / Math.max(totalTime, targetDailyGoalMs)) * 100}%`,
                  backgroundColor: sw.color || '#22c55e'
                }}
                title={`${sw.title}: ${formatTotalTime(sw.current)}`}
              />
            )) : (
              <div className="w-0 transition-all duration-300" />
            )}
          </div>
          {totalTime > targetDailyGoalMs && (
            <div className="text-[10px] text-primary self-end font-medium animate-in fade-in slide-in-from-right-2">
              Goal Reached! 🎉
            </div>
          )}
        </div>
      </div>

      {/* Subject list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1">
        {subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
            <BookOpen className="w-8 h-8" />
            <div className="text-center">
              <p className="text-xs font-medium">No subjects yet</p>
              <p className="text-[10px] mt-0.5">Add one below to start tracking</p>
            </div>
          </div>
        ) : (
          <div className="stagger-list space-y-2">
            {subjects.map((sw, index) => (
              <SubjectItem
                key={sw.id}
                subject={sw}
                pomodoroDurationMs={settings.pomodoroDurationMs}
                onToggle={toggleSubject}
                onPomodoroComplete={handlePomodoroComplete}
                onReset={resetSubject}
                onDelete={deleteSubject}
                onSetTime={setSubjectTime}
                onTogglePomodoro={togglePomodoro}
                onToggleComplete={toggleComplete}
                onUpdateSubject={updateSubject}
                onMoveUp={moveSubject ? (id) => moveSubject(id, 'up') : undefined}
                onMoveDown={moveSubject ? (id) => moveSubject(id, 'down') : undefined}
                isFirst={index === 0}
                isLast={index === subjects.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add subject form */}
      <div className="mt-3 pt-3 border-t bg-background shrink-0 z-10 flex flex-col gap-2.5">
        <form onSubmit={handleAddSubject} className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New subject..."
            className="h-8 text-sm px-3 focus-visible:ring-1"
            autoFocus={subjects.length === 0}
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            variant="secondary"
            disabled={!newTitle.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        <div className="flex items-center justify-between px-1 pb-0.5">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                selectedColor === color
                  ? 'ring-2 ring-primary/80 ring-offset-2 ring-offset-background scale-110 shadow-sm'
                  : 'opacity-50 hover:opacity-100 hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onUpdateDailyGoal={updateDailyGoal}
        onUpdateDailyGoalByDay={updateDailyGoalByDay}
        onUpdatePomodoroDuration={updatePomodoroDuration}
        onUpdateBreakDuration={updateBreakDuration}
        user={user}
        onSignIn={signInEmail}
        onSignUp={signUpEmail}
        onLogOut={logOut}
        syncState={syncState}
        syncError={syncError}
        onRetrySync={retrySync}
        subjects={subjects}
        onImport={handleImport}
      />
    </div>
  )
}

export default App

