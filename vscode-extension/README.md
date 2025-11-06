# Agent Manager VS Code Extension

Connect to Agent Manager sessions directly from VS Code.

## Features

- **Connect to Sessions**: Attach to existing Agent Manager sessions or create new ones
- **Stream Output**: Real-time streaming of session output in a dedicated panel
- **Send Commands**: Execute slash commands from VS Code command palette
- **Auto-reconnect**: Automatic reconnection on disconnect

## Commands

- `Agent Manager: Connect to Session` - Connect to or create a session
- `Agent Manager: Disconnect` - Disconnect from current session
- `Agent Manager: Send Command` - Send a slash command to the session
- `Agent Manager: Show Output Panel` - Show the output panel

## Configuration

Configure the extension in your VS Code settings:

```json
{
  "agentManager.apiHost": "127.0.0.1",
  "agentManager.apiPort": 8080,
  "agentManager.apiToken": "dev-token-local",
  "agentManager.autoReconnect": true
}
```

## Usage

1. Start Agent Manager with API Gateway enabled
2. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run "Agent Manager: Connect to Session"
4. Select or create a session
5. View real-time output in the panel
6. Send commands using "Agent Manager: Send Command"

## Requirements

- Agent Manager running with API Gateway (Task 110)
- API accessible at configured host:port

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch for changes
npm run watch

# Package extension
vsce package
```

## Testing

The extension includes integration tests that mock the API server:

```bash
npm test
```

## Status Bar

The extension shows connection status in the status bar:
- `○ Agent Manager` - Disconnected
- `✓ Agent Manager: Connected` - Connected to session

Click the status bar item to connect/disconnect.
