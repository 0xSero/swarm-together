import * as vscode from 'vscode';

export class OutputPanel {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private outputBuffer: string[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'agentManagerOutput',
            'Agent Manager Output',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Send buffered output
        if (this.outputBuffer.length > 0) {
            this.panel.webview.postMessage({
                type: 'output',
                content: this.outputBuffer.join('')
            });
        }
    }

    appendOutput(text: string): void {
        this.outputBuffer.push(text);

        // Keep buffer size reasonable
        if (this.outputBuffer.length > 1000) {
            this.outputBuffer = this.outputBuffer.slice(-500);
        }

        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'output',
                content: text
            });
        }
    }

    clear(): void {
        this.outputBuffer = [];

        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'clear'
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Manager Output</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        #output {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .timestamp {
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
        }
        .error {
            color: var(--vscode-errorForeground);
        }
        .success {
            color: var(--vscode-terminal-ansiGreen);
        }
        .info {
            color: var(--vscode-terminal-ansiCyan);
        }
    </style>
</head>
<body>
    <div id="output"></div>

    <script>
        const vscode = acquireVsCodeApi();
        const outputDiv = document.getElementById('output');

        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'output':
                    const content = message.content;
                    outputDiv.textContent += content;
                    // Auto-scroll to bottom
                    window.scrollTo(0, document.body.scrollHeight);
                    break;

                case 'clear':
                    outputDiv.textContent = '';
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
