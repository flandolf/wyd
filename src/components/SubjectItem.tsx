
import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Play, Pause, RotateCcw, Trash2, Timer as TimerIcon, CheckCircle2, Circle, MoreVertical, ChevronUp, ChevronDown, Pencil } from "lucide-react"
import { cn } from "../lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Input } from "./ui/input"

export interface StudySession {
  date: string // YYYY-MM-DD
  durationMs: number
  startedAtIso?: string
  endedAtIso?: string
}

export interface SubjectData {
  id: string
  title: string
  startTime: number | null
  accumulatedTime: number
  isRunning: boolean
  color?: string
  sessions?: StudySession[]
  isPomodoro?: boolean
  isCompleted?: boolean
  order?: number
}

interface SubjectItemProps {
  subject: SubjectData
  pomodoroDurationMs: number
  onToggle: (id: string) => void
  onReset: (id: string) => void
  onDelete: (id: string) => void
  onSetTime: (id: string, totalMs: number) => void
  onTogglePomodoro: (id: string) => void
  onPomodoroComplete?: (id: string) => void
  onToggleComplete?: (id: string) => void
  onUpdateSubject?: (id: string, updates: Partial<SubjectData>) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  isFirst?: boolean
  isLast?: boolean
}

function CircularProgress({ progress, size = 32, strokeWidth = 3, color }: { progress: number, size?: number, strokeWidth?: number, color: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 1) * circumference)

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
    </svg>
  )
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#0ea5e9', '#3b82f6', '#a855f7', '#ec4899',
]

