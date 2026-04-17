import { useMemo } from 'react'
import { SubjectData, StudySession } from './SubjectItem'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Calendar, Clock, FileText, ChevronRight } from 'lucide-react'

interface SessionHistoryProps {
  subjects: SubjectData[]
}

interface FlattenedSession extends StudySession {
  subjectTitle: string
  subjectColor: string
  subjectCategory?: string
  subjectIcon?: string
}

export function SessionHistory({ subjects }: SessionHistoryProps) {
  const flattenedSessions = useMemo(() => {
    const sessions: FlattenedSession[] = []
    subjects.forEach(subject => {
      subject.sessions?.forEach(session => {
        sessions.push({
          ...session,
          subjectTitle: subject.title,
          subjectColor: subject.color || '#22c55e',
          subjectCategory: subject.category,
          subjectIcon: subject.icon
        })
      })
    })
    return sessions.sort((a, b) => {
      const dateA = a.startedAtIso ? new Date(a.startedAtIso).getTime() : new Date(a.date).getTime()
      const dateB = b.startedAtIso ? new Date(b.startedAtIso).getTime() : new Date(b.date).getTime()
      return dateB - dateA
    })
  }, [subjects])

  const formatMs = (ms: number) => {
    const mins = Math.floor(ms / 60000)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  const formatDate = (iso?: string, dateStr?: string) => {
    const d = iso ? new Date(iso) : new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: iso ? '2-digit' : undefined,
      minute: iso ? '2-digit' : undefined
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-4xl font-black tracking-tight">Session History</h1>
        <p className="text-muted-foreground mt-1 font-medium">Browse and review your past focus sessions.</p>
      </div>

      <div className="space-y-3">
        {flattenedSessions.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed">
            <Calendar className="w-8 h-8 opacity-20 mb-2" />
            <p className="text-sm font-bold uppercase tracking-widest">No sessions recorded yet</p>
          </div>
        ) : (
          flattenedSessions.map((session, i) => (
            <Card key={i} className="group border-none shadow-sm hover:shadow-md transition-all duration-300 bg-card/50 overflow-hidden">
              <CardContent className="p-0 flex items-center h-20">
                <div
                  className="w-1.5 h-full shrink-0"
                  style={{ backgroundColor: session.subjectColor }}
                />

                <div className="flex-1 px-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted"
                      style={{ color: session.subjectColor }}
                    >
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm">{session.subjectTitle}</h3>
                        {session.subjectCategory && (
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-bold uppercase tracking-tighter">
                            {session.subjectCategory}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(session.startedAtIso, session.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    {session.notes && (
                      <div className="flex items-center gap-1.5 text-muted-foreground" title={session.notes}>
                        <FileText className="w-4 h-4" />
                        <span className="text-xs max-w-[150px] truncate hidden md:block">{session.notes}</span>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-lg font-black tabular-nums leading-none">
                        {formatMs(session.durationMs)}
                      </div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Duration</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
