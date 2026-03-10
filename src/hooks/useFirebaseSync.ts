import { useEffect, useRef, useCallback } from 'react'
import { ref, set, onValue, type Unsubscribe } from 'firebase/database'
import { db } from '../lib/firebase'
import type { StopwatchData } from '../components/StopwatchItem'
import type { User } from 'firebase/auth'

export function useFirebaseSync(
  user: User | null,
  stopwatches: StopwatchData[],
  isLoaded: boolean,
  onRemoteUpdate: (data: StopwatchData[]) => void,
) {
  const isRemoteUpdate = useRef(false)
  const unsubRef = useRef<Unsubscribe | null>(null)

  // Listen for remote changes
  useEffect(() => {
    if (!user) {
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
    })

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [user, onRemoteUpdate])

  // Push local changes to Firebase
  const pushToFirebase = useCallback(() => {
    if (!user || !isLoaded || isRemoteUpdate.current) {
      isRemoteUpdate.current = false
      return
    }
    const userRef = ref(db, `users/${user.uid}/stopwatches`)
    set(userRef, stopwatches)
  }, [user, stopwatches, isLoaded])

  useEffect(() => {
    pushToFirebase()
  }, [pushToFirebase])
}
