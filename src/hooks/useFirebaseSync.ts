import { useEffect, useRef, useCallback, useState } from 'react'
import { ref, set, onValue, type Unsubscribe } from 'firebase/database'
import { db } from '../lib/firebase'
import type { SubjectData } from '../components/SubjectItem'
import type { User } from 'firebase/auth'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export function useFirebaseSync(
  user: User | null,
  subjects: SubjectData[],
  isLoaded: boolean,
  onRemoteUpdate: (data: SubjectData[]) => void,
) {
  const isRemoteUpdate = useRef(false)
  const unsubRef = useRef<Unsubscribe | null>(null)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSubjectsRef = useRef<string>('')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateOnlineStatus = () => {
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

    const userRef = ref(db, `users/${user.uid}/subjects`)
    unsubRef.current = onValue(
      userRef,
      (snapshot) => {
        const data = snapshot.val()
        if (data && Array.isArray(data)) {
          isRemoteUpdate.current = true
          onRemoteUpdate(data)
          setTimeout(() => {
            isRemoteUpdate.current = false
          }, 0)
        }
        setSyncState('synced')
        setSyncError(null)
      },
      (error) => {
        setSyncState('error')
        setSyncError(error.message)
      }
    )

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [user])

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

    const currentSubjectsJson = JSON.stringify(subjects)
    if (currentSubjectsJson === prevSubjectsRef.current) {
      return
    }
    prevSubjectsRef.current = currentSubjectsJson

    const userRef = ref(db, `users/${user.uid}/subjects`)
    setSyncState('syncing')
    try {
      await set(userRef, subjects)
      setSyncState('synced')
      setSyncError(null)
    } catch (error) {
      setSyncState('error')
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    }
  }, [user, subjects, isLoaded])

  useEffect(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    syncTimeoutRef.current = setTimeout(() => {
      pushToFirebase()
    }, 500)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [pushToFirebase, retryTick])

  const retrySync = useCallback(() => {
    setRetryTick((prev) => prev + 1)
  }, [])

  return { syncState, syncError, retrySync }
}
