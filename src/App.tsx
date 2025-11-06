import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './providers/ThemeProvider'
import { Layout } from './components/Layout'
import SessionsPage from './pages/SessionsPage'
import TerminalPage from './pages/TerminalPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <ThemeProvider enableWarnings={import.meta.env.DEV}>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/terminal" replace />} />
            <Route path="terminal" element={<TerminalPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App
