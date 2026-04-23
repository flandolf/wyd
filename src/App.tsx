import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Plus, MoreHorizontal, BarChart2 } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { SubjectItem, type SubjectData } from "./components/SubjectItem";
import { useAuth } from "./components/AuthProvider";
import { useFirebaseSync } from "./hooks/useFirebaseSync";
import { useSubjects } from "./hooks/useSubjects";
import { useSettings } from "./hooks/useSettings";
import { SettingsModal } from "./components/SettingsModal";
import { ThemeToggle } from "./components/ThemeToggle";
import { toast } from "sonner";
import { DEFAULT_SUBJECT_COLOR } from "./lib/constants";

function App(): React.JSX.Element {
  const [newTitle, setNewTitle] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);

  const { user, signInEmail, signUpEmail, logOut } = useAuth();
  const {
    settings,
    isLoaded: settingsLoaded,
    updateDailyGoal,
    updateDailyGoalByDay,
    updatePomodoroDuration,
    updateBreakDuration,
    getTargetStudyTimeMs,
  } = useSettings();

  const {
    subjects,
    isLoaded,
    isTimerRunning,
    restStartTime,
    activeBreak,
    handleRemoteUpdate,
    addSubject,
    toggleSubject,
    resetSubject,
    deleteSubject,
    updateSubject,
    setSubjectTime,
    togglePomodoro,
    toggleComplete,
    handlePomodoroComplete,
    moveSubject,
    checkBreakEnded,
  } = useSubjects(settings.breakDurationMs);

  const { syncState, syncError, retrySync } = useFirebaseSync(
    user,
    subjects,
    isLoaded,
    handleRemoteUpdate,
  );

  useEffect(() => {
    if (!isTimerRunning && !restStartTime && !activeBreak) {
      setCurrentTimeMs(Date.now());
      return;
    }

    let animationFrameId: number;
    const updateTime = () => {
      setCurrentTimeMs(Date.now());
      animationFrameId = requestAnimationFrame(updateTime);
    };

    updateTime();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isTimerRunning, restStartTime, activeBreak]);

  useEffect(() => {
    checkBreakEnded(currentTimeMs);
  }, [activeBreak, currentTimeMs, checkBreakEnded]);

  const breakdown = useMemo(() => {
    return subjects
      .map((sw) => {
        const current =
          sw.accumulatedTime +
          (sw.isRunning && sw.startTime ? currentTimeMs - sw.startTime : 0);
        return { ...sw, current };
      })
      .filter((sw) => sw.current > 0)
      .sort((a, b) => b.current - a.current);
  }, [subjects, currentTimeMs]);

  const totalTime = useMemo(
    () => breakdown.reduce((acc, sw) => acc + sw.current, 0),
    [breakdown],
  );
  const targetDailyGoalMs = getTargetStudyTimeMs(new Date(currentTimeMs));

  const formatTotalTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addSubject(newTitle, DEFAULT_SUBJECT_COLOR);
    setNewTitle("");
    toast.success(`Added "${newTitle.trim()}"`);
  };

  const handleImport = useCallback(
    (importedData: SubjectData[]) => {
      importedData.forEach((importedItem) => {
        const existsLocally = subjects.find((sw) => sw.id === importedItem.id);
        if (!existsLocally) {
          addSubject(
            importedItem.title,
            importedItem.color || DEFAULT_SUBJECT_COLOR,
          );
        }
      });
    },
    [subjects, addSubject],
  );

  if (!isLoaded || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <p className="text-xs">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium tabular-nums text-primary">
            {formatTotalTime(totalTime)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            / {formatTotalTime(targetDailyGoalMs)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-chart-1"
            onClick={async () => {
              const statsWindow = new WebviewWindow("stats", {
                url: "index.html#stats",
              });
              await statsWindow.show();
              await statsWindow.setFocus();
            }}
            title="View Stats"
          >
            <BarChart2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Subject list */}
      <main className="flex-1 overflow-y-auto min-h-0">
        {subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-xs">No subjects</p>
          </div>
        ) : (
          <div className="stagger-list space-y-2 p-4">
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
                onMoveUp={
                  moveSubject ? (id) => moveSubject(id, "up") : undefined
                }
                onMoveDown={
                  moveSubject ? (id) => moveSubject(id, "down") : undefined
                }
                isFirst={index === 0}
                isLast={index === subjects.length - 1}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add subject */}
      <footer className="p-2 border-t shrink-0">
        <form onSubmit={handleAddSubject} className="flex gap-2 items-center">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add subject..."
            className="h-8 text-xs"
            autoFocus={subjects.length === 0}
          />
          <Button
            type="submit"
            size="icon-sm"
            className="p-0 shrink-0"
            disabled={!newTitle.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </footer>

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
  );
}

export default App;
