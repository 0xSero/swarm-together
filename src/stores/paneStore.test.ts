import { describe, it, expect, beforeEach } from 'vitest'
import { usePaneStore } from './paneStore'
import type { PanePosition } from './paneStore'

describe('Pane Store', () => {
  beforeEach(() => {
    // Reset store before each test
    usePaneStore.setState({
      panes: {
        'top-left': {
          id: 'pane-top-left',
          position: 'top-left',
          tabs: [],
          activeTabId: null,
          history: {},
        },
        'top-right': {
          id: 'pane-top-right',
          position: 'top-right',
          tabs: [],
          activeTabId: null,
          history: {},
        },
        'bottom-left': {
          id: 'pane-bottom-left',
          position: 'bottom-left',
          tabs: [],
          activeTabId: null,
          history: {},
        },
        'bottom-right': {
          id: 'pane-bottom-right',
          position: 'bottom-right',
          tabs: [],
          activeTabId: null,
          history: {},
        },
      },
      focusedPane: 'top-left',
      renderMetrics: {
        lastRenderTime: 0,
        frameCount: 0,
        averageRenderTime: 0,
      },
    })
  })

  describe('Tab Management', () => {
    it('should create a new tab', () => {
      const { createTab, panes } = usePaneStore.getState()
      const tabId = createTab('top-left', 'session-1', 'pane-1', 'Test Tab')

      expect(tabId).toBeTruthy()
      expect(panes['top-left'].tabs).toHaveLength(1)
      expect(panes['top-left'].tabs[0].title).toBe('Test Tab')
      expect(panes['top-left'].activeTabId).toBe(tabId)
    })

    it('should set active tab when creating', () => {
      const { createTab, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-left', 'session-1', 'pane-1', 'Tab 2')

      expect(panes['top-left'].activeTabId).toBe(tab2)
      expect(panes['top-left'].tabs).toHaveLength(2)
    })

    it('should remove a tab', () => {
      const { createTab, removeTab, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-left', 'session-1', 'pane-1', 'Tab 2')

      removeTab('top-left', tab1)

      expect(panes['top-left'].tabs).toHaveLength(1)
      expect(panes['top-left'].tabs[0].id).toBe(tab2)
    })

    it('should update active tab when removing current active tab', () => {
      const { createTab, removeTab, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-left', 'session-1', 'pane-1', 'Tab 2')

      // tab2 is active, remove it
      removeTab('top-left', tab2)

      // Should fallback to tab1
      expect(panes['top-left'].activeTabId).toBe(tab1)
    })

    it('should set active tab to null when removing last tab', () => {
      const { createTab, removeTab, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')

      removeTab('top-left', tab1)

      expect(panes['top-left'].activeTabId).toBeNull()
      expect(panes['top-left'].tabs).toHaveLength(0)
    })

    it('should switch active tab', () => {
      const { createTab, setActiveTab, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-left', 'session-1', 'pane-1', 'Tab 2')

      setActiveTab('top-left', tab1)

      expect(panes['top-left'].activeTabId).toBe(tab1)
    })

    it('should update tab title', () => {
      const { createTab, updateTabTitle, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Old Title')

      updateTabTitle('top-left', tab1, 'New Title')

      expect(panes['top-left'].tabs[0].title).toBe('New Title')
    })
  })

  describe('Pane Focus', () => {
    it('should focus a pane', () => {
      const { focusPane, focusedPane } = usePaneStore.getState()

      focusPane('top-right')

      expect(usePaneStore.getState().focusedPane).toBe('top-right')
    })

    it('should focus next pane cyclically', () => {
      const { focusNextPane, focusedPane } = usePaneStore.getState()

      // Start at top-left
      expect(focusedPane).toBe('top-left')

      focusNextPane()
      expect(usePaneStore.getState().focusedPane).toBe('top-right')

      focusNextPane()
      expect(usePaneStore.getState().focusedPane).toBe('bottom-left')

      focusNextPane()
      expect(usePaneStore.getState().focusedPane).toBe('bottom-right')

      focusNextPane()
      expect(usePaneStore.getState().focusedPane).toBe('top-left') // Cycle back
    })

    it('should focus previous pane cyclically', () => {
      const { focusPreviousPane } = usePaneStore.getState()

      // Start at top-left
      focusPreviousPane()
      expect(usePaneStore.getState().focusedPane).toBe('bottom-right') // Wrap around

      focusPreviousPane()
      expect(usePaneStore.getState().focusedPane).toBe('bottom-left')
    })
  })

  describe('Pane Swapping', () => {
    it('should swap two panes', () => {
      const { createTab, swapPanes, panes } = usePaneStore.getState()

      // Create tabs in different panes
      createTab('top-left', 'session-1', 'pane-1', 'TL Tab')
      createTab('top-right', 'session-2', 'pane-2', 'TR Tab')

      swapPanes('top-left', 'top-right')

      const state = usePaneStore.getState()

      // Panes should have swapped positions
      expect(state.panes['top-left'].tabs[0].title).toBe('TR Tab')
      expect(state.panes['top-right'].tabs[0].title).toBe('TL Tab')
    })
  })

  describe('History Management', () => {
    it('should add blocks to history', () => {
      const { createTab, addToHistory, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')

      const block = { id: 'block-1', content: 'Hello', type: 'output' }
      addToHistory('top-left', tab1, block)

      expect(panes['top-left'].history[tab1].blocks).toHaveLength(1)
      expect(panes['top-left'].history[tab1].blocks[0]).toEqual(block)
    })

    it('should maintain separate history per tab', () => {
      const { createTab, addToHistory, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-left', 'session-1', 'pane-1', 'Tab 2')

      addToHistory('top-left', tab1, { id: 'block-1', content: 'Tab 1 content' })
      addToHistory('top-left', tab2, { id: 'block-2', content: 'Tab 2 content' })

      expect(panes['top-left'].history[tab1].blocks).toHaveLength(1)
      expect(panes['top-left'].history[tab2].blocks).toHaveLength(1)
      expect(panes['top-left'].history[tab1].blocks[0].content).toBe('Tab 1 content')
      expect(panes['top-left'].history[tab2].blocks[0].content).toBe('Tab 2 content')
    })

    it('should clear history for a tab', () => {
      const { createTab, addToHistory, clearHistory, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')

      addToHistory('top-left', tab1, { id: 'block-1', content: 'Content' })
      clearHistory('top-left', tab1)

      expect(panes['top-left'].history[tab1].blocks).toHaveLength(0)
    })

    it('should update scroll position', () => {
      const { createTab, updateScrollPosition, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')

      updateScrollPosition('top-left', tab1, 150)

      expect(panes['top-left'].history[tab1].scrollPosition).toBe(150)
    })

    it('should preserve scroll position independently per tab', () => {
      const { createTab, updateScrollPosition, panes } = usePaneStore.getState()
      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-left', 'session-1', 'pane-1', 'Tab 2')

      updateScrollPosition('top-left', tab1, 100)
      updateScrollPosition('top-left', tab2, 200)

      expect(panes['top-left'].history[tab1].scrollPosition).toBe(100)
      expect(panes['top-left'].history[tab2].scrollPosition).toBe(200)
    })
  })

  describe('Render Metrics', () => {
    it('should record render times', () => {
      const { recordRenderTime, renderMetrics } = usePaneStore.getState()

      recordRenderTime(10)
      recordRenderTime(20)
      recordRenderTime(30)

      const state = usePaneStore.getState()

      expect(state.renderMetrics.frameCount).toBe(3)
      expect(state.renderMetrics.lastRenderTime).toBe(30)
      expect(state.renderMetrics.averageRenderTime).toBe(20) // (10 + 20 + 30) / 3
    })

    it('should calculate average render time correctly', () => {
      const { recordRenderTime } = usePaneStore.getState()

      recordRenderTime(5)
      recordRenderTime(15)

      const state = usePaneStore.getState()
      expect(state.renderMetrics.averageRenderTime).toBe(10)
    })

    it('should reset metrics', () => {
      const { recordRenderTime, resetMetrics } = usePaneStore.getState()

      recordRenderTime(10)
      recordRenderTime(20)
      resetMetrics()

      const state = usePaneStore.getState()
      expect(state.renderMetrics.frameCount).toBe(0)
      expect(state.renderMetrics.lastRenderTime).toBe(0)
      expect(state.renderMetrics.averageRenderTime).toBe(0)
    })
  })

  describe('Pane Isolation', () => {
    it('should maintain separate tabs across panes', () => {
      const { createTab, panes } = usePaneStore.getState()

      createTab('top-left', 'session-1', 'pane-1', 'TL Tab')
      createTab('top-right', 'session-2', 'pane-2', 'TR Tab')
      createTab('bottom-left', 'session-3', 'pane-3', 'BL Tab')

      expect(panes['top-left'].tabs).toHaveLength(1)
      expect(panes['top-right'].tabs).toHaveLength(1)
      expect(panes['bottom-left'].tabs).toHaveLength(1)
      expect(panes['bottom-right'].tabs).toHaveLength(0)
    })

    it('should maintain separate history across panes', () => {
      const { createTab, addToHistory, panes } = usePaneStore.getState()

      const tab1 = createTab('top-left', 'session-1', 'pane-1', 'Tab 1')
      const tab2 = createTab('top-right', 'session-2', 'pane-2', 'Tab 2')

      addToHistory('top-left', tab1, { id: 'block-1', content: 'TL content' })
      addToHistory('top-right', tab2, { id: 'block-2', content: 'TR content' })

      expect(panes['top-left'].history[tab1].blocks[0].content).toBe('TL content')
      expect(panes['top-right'].history[tab2].blocks[0].content).toBe('TR content')
    })
  })
})
