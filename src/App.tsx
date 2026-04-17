import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Plus, Search, LayoutGrid, List as ListIcon, Maximize2, Pause } from "lucide-react"
import { type SubjectData } from "./components/SubjectItem"
import { SubjectCard } from "./components/SubjectCard"
import { Sidebar } from "./components/Sidebar"
import { FocusOverlay } from "./components/FocusOverlay"
import { Stats } from "./components/stats/Stats"
import { SessionHistory } from "./components/SessionHistory"
import { useAuth } from "./components/AuthProvider"
import { useFirebaseSync } from "./hooks/useFirebaseSync"
import { useSubjects } from "./hooks/useSubjects"
import { useSettings } from "./hooks/useSettings"
import { SettingsModal } from "./components/SettingsModal"
import { EditSubjectModal } from "./components/EditSubjectModal"
import { cn } from './lib/utils'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#0ea5e9', '#3b82f6', '#a855f7', '#ec4899',
]

function App(): React.JSX.Element {
  const [activeView, setActiveView] = useState<'dashboard' | 'stats' | 'history' | 'settings'>('dashboard')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectData | null>(null)

  const { user, signInEmail, signUpEmail, logOut } = useAuth()
  const {
    settings,
    isLoaded: settingsLoaded,
    updateDailyGoal,
    updateDailyGoalByDay,
    updatePomodoroDuration,
    updateBreakDuration,
    updateCategories,
  } = useSettings()

  const {
    subjects,
    isLoaded,
    isTimerRunning,
    handleRemoteUpdate,
    addSubject,
    toggleSubject,
    deleteSubject,
    updateSubject,
    togglePomodoro,
    toggleComplete,
    checkBreakEnded,
  } = useSubjects(settings.breakDurationMs)

  const { syncState, syncError, retrySync } = useFirebaseSync(user, subjects, isLoaded, handleRemoteUpdate)

  const activeSubject = useMemo(() => subjects.find(s => s.isRunning), [subjects])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        const active = subjects.find(s => s.isRunning)
        if (active) toggleSubject(active.id)
        else if (subjects.length > 0) toggleSubject(subjects[0].id)
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'n') {
          e.preventDefault()
          setShowAddModal(true)
        }
        if (e.key === 'f') {
          e.preventDefault()
          if (activeSubject) setIsFocusMode(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [subjects, toggleSubject, activeSubject])

  // Sync active break with backend or handle ends
  useEffect(() => {
    const interval = setInterval(() => {
      checkBreakEnded(Date.now())

      // Idle Detection check
      if (settings.idleDetectionEnabled) {
        invoke<number>('get_idle_time').then(idleMs => {
          if (idleMs > settings.idleThresholdMs && isTimerRunning) {
             // In a real app, show a toast or notification to pause
             // toast.info("User idle detected. Should we pause the timer?")
          }
        })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [checkBreakEnded, settings.idleDetectionEnabled, settings.idleThresholdMs, isTimerRunning])

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = !selectedCategory || s.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [subjects, searchQuery, selectedCategory])


  if (!isLoaded || !settingsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary animate-bounce flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm font-bold tracking-widest text-muted-foreground animate-pulse">SYNCHRONIZING...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-geist">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        syncState={syncState}
        onRetrySync={retrySync}
        onFocusMode={() => setIsFocusMode(true)}
      />

      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-8 bg-card/30 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search subjects..."
                className="pl-10 h-10 bg-muted/50 border-none focus-visible:ring-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="h-10 bg-muted/50 border-none rounded-md px-3 text-sm font-medium focus:ring-1 focus:ring-primary outline-none"
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
            >
              <option value="">All Categories</option>
              {settings.categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1 mr-4">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="gap-2 h-10 px-4 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4" /> Add Subject
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeView === 'dashboard' && (
            <div className={cn(
              "animate-in fade-in slide-in-from-bottom-4 duration-500",
              viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4 max-w-4xl mx-auto"
            )}>
              {filteredSubjects.length === 0 ? (
                <div className="col-span-full h-96 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 opacity-20" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">No subjects found</h3>
                  <p className="text-sm mt-1">Try a different search or add a new subject to get started.</p>
                  <Button variant="outline" className="mt-6" onClick={() => setShowAddModal(true)}>Create Subject</Button>
                </div>
              ) : (
                filteredSubjects.map(s => (
                  <SubjectCard
                    key={s.id}
                    subject={s}
                    onToggle={toggleSubject}
                    onEdit={setEditingSubject}
                    onDelete={deleteSubject}
                    onTogglePomodoro={togglePomodoro}
                    onToggleComplete={toggleComplete}
                  />
                ))
              )}
            </div>
          )}

          {activeView === 'stats' && <Stats />}
          {activeView === 'history' && <SessionHistory subjects={subjects} />}
          {activeView === 'settings' && (
            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
               <SettingsModal
                  open={true}
                  onOpenChange={() => setActiveView('dashboard')}
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
                  onImport={() => {}}
                  embedded
                  onUpdateCategories={updateCategories}
                />
            </div>
          )}
        </div>

        {/* Active Session Bar */}
        {activeSubject && (
           <div className="h-14 bg-primary text-primary-foreground flex items-center justify-between px-8 animate-in slide-in-from-bottom-full duration-300">
             <div className="flex items-center gap-4">
               <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
               <span className="font-bold">Focusing on {activeSubject.title}</span>
             </div>
             <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-primary-foreground/10 text-white font-bold"
                  onClick={() => setIsFocusMode(true)}
                >
                  <Maximize2 className="w-4 h-4 mr-2" /> Focus Mode
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="font-bold"
                  onClick={() => toggleSubject(activeSubject.id)}
                >
                  <Pause className="w-4 h-4 mr-2" /> Stop Session
                </Button>
             </div>
           </div>
        )}
      </main>

      {/* Overlays */}
      {isFocusMode && activeSubject && (
        <FocusOverlay
          subject={activeSubject}
          onClose={() => setIsFocusMode(false)}
          onToggle={() => toggleSubject(activeSubject.id)}
        />
      )}

      {/* Modals */}
      <EditSubjectModal
        subject={editingSubject}
        open={!!editingSubject}
        onOpenChange={(open) => !open && setEditingSubject(null)}
        onSave={updateSubject}
        categories={settings.categories}
        onUpdateCategories={updateCategories}
      />

      {/* Quick Add Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-card border rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
             <h2 className="text-2xl font-black mb-6">Track New Subject</h2>
             <form onSubmit={(e) => {
               e.preventDefault();
               const form = e.target as HTMLFormElement;
               const title = (form.elements.namedItem('title') as HTMLInputElement).value;
               if (title) {
                 addSubject(title, PRESET_COLORS[0], "Book", selectedCategory || undefined);
                 setShowAddModal(false);
               }
             }} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Subject Title</label>
                  <Input name="title" autoFocus placeholder="e.g. Advanced Calculus" className="h-12 text-lg rounded-xl" />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="flex-1 h-12 rounded-xl font-bold">Cancel</Button>
                  <Button type="submit" className="flex-1 h-12 rounded-xl font-bold">Start Tracking</Button>
                </div>
             </form>
           </div>
        </div>
      )}
    </div>
  )
}

export default App
