import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Plus, Timer, BarChart3, Download, Upload, Settings, LogOut } from "lucide-react"
import { StopwatchItem, type StopwatchData } from "./components/StopwatchItem"
import { useAuth } from "./components/AuthProvider"
import { useFirebaseSync } from "./hooks/useFirebaseSync"

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
  const [stopwatches, setStopwatches] = useState<StopwatchData[]>([])
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[3])
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now())
  const [restStartTime, setRestStartTime] = useState<number | null>(null)
  const [dailyGoalMs, setDailyGoalMs] = useState(4 * 60 * 60 * 1000) // Default 4 hours
  const [showSettings, setShowSettings] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user, signInEmail, signUpEmail, logOut } = useAuth()
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleRemoteUpdate = useCallback((data: StopwatchData[]) => {
    setStopwatches(data)
  }, [])

  useFirebaseSync(user, stopwatches, isLoaded, handleRemoteUpdate)

  useEffect(() => {
    const savedGoal = localStorage.getItem('wyd-daily-goal')
    if (savedGoal) setDailyGoalMs(Number(savedGoal))

    invoke<StopwatchData[]>('load_data').then(saved => {
      let loadedData = []
      if (saved && saved.length > 0) {
        loadedData = saved
      } else {
        const lsSaved = localStorage.getItem('wyd-stopwatches')
        if (lsSaved) loadedData = JSON.parse(lsSaved)
      }

      const todayDate = new Date().toISOString().split('T')[0]
      const lastActiveDate = localStorage.getItem('wyd-last-active-date')

      if (lastActiveDate && lastActiveDate !== todayDate) {
        loadedData = loadedData.map((sw: StopwatchData) => ({
          ...sw,
          accumulatedTime: 0,
          isRunning: false,
          startTime: null,
          isCompleted: false
        }))
      }

      localStorage.setItem('wyd-last-active-date', todayDate)
      setStopwatches(loadedData)
      setIsLoaded(true)
      
      const isAnyRunning = loadedData.some((sw: StopwatchData) => sw.isRunning)
      if (!isAnyRunning) {
        const savedRestStart = localStorage.getItem('wyd-rest-start')
        if (savedRestStart) setRestStartTime(Number(savedRestStart))
        else {
          setRestStartTime(Date.now())
          localStorage.setItem('wyd-rest-start', Date.now().toString())
        }
      }
    })
  }, [])

  useEffect(() => {
    if (isLoaded) {
      invoke('save_data', { data: stopwatches })
      localStorage.setItem('wyd-stopwatches', JSON.stringify(stopwatches))
      localStorage.setItem('wyd-last-active-date', new Date().toISOString().split('T')[0])
    }
  }, [stopwatches, isLoaded])

  const exportToJson = () => {
    const dataStr = JSON.stringify(stopwatches, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wyd-stopwatches-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string) as StopwatchData[]
        if (Array.isArray(importedData)) {
          setStopwatches(prev => {
            const next = [...prev]
            importedData.forEach(importedItem => {
              const existingIndex = next.findIndex(sw => sw.id === importedItem.id)
              if (existingIndex >= 0) {
                next[existingIndex] = { ...next[existingIndex], ...importedItem }
              } else {
                next.push(importedItem)
              }
            })
            return next
          })
        }
      } catch (err) {
        console.error("Failed to parse imported JSON", err)
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isTimerRunning = stopwatches.some(sw => sw.isRunning)

  useEffect(() => {
    if (!isTimerRunning && !restStartTime) {
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
  }, [isTimerRunning, restStartTime])

  const breakdown = useMemo(() => {
    return stopwatches.map(sw => {
      const current = sw.accumulatedTime + (sw.isRunning && sw.startTime ? currentTimeMs - sw.startTime : 0)
      return { ...sw, current }
    }).filter(sw => sw.current > 0).sort((a, b) => b.current - a.current)
  }, [stopwatches, currentTimeMs])

  const totalTime = useMemo(() => breakdown.reduce((acc, sw) => acc + sw.current, 0), [breakdown])

  const formatTotalTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  const addStopwatch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const newStopwatch: StopwatchData = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      startTime: null,
      accumulatedTime: 0,
      isRunning: false,
      color: selectedColor
    }

    setStopwatches([...stopwatches, newStopwatch])
    setNewTitle("")
  }

  const toggleStopwatch = (id: string) => {
    setStopwatches(prev => {
      const targetRunning = prev.find(s => s.id === id)?.isRunning
      if (targetRunning === undefined) return prev

      const now = Date.now()
      const todayDate = new Date().toISOString().split('T')[0]

      return prev.map(sw => {
        if (sw.id === id) {
          if (sw.isRunning) {
            // Stopping this timer, start resting
            setRestStartTime(now)
            localStorage.setItem('wyd-rest-start', now.toString())
            
            const addedTime = sw.startTime ? now - sw.startTime : 0
            const currentSessions = sw.sessions || []
            const todaySessionIndex = currentSessions.findIndex(s => s.date === todayDate)
            let newSessions = [...currentSessions]

            if (todaySessionIndex >= 0) {
              newSessions[todaySessionIndex] = { ...newSessions[todaySessionIndex], durationMs: newSessions[todaySessionIndex].durationMs + addedTime }
            } else {
              newSessions.push({ date: todayDate, durationMs: addedTime })
            }

            return {
              ...sw,
              isRunning: false,
              startTime: null,
              accumulatedTime: sw.accumulatedTime + addedTime,
              sessions: newSessions
            }
          } else {
            // Starting this timer, stop resting
            setRestStartTime(null)
            localStorage.removeItem('wyd-rest-start')
            return {
              ...sw,
              isRunning: true,
              startTime: now,
              isCompleted: false
            }
          }
        } else {
          // If we are starting the target stopwatch, stop any other running ones
          if (!targetRunning && sw.isRunning) {
            setRestStartTime(null)
            localStorage.removeItem('wyd-rest-start')

            const addedTime = sw.startTime ? now - sw.startTime : 0
            const currentSessions = sw.sessions || []
            const todaySessionIndex = currentSessions.findIndex(s => s.date === todayDate)
            let newSessions = [...currentSessions]

            if (todaySessionIndex >= 0) {
              newSessions[todaySessionIndex] = { ...newSessions[todaySessionIndex], durationMs: newSessions[todaySessionIndex].durationMs + addedTime }
            } else {
              newSessions.push({ date: todayDate, durationMs: addedTime })
            }

            return {
              ...sw,
              isRunning: false,
              startTime: null,
              accumulatedTime: sw.accumulatedTime + addedTime,
              sessions: newSessions
            }
          }
          return sw
        }
      })
    })
  }

  const resetStopwatch = (id: string) => {
    setStopwatches(prev => prev.map(sw => {
      if (sw.id !== id) return sw
      return {
        ...sw,
        isRunning: false,
        startTime: null,
        accumulatedTime: 0
      }
    }))
  }

  const deleteStopwatch = (id: string) => {
    setStopwatches(prev => prev.filter(sw => sw.id !== id))
  }

  const editTime = (id: string, msDelta: number) => {
    setStopwatches(prev => prev.map(sw => {
      if (sw.id !== id) return sw
      const newAccumulated = Math.max(0, sw.accumulatedTime + msDelta)
      return { ...sw, accumulatedTime: newAccumulated }
    }))
  }

  const togglePomodoro = (id: string) => {
    setStopwatches(prev => prev.map(sw => {
      if (sw.id !== id) return sw
      return { ...sw, isPomodoro: !sw.isPomodoro }
    }))
  }

  const toggleComplete = (id: string) => {
    setStopwatches(prev => prev.map(sw => {
      if (sw.id !== id) return sw
      if (sw.isRunning) {
        // Stop timer when marked complete
        toggleStopwatch(id)
      }
      return { ...sw, isCompleted: !sw.isCompleted }
    }))
  }

  const handleDragStart = (id: string) => {
    setDraggedItemId(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return

    setStopwatches(prev => {
      const clone = [...prev]
      const sourceIndex = clone.findIndex(sw => sw.id === draggedItemId)
      const targetIndex = clone.findIndex(sw => sw.id === targetId)

      if (sourceIndex === -1 || targetIndex === -1) return prev

      const [movedItem] = clone.splice(sourceIndex, 1)
      clone.splice(targetIndex, 0, movedItem)
      return clone
    })
    setDraggedItemId(null)
  }

  if (!isLoaded) return (<div>
    <div className="flex flex-col items-center justify-center h-screen text-muted-foreground opacity-50 space-y-1">
      <Timer className="w-6 h-6" />
      <p className="text-[10px] font-medium">Loading...</p>
    </div>
  </div>);


  return (
    <div className="p-2 h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div className="mb-3 px-1 space-y-1.5 shrink-0">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-widest leading-none mb-0.5">Studied Today</div>
            {restStartTime && !isTimerRunning && (
              <div className="text-[10px] text-amber-500/80 font-medium leading-none">
                Resting: {formatTotalTime(currentTimeMs - restStartTime)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              ref={fileInputRef}
              onChange={importFromJson}
            />
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => invoke('open_stats')} title="Stats">
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
            {user && (
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={logOut} title={`Sign out (${user.email})`}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className={`h-5 w-5 ${showSettings ? 'text-foreground' : 'text-muted-foreground'} hover:text-foreground`} onClick={() => setShowSettings(!showSettings)} title="Settings">
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <div className="flex flex-col items-end">
              <div className="text-sm font-bold tabular-nums tracking-wide leading-none">{formatTotalTime(totalTime)}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">/ {formatTotalTime(dailyGoalMs)}</div>
            </div>
          </div>
        </div>

        {totalTime > 0 ? (
          <div className="flex flex-col gap-1 w-full">
            <div className="flex w-full h-2 rounded-full overflow-hidden bg-muted/50 border border-muted">
              {breakdown.map(sw => (
                <div
                  key={sw.id}
                  className="transition-all duration-300 ease-linear"
                  style={{
                    width: `${(sw.current / Math.max(totalTime, dailyGoalMs)) * 100}%`,
                    backgroundColor: sw.color || '#22c55e'
                  }}
                  onDragStart={() => handleDragStart(sw.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(sw.id)}
                  title={`${sw.title}: ${formatTotalTime(sw.current)}`}
                />
              ))}
            </div>
            {totalTime > dailyGoalMs && (
              <div className="text-[10px] text-primary self-end font-medium">Goal Reached! 🎉</div>
            )}
          </div>
        ) : (
          <div className="w-full h-2 rounded-full bg-muted/50 border border-muted" />
        )}
      </div>

      {showSettings ? (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-5 p-3 mt-1 bg-muted/30 rounded-lg border">
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-foreground">Daily Goal</h3>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={dailyGoalMs / 3600000}
                onChange={(e) => {
                  const newGoal = Number(e.target.value) * 3600000
                  setDailyGoalMs(newGoal)
                  localStorage.setItem('wyd-daily-goal', newGoal.toString())
                }}
                className="w-20 h-8 text-xs bg-background"
              />
              <span className="text-muted-foreground text-xs">hours</span>
            </div>
          </div>
          
          <div className="space-y-2 pt-3 border-t">
            <h3 className="font-medium text-sm text-foreground">Account</h3>
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                <Button variant="outline" size="sm" className="text-xs h-7 shrink-0" onClick={logOut}>Sign out</Button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault()
                setAuthError('')
                try {
                  if (isSignUp) await signUpEmail(authEmail, authPassword)
                  else await signInEmail(authEmail, authPassword)
                  setAuthEmail('')
                  setAuthPassword('')
                } catch (err: unknown) {
                  setAuthError(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Auth failed')
                }
              }} className="space-y-1.5">
                <Input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="h-8 text-xs bg-background" required />
                <Input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="h-8 text-xs bg-background" required minLength={6} />
                {authError && <p className="text-[10px] text-destructive">{authError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="flex-1 text-xs h-8">{isSignUp ? 'Sign up' : 'Sign in'}</Button>
                </div>
                <button type="button" onClick={() => { setIsSignUp(!isSignUp); setAuthError('') }} className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center">
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </form>
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed">Sign in to sync data across devices.</p>
          </div>

          <div className="space-y-2 pt-3 border-t">
            <h3 className="font-medium text-sm text-foreground">Data Management</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={exportToJson}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">Importing will merge with existing tasks. Exporting saves all data as JSON.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1 -mr-1">
            {stopwatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-1">
                <Timer className="w-6 h-6" />
                <p className="text-[10px] font-medium">No timers</p>
              </div>
            ) : (
              stopwatches.map(sw => (
                <StopwatchItem
                  key={sw.id}
                  stopwatch={sw}
                  onToggle={toggleStopwatch}
                  onReset={resetStopwatch}
                  onDelete={deleteStopwatch}
                  onEditTime={editTime}
                  onTogglePomodoro={togglePomodoro}
                  onToggleComplete={toggleComplete}
                  onDragStart={() => handleDragStart(sw.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(sw.id)}
                />
              ))
            )}
          </div>

          <div className="mt-2 pt-2 border-t bg-background shrink-0 z-10 flex flex-col gap-2.5">
            <form onSubmit={addStopwatch} className="flex gap-1.5">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New task..."
                className="h-7 text-xs px-2 focus-visible:ring-1"
                autoFocus={stopwatches.length === 0}
              />
              <Button type="submit" size="sm" className="h-7 w-7 p-0 shrink-0" variant="secondary" disabled={!newTitle.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="flex items-center justify-between px-1 mb-0.5">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${selectedColor === color ? 'ring-2 ring-primary/80 ring-offset-2 ring-offset-background scale-110 shadow-sm' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
