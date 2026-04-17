import {
  LayoutDashboard,
  BarChart3,
  History,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  Focus
} from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { SyncState } from '../hooks/useFirebaseSync'

interface SidebarProps {
  activeView: 'dashboard' | 'stats' | 'history' | 'settings'
  onViewChange: (view: 'dashboard' | 'stats' | 'history' | 'settings') => void
  syncState: SyncState
  onRetrySync: () => void
  onFocusMode: () => void
}

export function Sidebar({
  activeView,
  onViewChange,
  syncState,
  onRetrySync,
  onFocusMode
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const

  return (
    <div className="w-16 md:w-56 h-full bg-card border-r flex flex-col transition-all duration-300 ease-in-out shrink-0">
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
          <Focus className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg hidden md:block truncate">FocusFlow</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
              activeView === item.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium hidden md:block">{item.label}</span>
            {activeView === item.id && (
               <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground hidden md:block" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-2 space-y-2">
        <Button
          variant="secondary"
          className="w-full justify-start gap-3 h-10 px-3 md:px-3 overflow-hidden"
          onClick={onFocusMode}
        >
          <Focus className="w-5 h-5 shrink-0" />
          <span className="hidden md:block">Focus Mode</span>
        </Button>

        <div className="px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="shrink-0">
            {syncState === 'offline' && <CloudOff className="w-4 h-4" />}
            {syncState === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
            {syncState === 'synced' && <Cloud className="w-4 h-4 text-emerald-500" />}
            {syncState === 'error' && (
              <button onClick={onRetrySync} aria-label="Retry sync">
                <AlertCircle className="w-4 h-4 text-destructive" />
              </button>
            )}
          </div>
          <span className="hidden md:block truncate">
            {syncState.charAt(0).toUpperCase() + syncState.slice(1)}
          </span>
        </div>
      </div>
    </div>
  )
}
