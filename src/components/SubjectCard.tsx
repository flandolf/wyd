import { useState, useEffect, useMemo } from 'react'
import {
  Play,
  Pause,
  MoreVertical,
  Timer,
  CheckCircle2,
  Target,
  FileText
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { SubjectData } from './SubjectItem'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Badge } from './ui/badge'

interface SubjectCardProps {
  subject: SubjectData
  pomodoroDurationMs: number
  onToggle: (id: string) => void
  onEdit: (subject: SubjectData) => void
  onDelete: (id: string) => void
  onTogglePomodoro: (id: string) => void
  onToggleComplete: (id: string) => void
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function SubjectCard({
  subject,
  onToggle,
  onEdit,
  onDelete,
  onTogglePomodoro,
  onToggleComplete
}: Omit<SubjectCardProps, 'pomodoroDurationMs'>) {
  const [displayTime, setDisplayTime] = useState(subject.accumulatedTime)

  useEffect(() => {
    let animationFrameId: number | undefined
    const updateTime = () => {
      if (subject.isRunning && subject.startTime !== null) {
        const elapsed = subject.accumulatedTime + (Date.now() - subject.startTime)
        setDisplayTime(elapsed)
        animationFrameId = requestAnimationFrame(updateTime)
      } else {
        setDisplayTime(subject.accumulatedTime)
      }
    }
    updateTime()
    return () => {
      if (animationFrameId !== undefined) cancelAnimationFrame(animationFrameId)
    }
  }, [subject.isRunning, subject.startTime, subject.accumulatedTime])

  const IconComponent = (LucideIcons as any)[subject.icon || 'Book'] || LucideIcons.Book

  const progress = useMemo(() => {
    if (subject.dailyGoalMs) return Math.min(displayTime / subject.dailyGoalMs, 1)
    return Math.min(displayTime / (2 * 60 * 60 * 1000), 1) // Default 2h goal for visual
  }, [displayTime, subject.dailyGoalMs])

  return (
    <div className={cn(
      "group relative bg-card border rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20",
      subject.isRunning && "ring-2 ring-primary/20 bg-primary/5 border-primary/30",
      subject.isCompleted && "opacity-70"
    )}>
      {/* Background Decor */}
      <div
        className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-primary/5 rounded-tr-2xl pointer-events-none"
        style={{ background: `linear-gradient(135deg, transparent, ${subject.color || '#22c55e'}08)` }}
      />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shadow-sm"
            style={{ backgroundColor: `${subject.color || '#22c55e'}15`, color: subject.color || '#22c55e' }}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <h3 className={cn(
              "font-bold text-lg leading-tight",
              subject.isCompleted && "line-through text-muted-foreground"
            )}>
              {subject.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {subject.category && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-medium">
                  {subject.category}
                </Badge>
              )}
              {subject.isPomodoro && (
                <Timer className="w-3 h-3 text-primary animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Actions for ${subject.title}`}
            >
              <MoreVertical className="w-4 h-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(subject)}>
              <LucideIcons.Pencil className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTogglePomodoro(subject.id)}>
              <Timer className="w-4 h-4 mr-2" /> {subject.isPomodoro ? 'Disable' : 'Enable'} Pomodoro
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleComplete(subject.id)}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> {subject.isCompleted ? 'Unmark' : 'Mark'} Complete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(subject.id)} className="text-destructive">
              <LucideIcons.Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className={cn(
            "text-3xl font-black tabular-nums tracking-tight",
            subject.isRunning ? "text-primary" : "text-foreground"
          )}>
            {formatMs(displayTime)}
          </span>
          {subject.dailyGoalMs && (
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
               <Target className="w-3 h-3" />
               Goal: {Math.floor(subject.dailyGoalMs / 3600000)}h
             </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: subject.color || '#22c55e',
                boxShadow: subject.isRunning ? `0 0 12px ${subject.color || '#22c55e'}40` : 'none'
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-muted-foreground/60 uppercase">
            <span>Progress</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className={cn(
              "flex-1 h-10 rounded-xl font-bold transition-all active:scale-95",
              subject.isRunning ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            )}
            onClick={() => onToggle(subject.id)}
          >
            {subject.isRunning ? (
              <><Pause className="w-4 h-4 mr-2 fill-current" /> Pause Session</>
            ) : (
              <><Play className="w-4 h-4 mr-2 fill-current" /> Start Focus</>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => onEdit(subject)}
            aria-label={`Edit ${subject.title}`}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
