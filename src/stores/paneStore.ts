import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PanePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface Tab {
  id: string
  title: string
  sessionId: string
  paneId: string
}

export interface PaneHistory {
  blocks: any[] // Will be typed with Block from session types
  scrollPosition: number
}

export interface Pane {
  id: string
  position: PanePosition
  tabs: Tab[]
  activeTabId: string | null
  history: Record<string, PaneHistory> // Keyed by tab ID
}

export interface PaneLayout {
  panes: Record<PanePosition, Pane>
  focusedPane: PanePosition | null
  renderMetrics: {
    lastRenderTime: number
    frameCount: number
    averageRenderTime: number
  }
}

interface PaneActions {
  // Pane management
  createPane: (position: PanePosition) => void
  removePane: (position: PanePosition) => void
  focusPane: (position: PanePosition) => void
  swapPanes: (pos1: PanePosition, pos2: PanePosition) => void

  // Tab management
  createTab: (position: PanePosition, sessionId: string, paneId: string, title?: string) => string
  removeTab: (position: PanePosition, tabId: string) => void
  setActiveTab: (position: PanePosition, tabId: string) => void
  updateTabTitle: (position: PanePosition, tabId: string, title: string) => void

  // History management
  addToHistory: (position: PanePosition, tabId: string, block: any) => void
  clearHistory: (position: PanePosition, tabId: string) => void
  updateScrollPosition: (position: PanePosition, tabId: string, scrollPosition: number) => void

  // Metrics
  recordRenderTime: (time: number) => void
  resetMetrics: () => void

  // Navigation
  focusNextPane: () => void
  focusPreviousPane: () => void
}

type PaneStore = PaneLayout & PaneActions

const PANE_POSITIONS: PanePosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

const createEmptyPane = (position: PanePosition): Pane => ({
  id: `pane-${position}-${Date.now()}`,
  position,
  tabs: [],
  activeTabId: null,
  history: {},
})

const initialState: PaneLayout = {
  panes: {
    'top-left': createEmptyPane('top-left'),
    'top-right': createEmptyPane('top-right'),
    'bottom-left': createEmptyPane('bottom-left'),
    'bottom-right': createEmptyPane('bottom-right'),
  },
  focusedPane: 'top-left',
  renderMetrics: {
    lastRenderTime: 0,
    frameCount: 0,
    averageRenderTime: 0,
  },
}

