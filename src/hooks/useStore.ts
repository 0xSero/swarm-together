import { create } from 'zustand'

interface Session {
  id: string
  name: string
  createdAt: string
}

interface AppStore {
  sessions: Session[]
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((state) => ({
    sessions: [...state.sessions, session],
  })),
  removeSession: (id) => set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== id),
  })),
}))
