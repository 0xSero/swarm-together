interface SessionListProps {
  sessions: string[]
}

export default function SessionList({ sessions }: SessionListProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Sessions</h2>
      {sessions.length === 0 ? (
        <div className="text-center py-8 bg-elevated border border-border rounded-lg">
          <p className="text-text-muted">No sessions yet</p>
          <p className="text-text-muted text-sm mt-2">Create your first session to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <div
              key={session}
              className="bg-elevated border border-border rounded-lg p-4 hover:bg-surface transition-colors cursor-pointer"
            >
              <p className="font-medium">{session}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