export const usePaneStore = create<PaneStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Pane management
      createPane: (position) => {
        set((state) => ({
          panes: {
            ...state.panes,
            [position]: createEmptyPane(position),
          },
        }))
      },

      removePane: (position) => {
        set((state) => ({
          panes: {
            ...state.panes,
            [position]: createEmptyPane(position),
          },
          focusedPane: state.focusedPane === position ? 'top-left' : state.focusedPane,
        }))
      },

      focusPane: (position) => {
        set({ focusedPane: position })
      },

      swapPanes: (pos1, pos2) => {
        set((state) => {
          const pane1 = { ...state.panes[pos1], position: pos2 }
          const pane2 = { ...state.panes[pos2], position: pos1 }

          return {
            panes: {
              ...state.panes,
              [pos1]: pane2,
              [pos2]: pane1,
            },
          }
        })
      },

      // Tab management
      createTab: (position, sessionId, paneId, title = 'New Tab') => {
        const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        set((state) => {
          const pane = state.panes[position]
          const newTab: Tab = {
            id: tabId,
            title,
            sessionId,
            paneId,
          }

          return {
            panes: {
              ...state.panes,
              [position]: {
                ...pane,
                tabs: [...pane.tabs, newTab],
                activeTabId: tabId,
                history: {
                  ...pane.history,
                  [tabId]: { blocks: [], scrollPosition: 0 },
                },
              },
            },
          }
        })

        return tabId
      },

      removeTab: (position, tabId) => {
        set((state) => {
          const pane = state.panes[position]
          const newTabs = pane.tabs.filter((t) => t.id !== tabId)
          const newHistory = { ...pane.history }
          delete newHistory[tabId]

          const newActiveTabId =
            pane.activeTabId === tabId
              ? newTabs.length > 0
                ? newTabs[newTabs.length - 1].id
                : null
              : pane.activeTabId

          return {
            panes: {
              ...state.panes,
              [position]: {
                ...pane,
                tabs: newTabs,
                activeTabId: newActiveTabId,
                history: newHistory,
              },
            },
          }
        })
      },

      setActiveTab: (position, tabId) => {
        set((state) => ({
          panes: {
            ...state.panes,
            [position]: {
              ...state.panes[position],
              activeTabId: tabId,
            },
          },
        }))
      },

      updateTabTitle: (position, tabId, title) => {
        set((state) => {
          const pane = state.panes[position]
          const newTabs = pane.tabs.map((t) =>
            t.id === tabId ? { ...t, title } : t
          )

          return {
            panes: {
              ...state.panes,
              [position]: {
                ...pane,
                tabs: newTabs,
              },
            },
          }
        })
      },

      // History management
      addToHistory: (position, tabId, block) => {
        set((state) => {
          const pane = state.panes[position]
          const history = pane.history[tabId] || { blocks: [], scrollPosition: 0 }

          return {
            panes: {
              ...state.panes,
              [position]: {
                ...pane,
                history: {
                  ...pane.history,
                  [tabId]: {
                    ...history,
                    blocks: [...history.blocks, block],
                  },
                },
              },
            },
          }
        })
      },

      clearHistory: (position, tabId) => {
        set((state) => {
          const pane = state.panes[position]

          return {
            panes: {
              ...state.panes,
              [position]: {
                ...pane,
                history: {
                  ...pane.history,
                  [tabId]: { blocks: [], scrollPosition: 0 },
                },
              },
            },
          }
        })
      },

      updateScrollPosition: (position, tabId, scrollPosition) => {
        set((state) => {
          const pane = state.panes[position]
          const history = pane.history[tabId]

          if (!history) return state

          return {
            panes: {
              ...state.panes,
              [position]: {
                ...pane,
                history: {
                  ...pane.history,
                  [tabId]: {
                    ...history,
                    scrollPosition,
                  },
                },
              },
            },
          }
        })
      },

      // Metrics
      recordRenderTime: (time) => {
        set((state) => {
          const newFrameCount = state.renderMetrics.frameCount + 1
          const newAverage =
            (state.renderMetrics.averageRenderTime * state.renderMetrics.frameCount + time) /
            newFrameCount

          return {
            renderMetrics: {
              lastRenderTime: time,
              frameCount: newFrameCount,
              averageRenderTime: newAverage,
            },
          }
        })
      },

      resetMetrics: () => {
        set({
          renderMetrics: {
            lastRenderTime: 0,
            frameCount: 0,
            averageRenderTime: 0,
          },
        })
      },

      // Navigation
      focusNextPane: () => {
        set((state) => {
          const currentIndex = PANE_POSITIONS.indexOf(state.focusedPane || 'top-left')
          const nextIndex = (currentIndex + 1) % PANE_POSITIONS.length
          return { focusedPane: PANE_POSITIONS[nextIndex] }
        })
      },

      focusPreviousPane: () => {
        set((state) => {
          const currentIndex = PANE_POSITIONS.indexOf(state.focusedPane || 'top-left')
          const prevIndex =
            currentIndex === 0 ? PANE_POSITIONS.length - 1 : currentIndex - 1
          return { focusedPane: PANE_POSITIONS[prevIndex] }
        })
      },
    }),
    {
      name: 'pane-layout-storage',
      partialize: (state) => ({
        panes: state.panes,
        focusedPane: state.focusedPane,
        // Don't persist metrics
      }),
    }
  )
)
