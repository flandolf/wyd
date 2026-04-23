import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { MoreHorizontal } from "lucide-react"
import { cn } from "../lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  date: string
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

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function SubjectItem({
  subject,
  pomodoroDurationMs,
  onToggle,
  onReset,
  onDelete,
  onSetTime,
  onTogglePomodoro,
  onPomodoroComplete,
  onUpdateSubject,
}: SubjectItemProps) {
  const [displayTime, setDisplayTime] = useState(subject.accumulatedTime)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(subject.title)
  const [editHours, setEditHours] = useState(0)
  const [editMinutes, setEditMinutes] = useState(0)

  useEffect(() => {
    let animationFrameId: number

    const updateTime = () => {
      if (subject.isRunning && subject.startTime !== null) {
        let elapsed = subject.accumulatedTime + (Date.now() - subject.startTime)
        if (subject.isPomodoro && elapsed >= pomodoroDurationMs) {
          elapsed = pomodoroDurationMs
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

  useEffect(() => {
    if (isEditOpen) {
      setEditTitle(subject.title)
      const totalMinutes = Math.floor(subject.accumulatedTime / 60000)
      setEditHours(Math.floor(totalMinutes / 60))
      setEditMinutes(totalMinutes % 60)
    }
  }, [isEditOpen, subject.title, subject.accumulatedTime])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const totalMs = (editHours * 60 + editMinutes) * 60 * 1000
    if (editTitle.trim() !== subject.title) {
      onUpdateSubject?.(subject.id, { title: editTitle.trim() })
    }
    if (totalMs !== subject.accumulatedTime) {
      onSetTime(subject.id, totalMs)
    }
    setIsEditOpen(false)
  }

  const targetMs = subject.isPomodoro
    ? Math.max(0, pomodoroDurationMs - displayTime)
    : displayTime

  return (
    <>
      <div className={cn(
        "flex flex-row items-center gap-2 px-2 h-8",
        subject.isCompleted && "opacity-50"
      )}>
        <button
          onClick={() => onToggle(subject.id)}
          className={cn(
            "shrink-0 w-8 text-xs font-medium leading-none transition-colors text-center",
            subject.isRunning 
              ? "text-destructive hover:text-destructive/80" 
              : "text-chart-2 hover:text-chart-2/80"
          )}
        >
          {subject.isRunning ? 'Stop' : 'Start'}
        </button>

        <div className="flex-1 min-w-0 flex items-center">
          <span className={cn(
            "text-xs truncate leading-none",
            subject.isCompleted && "line-through"
          )}>
            {subject.title}
          </span>
        </div>

        <span className={cn(
            "text-xs tabular-nums leading-none",
            subject.isCompleted && "line-through"
          )}>
          {formatTime(targetMs)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 flex items-center text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTogglePomodoro(subject.id)}>
              {subject.isPomodoro ? 'Disable' : 'Enable'} Pomodoro
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onReset(subject.id)}
              disabled={subject.isRunning}
            >
              Reset
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(subject.id)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-81.25">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-9"
              placeholder="Subject title"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={editHours}
                onChange={(e) => setEditHours(Math.max(0, Number(e.target.value)))}
                className="w-16 h-9"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={editMinutes}
                onChange={(e) => setEditMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                className="w-16 h-9"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">m</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!editTitle.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}