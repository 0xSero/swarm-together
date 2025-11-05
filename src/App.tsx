import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import SessionsPage from './pages/SessionsPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/sessions" replace />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
