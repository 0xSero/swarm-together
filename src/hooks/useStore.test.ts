import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useStore'

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.setState({ sessions: [] })
  })

  it('should initialize with empty sessions', () => {
    const { sessions } = useAppStore.getState()
    expect(sessions).toEqual([])
  })

  it('should add a session', () => {
    const newSession = {
      id: '1',
      name: 'Test Session',
      createdAt: new Date().toISOString(),
    }

    useAppStore.getState().addSession(newSession)

    const { sessions } = useAppStore.getState()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].name).toBe('Test Session')
  })

  it('should remove a session', () => {
    const session = {
      id: '1',
      name: 'Test Session',
      createdAt: new Date().toISOString(),
    }

    useAppStore.getState().addSession(session)
    expect(useAppStore.getState().sessions).toHaveLength(1)

    useAppStore.getState().removeSession('1')
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('should set multiple sessions at once', () => {
    const sessions = [
      { id: '1', name: 'Session 1', createdAt: new Date().toISOString() },
      { id: '2', name: 'Session 2', createdAt: new Date().toISOString() },
    ]

    useAppStore.getState().setSessions(sessions)

    const { sessions: storeSessions } = useAppStore.getState()
    expect(storeSessions).toHaveLength(2)
    expect(storeSessions[0].name).toBe('Session 1')
    expect(storeSessions[1].name).toBe('Session 2')
  })
})
