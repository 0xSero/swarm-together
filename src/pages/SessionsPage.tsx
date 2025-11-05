import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import SessionList from '../components/SessionList'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function SessionsPage() {
  const [sessions, setSessions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const result = await invoke<string[]>('cmd_list_sessions')
      setSessions(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
      console.error('Error loading sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async () => {
    try {
      const name = `Session ${Date.now()}`
      await invoke('cmd_create_session', { name })
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-text-muted mt-1">Manage your coding agent sessions</p>
        </div>
        <Button onClick={handleCreateSession}>Create Session</Button>
      </div>

      {error && (
        <Card className="border-danger">
          <CardHeader>
            <CardTitle className="text-danger">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-text-muted">Loading sessions...</p>
          </CardContent>
        </Card>
      ) : (
        <SessionList sessions={sessions} />
      )}
    </div>
  )
}
