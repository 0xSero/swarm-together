import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import { OutputPanel } from './outputPanel';

let apiClient: ApiClient | undefined;
let outputPanel: OutputPanel | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Agent Manager extension is now active');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(circle-outline) Agent Manager';
    statusBarItem.command = 'agent-manager.connect';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Create output panel
    outputPanel = new OutputPanel(context);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-manager.connect', async () => {
            await connectToSession();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agent-manager.disconnect', async () => {
            await disconnect();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agent-manager.sendCommand', async () => {
            await sendCommand();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agent-manager.showOutput', () => {
            outputPanel?.show();
        })
    );
}

async function connectToSession() {
    const config = vscode.workspace.getConfiguration('agentManager');
    const host = config.get<string>('apiHost') || '127.0.0.1';
    const port = config.get<number>('apiPort') || 8080;
    const token = config.get<string>('apiToken') || 'dev-token-local';

    try {
        // Initialize API client
        apiClient = new ApiClient(host, port, token);

        // Get list of sessions
        const sessions = await apiClient.listSessions();

        if (sessions.length === 0) {
            const createNew = await vscode.window.showInformationMessage(
                'No active sessions found. Create a new session?',
                'Create Session',
                'Cancel'
            );

            if (createNew === 'Create Session') {
                const sessionName = await vscode.window.showInputBox({
                    prompt: 'Enter session name',
                    value: `Session ${Date.now()}`
                });

                if (sessionName) {
                    const session = await apiClient.createSession(sessionName);
                    await attachToSession(session.id);
                }
            }
            return;
        }

        // Let user select a session
        const sessionItems = sessions.map(s => ({
            label: s.name,
            description: s.id,
            session: s
        }));

        const selected = await vscode.window.showQuickPick(sessionItems, {
            placeHolder: 'Select a session to attach'
        });

        if (selected) {
            await attachToSession(selected.session.id);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function attachToSession(sessionId: string) {
    if (!apiClient || !outputPanel) {
        return;
    }

    try {
        // Connect to WebSocket stream
        await apiClient.connectStream(sessionId, (event) => {
            // Handle streaming events
            outputPanel?.appendOutput(`[${event.event_type}] ${JSON.stringify(event.data)}\n`);
        });

        // Update status bar
        statusBarItem.text = '$(check) Agent Manager: Connected';
        statusBarItem.command = 'agent-manager.disconnect';

        // Show output panel
        outputPanel.show();

        vscode.window.showInformationMessage(`Connected to session: ${sessionId}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to attach: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function disconnect() {
    if (apiClient) {
        apiClient.disconnect();
        apiClient = undefined;
    }

    statusBarItem.text = '$(circle-outline) Agent Manager';
    statusBarItem.command = 'agent-manager.connect';

    vscode.window.showInformationMessage('Disconnected from Agent Manager');
}

async function sendCommand() {
    if (!apiClient) {
        vscode.window.showWarningMessage('Not connected to a session');
        return;
    }

    const command = await vscode.window.showInputBox({
        prompt: 'Enter command (e.g., /help)',
        placeHolder: '/help'
    });

    if (!command) {
        return;
    }

    try {
        const result = await apiClient.executeCommand(command);

        if (result.success) {
            vscode.window.showInformationMessage(result.message || 'Command executed');
            if (outputPanel) {
                outputPanel.appendOutput(`> ${command}\n${result.message}\n\n`);
            }
        } else {
            vscode.window.showErrorMessage(result.error || 'Command failed');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {
    if (apiClient) {
        apiClient.disconnect();
    }
}
