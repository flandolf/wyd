import { useEffect, useRef, useCallback, useState } from 'react'
import { ref, set, onValue, type Unsubscribe } from 'firebase/database'
import { db } from '../lib/firebase'
import type { StopwatchData } from '../components/StopwatchItem'
import type { User } from 'firebase/auth'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export function useFirebaseSync(
  user: User | null,
  stopwatches: StopwatchData[],
  isLoaded: boolean,
  onRemoteUpdate: (data: StopwatchData[]) => void,
) {
  const isRemoteUpdate = useRef(false)
  const unsubRef = useRef<Unsubscribe | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (typeof navigator === 'undefined') return
      if (!navigator.onLine) {
        setSyncState('offline')
      } else if (user) {
        setSyncState('idle')
      }
    }

    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [user])

  // Listen for remote changes
  useEffect(() => {
    if (!user) {
      setSyncState('idle')
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      return
    }

    const userRef = ref(db, `users/${user.uid}/stopwatches`)
    unsubRef.current = onValue(userRef, (snapshot) => {
      const data = snapshot.val()
      if (data && Array.isArray(data)) {
        isRemoteUpdate.current = true
        onRemoteUpdate(data)
      }
      setSyncState('synced')
      setSyncError(null)
    })

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [user, onRemoteUpdate])

  // Push local changes to Firebase
  const pushToFirebase = useCallback(async () => {
    if (!user || !isLoaded || isRemoteUpdate.current) {
      isRemoteUpdate.current = false
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncState('offline')
      return
    }

    const userRef = ref(db, `users/${user.uid}/stopwatches`)
    setSyncState('syncing')
    try {
      await set(userRef, stopwatches)
      setSyncState('synced')
      setSyncError(null)
    } catch (error) {
      setSyncState('error')
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    }
  }, [user, stopwatches, isLoaded])

  useEffect(() => {
    pushToFirebase()
  }, [pushToFirebase, retryTick])

  const retrySync = useCallback(() => {
    setRetryTick((prev) => prev + 1)
  }, [])

  return { syncState, syncError, retrySync }
}
