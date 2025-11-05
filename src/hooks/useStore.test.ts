import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../hooks/useStore'

describe('useAppStore', () => {
  beforeEach(() => {
    const store = useAppStore.getState()
    store.setSessions([])
  })

  it('should initialize with empty sessions', () => {
    const store = useAppStore.getState()
    expect(store.sessions).toEqual([])
  })

  it('should add a session', () => {
    const store = useAppStore.getState()
    const newSession = {
      id: '1',
      name: 'Test Session',
      createdAt: new Date().toISOString(),
    }
    store.addSession(newSession)
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].name).toBe('Test Session')
  })

  it('should remove a session', () => {
    const store = useAppStore.getState()
    const session = {
      id: '1',
      name: 'Test Session',
      createdAt: new Date().toISOString(),
    }
    store.addSession(session)
    expect(store.sessions).toHaveLength(1)
    store.removeSession('1')
    expect(store.sessions).toHaveLength(0)
  })
})
