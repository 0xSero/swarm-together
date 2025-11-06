import * as WebSocket from 'ws';

export interface Session {
    id: string;
    name: string;
    status: string;
}

export interface CommandResult {
    success: boolean;
    message?: string;
    error?: string;
}

export interface StreamEvent {
    event_type: string;
    session_id: string;
    data: any;
    timestamp: string;
}

export class ApiClient {
    private host: string;
    private port: number;
    private token: string;
    private ws: WebSocket | undefined;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;

    constructor(host: string, port: number, token: string) {
        this.host = host;
        this.port = port;
        this.token = token;
    }

    private getBaseUrl(): string {
        return `http://${this.host}:${this.port}/api`;
    }

    private getWsUrl(): string {
        return `ws://${this.host}:${this.port}/api`;
    }

    private async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.getBaseUrl()}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    async createSession(name: string): Promise<Session> {
        return this.fetch('/sessions', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    }

    async listSessions(): Promise<Session[]> {
        return this.fetch('/sessions');
    }

    async getSession(sessionId: string): Promise<Session> {
        return this.fetch(`/sessions/${sessionId}`);
    }

    async executeCommand(command: string, sessionId?: string): Promise<CommandResult> {
        return this.fetch('/commands', {
            method: 'POST',
            body: JSON.stringify({ command, session_id: sessionId })
        });
    }

    async getUsage(): Promise<any> {
        return this.fetch('/usage');
    }

    async connectStream(sessionId: string, onEvent: (event: StreamEvent) => void): Promise<void> {
        const wsUrl = `${this.getWsUrl()}/stream/${sessionId}`;

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            this.ws.on('open', () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const event = JSON.parse(data.toString()) as StreamEvent;
                    onEvent(event);
                } catch (error) {
                    console.error('Failed to parse event:', error);
                }
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('WebSocket disconnected');
                this.handleReconnect(sessionId, onEvent);
            });
        });
    }

    private handleReconnect(sessionId: string, onEvent: (event: StreamEvent) => void): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connectStream(sessionId, onEvent).catch(error => {
                console.error('Reconnect failed:', error);
            });
        }, delay);
    }

    disconnect(): void {
        if (this.ws) {
            this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
            this.ws.close();
            this.ws = undefined;
        }
    }

    getMetrics(): { reconnectAttempts: number } {
        return {
            reconnectAttempts: this.reconnectAttempts
        };
    }
}
