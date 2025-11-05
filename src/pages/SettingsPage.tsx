import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-text-muted mt-1">Configure your agent manager</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Application settings and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-text-muted">Settings configuration coming soon...</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connectors</CardTitle>
          <CardDescription>Configure Claude Code, Codex CLI, and Ollama</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-text-muted">Connector configuration coming in Phase 2</p>
        </CardContent>
      </Card>
    </div>
  )
}
