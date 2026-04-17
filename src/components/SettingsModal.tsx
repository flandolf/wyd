import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Download, Upload, Cloud, CloudOff, AlertCircle, RefreshCw, FileText } from "lucide-react"
import { exportToJSON, exportToCSV } from '../lib/data-utils'
import type { Settings } from '../hooks/useSettings'
import type { User } from 'firebase/auth'
import type { SyncState } from '../hooks/useFirebaseSync'
import type { SubjectData } from './SubjectItem'
import { toast } from 'sonner'
import { cn } from '../lib/utils'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onUpdateDailyGoal: (ms: number) => void
  onUpdateDailyGoalByDay: (dayIndex: number, ms: number) => void
  onUpdatePomodoroDuration: (ms: number) => void
  onUpdateBreakDuration: (ms: number) => void
  user: User | null
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onLogOut: () => void
  syncState: SyncState
  syncError: string | null
  onRetrySync: () => void
  subjects: SubjectData[]
  onImport: (data: SubjectData[]) => void
  embedded?: boolean
  onUpdateCategories?: (categories: string[]) => void
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  onUpdateDailyGoal,
  onUpdateDailyGoalByDay,
  onUpdatePomodoroDuration,
  onUpdateBreakDuration,
  user,
  onSignIn,
  onSignUp,
  onLogOut,
  syncState,
  syncError,
  onRetrySync,
  subjects,
  onImport,
  embedded,
}: SettingsModalProps) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const [isCustomSchedule, setIsCustomSchedule] = useState(() => 
    !settings.dailyGoalByDayMs.every((v) => v === settings.dailyGoalByDayMs[0])
  )

  const handleCustomScheduleChange = (checked: boolean) => {
    setIsCustomSchedule(checked)
    if (!checked) {
      onUpdateDailyGoal(settings.dailyGoalMs)
    }
  }

  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    try {
      if (isSignUp) {
        await onSignUp(authEmail, authPassword)
        toast.success('Account created successfully')
      } else {
        await onSignIn(authEmail, authPassword)
        toast.success('Signed in successfully')
      }
      setAuthEmail('')
      setAuthPassword('')
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Auth failed')
    }
  }

  const handleLogOut = () => {
    onLogOut()
    toast.success('Signed out')
  }

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string)
        if (Array.isArray(importedData)) {
          const isValidSubject = (item: any): item is SubjectData => {
            return (
              typeof item === 'object' &&
              item !== null &&
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              (item.startTime === null || typeof item.startTime === 'number') &&
              typeof item.accumulatedTime === 'number' &&
              typeof item.isRunning === 'boolean'
            )
          }

          const validItems = importedData.filter(isValidSubject)
          const invalidCount = importedData.length - validItems.length

          if (validItems.length > 0) {
            onImport(validItems)
            toast.success(`Imported ${validItems.length} subjects`)
            if (invalidCount > 0) {
              toast.warning(`Skipped ${invalidCount} invalid items`)
            }
          } else {
            toast.error('No valid subject data found in file')
          }
        }
      } catch (err) {
        toast.error('Failed to parse JSON file')
        console.error("Failed to parse imported JSON", err)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const content = (
    <div className={cn("flex flex-col", embedded ? "w-full" : "sm:max-w-100")}>
      {!embedded && (
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
        </DialogHeader>
      )}

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-10">
            <TabsTrigger
              value="general"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
            >
              General
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
            >
              Account
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs"
            >
              Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="p-4 space-y-4 mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Daily Goal</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Custom schedule</span>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary cursor-pointer"
                    checked={isCustomSchedule}
                    onChange={(e) => handleCustomScheduleChange(e.target.checked)}
                  />
                </div>
              </div>

              {!isCustomSchedule ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={settings.dailyGoalMs / 3600000}
                    onChange={(e) => onUpdateDailyGoal(Number(e.target.value) * 3600000)}
                    className="w-20 h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-xs">hours</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => (
                    <div key={dayIndex} className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block text-center uppercase tracking-wider font-medium">
                        {dayLabels[dayIndex]}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={settings.dailyGoalByDayMs[dayIndex] / 3600000}
                        onChange={(e) => onUpdateDailyGoalByDay(dayIndex, Number(e.target.value) * 3600000)}
                        className="h-8 text-xs text-center px-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <label className="text-xs font-medium text-foreground">Timer Durations</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Pomodoro (min)</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={Math.round(settings.pomodoroDurationMs / 60000)}
                    onChange={(e) => onUpdatePomodoroDuration(Number(e.target.value) * 60000)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Break (min)</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={Math.round(settings.breakDurationMs / 60000)}
                    onChange={(e) => onUpdateBreakDuration(Number(e.target.value) * 60000)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="account" className="p-4 space-y-3 mt-0">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  <Button variant="outline" size="sm" className="text-xs h-7 shrink-0" onClick={handleLogOut}>
                    Sign out
                  </Button>
                </div>

                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  {syncState === 'offline' && (
                    <>
                      <CloudOff className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Offline</span>
                    </>
                  )}
                  {syncState === 'syncing' && (
                    <>
                      <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                      <span className="text-xs text-blue-500">Syncing...</span>
                    </>
                  )}
                  {syncState === 'synced' && (
                    <>
                      <Cloud className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs text-emerald-500">Synced</span>
                    </>
                  )}
                  {syncState === 'error' && (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-xs text-destructive">{syncError || 'Sync failed'}</span>
                    </>
                  )}
                  {(syncState === 'error' || syncState === 'offline') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-auto"
                      onClick={onRetrySync}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="h-8 text-xs"
                  required
                  minLength={6}
                />
                {authError && <p className="text-[10px] text-destructive">{authError}</p>}
                <Button type="submit" size="sm" className="w-full text-xs h-8">
                  {isSignUp ? 'Sign up' : 'Sign in'}
                </Button>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setAuthError('') }}
                  className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </form>
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Sign in to sync your data across devices.
            </p>
          </TabsContent>

          <TabsContent value="data" className="p-4 space-y-3 mt-0">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={importFromJson}
                />
                <Button variant="outline" size="sm" className="w-full text-xs h-8" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import
                  </span>
                </Button>
              </label>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => exportToJSON(subjects)}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                JSON Export
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => exportToCSV(subjects)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                CSV Export
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Import merges with existing subjects. Export saves your full history in JSON or CSV format for spreadsheet analysis.
            </p>
          </TabsContent>
        </Tabs>
    </div>
  )

  if (embedded) return content

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-100 p-0 gap-0 rounded-xl overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  )
}