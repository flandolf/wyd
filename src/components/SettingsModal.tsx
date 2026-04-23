import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Download,
  Upload,
  Cloud,
  CloudOff,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { Settings } from "../hooks/useSettings";
import type { User } from "firebase/auth";
import type { SyncState } from "../hooks/useFirebaseSync";
import type { SubjectData } from "./SubjectItem";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onUpdateDailyGoal: (ms: number) => void;
  onUpdateDailyGoalByDay: (dayIndex: number, ms: number) => void;
  onUpdatePomodoroDuration: (ms: number) => void;
  onUpdateBreakDuration: (ms: number) => void;
  user: User | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onLogOut: () => void;
  syncState: SyncState;
  syncError: string | null;
  onRetrySync: () => void;
  subjects: SubjectData[];
  onImport: (data: SubjectData[]) => void;
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
}: SettingsModalProps) {
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const [isCustomSchedule, setIsCustomSchedule] = useState(
    () =>
      !settings.dailyGoalByDayMs.every(
        (v) => v === settings.dailyGoalByDayMs[0],
      ),
  );

  const handleCustomScheduleChange = (checked: boolean) => {
    setIsCustomSchedule(checked);
    if (!checked) {
      onUpdateDailyGoal(settings.dailyGoalMs);
    }
  };

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isSignUp) {
        await onSignUp(authEmail, authPassword);
        toast.success("Account created successfully");
      } else {
        await onSignIn(authEmail, authPassword);
        toast.success("Signed in successfully");
      }
      setAuthEmail("");
      setAuthPassword("");
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message.replace("Firebase: ", "")
          : "Auth failed",
      );
    }
  };

  const handleLogOut = () => {
    onLogOut();
    toast.success("Signed out");
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(subjects, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wyd-subjects-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(
          event.target?.result as string,
        ) as SubjectData[];
        if (Array.isArray(importedData)) {
          onImport(importedData);
          toast.success(`Imported ${importedData.length} subjects`);
        }
      } catch (err) {
        toast.error("Failed to parse JSON file");
        console.error("Failed to parse imported JSON", err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-96 p-0 gap-0 rounded-xl overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-medium">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full px-5 py-4">
          <TabsList className="w-full" variant={'line'}>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            {/* Daily Goal Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium text-foreground">
                  Daily Goal
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    Custom schedule
                  </span>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary cursor-pointer"
                    checked={isCustomSchedule}
                    onChange={(e) =>
                      handleCustomScheduleChange(e.target.checked)
                    }
                  />
                </div>
              </div>

              {!isCustomSchedule ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={settings.dailyGoalMs / 3600000}
                    onChange={(e) =>
                      onUpdateDailyGoal(Number(e.target.value) * 3600000)
                    }
                    className="w-20 h-7 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">hours</span>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => (
                    <div key={dayIndex} className="space-y-1.5 text-center">
                      <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-medium">
                        {dayLabels[dayIndex]}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={settings.dailyGoalByDayMs[dayIndex] / 3600000}
                        onChange={(e) =>
                          onUpdateDailyGoalByDay(
                            dayIndex,
                            Number(e.target.value) * 3600000,
                          )
                        }
                        className="h-7 text-xs text-center px-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Timer Durations Section */}
            <section className="space-y-3 pt-4 border-t">
              <label className="text-xs font-medium text-foreground">
                Timer Durations
              </label>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <label
                    className="text-[10px] text-muted-foreground"
                    htmlFor="pomodoro-duration"
                  >
                    Pomodoro
                  </label>
                  <Input
                    id="pomodoro-duration"
                    type="number"
                    min="1"
                    step="1"
                    value={Math.round(settings.pomodoroDurationMs / 60000)}
                    onChange={(e) =>
                      onUpdatePomodoroDuration(Number(e.target.value) * 60000)
                    }
                    className="w-14 h-7 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">min</span>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className="text-[10px] text-muted-foreground"
                    htmlFor="break-duration"
                  >
                    Break
                  </label>
                  <Input
                    id="break-duration"
                    type="number"
                    min="1"
                    step="1"
                    value={Math.round(settings.breakDurationMs / 60000)}
                    onChange={(e) =>
                      onUpdateBreakDuration(Number(e.target.value) * 60000)
                    }
                    className="w-14 h-7 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">min</span>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="account" >
            {user ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 px-2.5 shrink-0"
                    onClick={handleLogOut}
                  >
                    Sign out
                  </Button>
                </div>

                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 rounded-lg">
                  {syncState === "offline" && (
                    <>
                      <CloudOff className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Offline
                      </span>
                    </>
                  )}
                  {syncState === "syncing" && (
                    <>
                      <RefreshCw className="h-4 w-4 text-info animate-spin shrink-0" />
                      <span className="text-xs text-info">Syncing...</span>
                    </>
                  )}
                  {syncState === "synced" && (
                    <>
                      <Cloud className="h-4 w-4 text-success shrink-0" />
                      <span className="text-xs text-success">Synced</span>
                    </>
                  )}
                  {syncState === "error" && (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="text-xs text-destructive">
                        {syncError || "Sync failed"}
                      </span>
                    </>
                  )}
                  {(syncState === "error" || syncState === "offline") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] ml-auto"
                      onClick={onRetrySync}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="h-8 text-xs"
                    required
                    minLength={6}
                  />
                  {authError && (
                    <p className="text-[10px] text-destructive">{authError}</p>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full text-xs h-8"
                  >
                    {isSignUp ? "Sign up" : "Sign in"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError("");
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center"
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Sign in to sync your data across devices.
                </p>
              </section>
            )}
          </TabsContent>

          <TabsContent value="data" >
            <section className="space-y-4">
              <div className="flex gap-3">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={importFromJson}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    asChild
                  >
                    <span>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Import
                    </span>
                  </Button>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={exportToJson}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Import merges with existing subjects. Export saves all data as
                JSON.
              </p>
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