export function SubjectItem({
  subject,
  pomodoroDurationMs,
  onToggle,
  onReset,
  onDelete,
  onSetTime,
  onTogglePomodoro,
  onPomodoroComplete,
  onToggleComplete,
  onUpdateSubject,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SubjectItemProps) {
  const [displayTime, setDisplayTime] = useState(subject.accumulatedTime)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(subject.title)
  const [editColor, setEditColor] = useState(subject.color || '#22c55e')
  const [editHours, setEditHours] = useState(0)
  const [editMinutes, setEditMinutes] = useState(0)

  const notifyPomodoroComplete = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "granted") {
      new window.Notification("Pomodoro Complete", { body: `${subject.title} - Time for a break!` })
      return
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new window.Notification("Pomodoro Complete", { body: `${subject.title} - Time for a break!` })
        }
      })
    }
  }

  useEffect(() => {
    let animationFrameId: number

    const updateTime = () => {
      if (subject.isRunning && subject.startTime !== null) {
        let elapsed = subject.accumulatedTime + (Date.now() - subject.startTime)
        if (subject.isPomodoro && elapsed >= pomodoroDurationMs) {
          elapsed = pomodoroDurationMs
          notifyPomodoroComplete()
          if (onPomodoroComplete) onPomodoroComplete(subject.id)
          else onToggle(subject.id)
        }
        setDisplayTime(elapsed)
        if (subject.isRunning) {
          animationFrameId = requestAnimationFrame(updateTime)
        }
      } else {
        setDisplayTime(subject.accumulatedTime)
      }
    }

    updateTime()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [subject.isRunning, subject.startTime, subject.accumulatedTime, subject.isPomodoro, pomodoroDurationMs, onToggle, onPomodoroComplete, subject.id])

  // Populate edit fields when modal opens
  useEffect(() => {
    if (isEditModalOpen) {
      setEditTitle(subject.title)
      setEditColor(subject.color || '#22c55e')
      const totalMinutes = Math.floor(subject.accumulatedTime / 60000)
      setEditHours(Math.floor(totalMinutes / 60))
      setEditMinutes(totalMinutes % 60)
    }
  }, [isEditModalOpen, subject.title, subject.color, subject.accumulatedTime])

  const formatTime = (ms: number) => {
    let targetMs = ms
    if (subject.isPomodoro) {
      targetMs = Math.max(0, pomodoroDurationMs - ms)
    }

    const totalSeconds = Math.floor(targetMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const totalMs = (editHours * 60 + editMinutes) * 60 * 1000
    if (editTitle.trim() !== subject.title || editColor !== subject.color) {
      onUpdateSubject?.(subject.id, { title: editTitle.trim(), color: editColor })
    }
    if (totalMs !== subject.accumulatedTime) {
      onSetTime(subject.id, totalMs)
    }
    setIsEditModalOpen(false)
  }

  // Calculate progress for circular indicator
  const progress = subject.isPomodoro
    ? displayTime / pomodoroDurationMs
    : Math.min(displayTime / (60 * 60 * 1000), 1) // 1 hour as default max

  // Count today's sessions
  const todayDate = new Date().toISOString().split('T')[0]
  const todaySessions = (subject.sessions || []).filter(s => {
    const sessionDate = s.startedAtIso ? s.startedAtIso.split('T')[0] : s.date
    return sessionDate === todayDate
  }).length

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 p-2 bg-card rounded-lg border shadow-sm transition-all duration-200 overflow-hidden",
          "hover:shadow-md hover:border-primary/20",
          subject.isRunning && "ring-1 ring-primary/20 bg-primary/2",
          subject.isCompleted && "opacity-50"
        )}
      >
        {/* Color Bar */}
        <div
          className="w-1 self-stretch rounded-full -my-2 -ml-2 mr-0.5"
          style={{ backgroundColor: subject.color || '#22c55e' }}
        />

        {/* Order controls */}
        <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMoveUp?.(subject.id)}
            disabled={isFirst}
            className="text-muted-foreground hover:text-foreground disabled:text-muted-foreground/30 disabled:hover:text-muted-foreground/30 focus:outline-none"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMoveDown?.(subject.id)}
            disabled={isLast}
            className="text-muted-foreground hover:text-foreground disabled:text-muted-foreground/30 disabled:hover:text-muted-foreground/30 focus:outline-none"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Completion Checkbox */}
        {onToggleComplete && (
          <button
            onClick={() => onToggleComplete(subject.id)}
            className="text-muted-foreground hover:text-primary transition-colors focus:outline-none shrink-0"
          >
            {subject.isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Timer Ring with Play/Pause */}
        <button
          onClick={() => onToggle(subject.id)}
          className="relative shrink-0 group/play"
          title={subject.isRunning ? "Pause" : "Start"}
        >
          <CircularProgress
            progress={progress}
            size={40}
            strokeWidth={3}
            color={subject.color || '#22c55e'}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {subject.isRunning ? (
              <Pause className="h-4 w-4 text-muted-foreground group-hover/play:text-foreground transition-colors" />
            ) : (
              <Play className="h-4 w-4 ml-0.5 text-muted-foreground group-hover/play:text-foreground transition-colors" />
            )}
          </div>
        </button>

        {/* Subject Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className={cn(
              "font-medium text-xs truncate",
              subject.isCompleted && "line-through text-muted-foreground"
            )}>
              {subject.title}
            </h3>
            {subject.isPomodoro && (
              <TimerIcon className="h-3 w-3 text-primary shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              "text-sm font-semibold tabular-nums tracking-wide",
              subject.isRunning ? "text-primary" : "text-muted-foreground"
            )}>
              {formatTime(displayTime)}
            </span>
            {todaySessions > 0 && (
              <span className="text-[10px] text-muted-foreground/70">
                {todaySessions} session{todaySessions !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Subject
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTogglePomodoro(subject.id)}>
              <TimerIcon className={cn("mr-2 h-4 w-4", subject.isPomodoro && "text-primary")} />
              {subject.isPomodoro ? 'Disable' : 'Enable'} Pomodoro
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onReset(subject.id)}
              disabled={subject.isRunning}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Today
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(subject.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Subject</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-8 text-sm"
                placeholder="Subject name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Color</label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all duration-200",
                      editColor === color
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                        : "opacity-60 hover:opacity-100 hover:scale-110"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Time Studied Today</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={editHours}
                  onChange={(e) => setEditHours(Math.max(0, Number(e.target.value)))}
                  className="h-8 w-16 text-sm"
                />
                <span className="text-xs text-muted-foreground">h</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                  className="h-8 w-16 text-sm"
                />
                <span className="text-xs text-muted-foreground">m</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
