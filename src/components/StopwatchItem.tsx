
import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Play, Pause, RotateCcw, X, Edit2, Timer as TimerIcon, CheckCircle2, Circle } from "lucide-react"
import { cn } from "../lib/utils"

export interface StopwatchSession {
  date: string // YYYY-MM-DD
  durationMs: number
}

export interface StopwatchData {
  id: string
  title: string
  startTime: number | null
  accumulatedTime: number
  isRunning: boolean
  color?: string
  sessions?: StopwatchSession[]
  isPomodoro?: boolean
  isCompleted?: boolean
}

interface StopwatchItemProps {
  stopwatch: StopwatchData
  onToggle: (id: string) => void
  onReset: (id: string) => void
  onDelete: (id: string) => void
  onEditTime: (id: string, msDelta: number) => void
  onTogglePomodoro: (id: string) => void
  onToggleComplete?: (id: string) => void
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
}

export function StopwatchItem({ stopwatch, onToggle, onReset, onDelete, onEditTime, onTogglePomodoro, onToggleComplete }: StopwatchItemProps) {
  const [displayTime, setDisplayTime] = useState(stopwatch.accumulatedTime)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [editMinutes, setEditMinutes] = useState(0)

  // 25 minutes in milliseconds
  const POMODORO_DUR = 25 * 60 * 1000

  useEffect(() => {
    let animationFrameId: number

    const updateTime = () => {
      if (stopwatch.isRunning && stopwatch.startTime !== null) {
        let elapsed = stopwatch.accumulatedTime + (Date.now() - stopwatch.startTime)
        if (stopwatch.isPomodoro && elapsed >= POMODORO_DUR) {
          elapsed = POMODORO_DUR
          new window.Notification("Pomodoro Complete", { body: "Time for a break!" })
          onToggle(stopwatch.id) // stop the timer
        }
        setDisplayTime(elapsed)
        if (stopwatch.isRunning) {
          animationFrameId = requestAnimationFrame(updateTime)
        }
      } else {
        setDisplayTime(stopwatch.accumulatedTime)
      }
    }

    updateTime()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [stopwatch.isRunning, stopwatch.startTime, stopwatch.accumulatedTime, stopwatch.isPomodoro, onToggle])

  const formatTime = (ms: number) => {
    let targetMs = ms
    if (stopwatch.isPomodoro) {
      targetMs = Math.max(0, POMODORO_DUR - ms)
    }

    const totalSeconds = Math.floor(targetMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return (
      <div className="flex items-center text-sm font-semibold tabular-nums tracking-wide text-primary">
        {hours > 0 && <span className="text-muted-foreground/70">{hours.toString().padStart(2, '0')}:</span>}
        <span>{minutes.toString().padStart(2, '0')}</span>
        <span>:{seconds.toString().padStart(2, '0')}</span>
      </div>
    )
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onEditTime(stopwatch.id, editMinutes * 60 * 1000)
    setIsEditingTime(false)
    setEditMinutes(0)
  }

  return (
    <div className={cn("group flex flex-col p-1.5 pl-2.5 bg-card rounded-md border shadow-sm hover:border-primary/20 transition-all gap-2", stopwatch.isCompleted && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {onToggleComplete && (
            <button onClick={() => onToggleComplete(stopwatch.id)} className="text-muted-foreground hover:text-primary transition-colors focus:outline-none">
              {stopwatch.isCompleted ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
            </button>
          )}
          <div
            className={cn("size-2 rounded-full transition-all shadow-[0_0_4px_rgba(0,0,0,0.1)]", stopwatch.isRunning ? "animate-pulse" : "opacity-30")}
            style={{ backgroundColor: stopwatch.color || '#22c55e' }}
          />
          <div className="grid gap-px min-w-0">
            <h3 className={cn("font-medium text-[11px] text-muted-foreground truncate leading-none", stopwatch.isCompleted && "line-through")}>{stopwatch.title}</h3>
            <div className="leading-none text-sm">{formatTime(displayTime)}</div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground"
            onClick={() => onTogglePomodoro(stopwatch.id)}
            title="Toggle Pomodoro"
          >
            <TimerIcon className={cn("h-3.5 w-3.5", stopwatch.isPomodoro && "text-primary")} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditingTime(!isEditingTime)}
            title="Edit Time"
          >
            <Edit2 className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground"
            onClick={() => onReset(stopwatch.id)}
            disabled={stopwatch.isRunning && stopwatch.startTime !== null}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(stopwatch.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Show play button always if mobile? assuming toggle on hover for efficiency */}
        <div className="md:hidden flex items-center gap-1">
            <Button
              variant={stopwatch.isRunning ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => onToggle(stopwatch.id)}
            >
             {stopwatch.isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
            </Button>
        </div>
      </div>
      {isEditingTime && (
        <form onSubmit={handleEditSubmit} className="flex items-center gap-2 mt-1">
          <input
            type="number"
            className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Add/sub minutes"
            value={editMinutes}
            onChange={(e) => setEditMinutes(Number(e.target.value))}
          />
          <Button size="sm" type="submit" className="h-7 text-xs px-2">Save</Button>
        </form>
      )}
    </div>
  )
}
