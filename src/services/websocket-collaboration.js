// 2026 Real-Time WebSocket Collaboration Server
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';
import chalk from 'chalk';
import { EventEmitter } from 'events';

export class CollaborationServer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.port = options.port || 8765;
        this.host = options.host || '0.0.0.0';
        this.sessions = new Map();
        this.clients = new Map();
        this.server = null;
        this.wss = null;
    }

    async start() {
        this.server = createServer();
        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws, req) => this.#handleConnection(ws, req));

        return new Promise((resolve) => {
            this.server.listen(this.port, this.host, () => {
                console.log(chalk.cyan(`🔗 Collaboration server running on ws://${this.host}:${this.port}`));
                resolve(this);
            });
        });
    }

    #handleConnection(ws, req) {
        const clientId = crypto.randomBytes(8).toString('hex');
        
        this.clients.set(clientId, {
            ws,
            sessionId: null,
            userId: null,
            joined: Date.now(),
        });

        console.log(chalk.gray(`👤 Client connected: ${clientId}`));

        ws.on('message', (data) => this.#handleMessage(clientId, data));
        
        ws.on('close', () => {
            const client = this.clients.get(clientId);
            if (client?.sessionId) {
                this.#broadcastToSession(client.sessionId, {
                    type: 'user_left',
                    userId: client.userId,
                }, clientId);
            }
            this.clients.delete(clientId);
            console.log(chalk.gray(`👤 Client disconnected: ${clientId}`));
        });

        ws.on('error', (err) => {
            console.error(chalk.red(`WebSocket error: ${err.message}`));
        });

        // Send welcome
        this.#send(clientId, { type: 'connected', clientId });
    }

    #handleMessage(clientId, data) {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            return;
        }

        switch (msg.type) {
            case 'join_session':
                this.#handleJoinSession(clientId, msg);
                break;
            case 'create_session':
                this.#handleCreateSession(clientId, msg);
                break;
            case 'chat':
            case 'message':
                this.#handleChat(clientId, msg);
                break;
            case 'code_sync':
                this.#handleCodeSync(clientId, msg);
                break;
            case 'cursor':
                this.#handleCursor(clientId, msg);
                break;
            case 'execute':
                this.#handleExecute(clientId, msg);
                break;
            case 'terminal':
                this.#handleTerminal(clientId, msg);
                break;
            case 'presence':
                this.#handlePresence(clientId, msg);
                break;
            default:
                console.log(chalk.yellow(`Unknown message type: ${msg.type}`));
        }
    }

    #handleCreateSession(clientId, msg) {
        const sessionId = crypto.randomBytes(6).toString('hex');
        const session = {
            id: sessionId,
            name: msg.name || 'Untitled Session',
            created: Date.now(),
            clients: new Set([clientId]),
            state: {
                code: '',
                cursor: {},
                files: {},
            },
            chat: [],
        };

        this.sessions.set(sessionId, session);
        
        const client = this.clients.get(clientId);
        client.sessionId = sessionId;
        client.userId = msg.userId || 'host';

        this.#send(clientId, {
            type: 'session_created',
            sessionId,
            session: this.#serializeSession(session),
        });

        console.log(chalk.green(`📁 Session created: ${sessionId}`));
    }

    #handleJoinSession(clientId, msg) {
        const session = this.sessions.get(msg.sessionId);
        
        if (!session) {
            this.#send(clientId, { type: 'error', message: 'Session not found' });
            return;
        }

        const client = this.clients.get(clientId);
        client.sessionId = msg.sessionId;
        client.userId = msg.userId || 'guest';

        session.clients.add(clientId);

        // Notify others
        this.#broadcastToSession(msg.sessionId, {
            type: 'user_joined',
            userId: client.userId,
        }, clientId);

        // Send session state to new user
        this.#send(clientId, {
            type: 'session_joined',
            session: this.#serializeSession(session),
            users: this.#getSessionUsers(msg.sessionId),
        });

        console.log(chalk.cyan(`👤 ${client.userId} joined session ${msg.sessionId}`));
    }

    #handleChat(clientId, msg) {
        const client = this.clients.get(clientId);
        if (!client?.sessionId) return;

        const session = this.sessions.get(client.sessionId);
        const chatMsg = {
            id: crypto.randomBytes(4).toString('hex'),
            userId: client.userId,
            content: msg.content,
            timestamp: Date.now(),
        };

        session.chat.push(chatMsg);

        this.#broadcastToSession(client.sessionId, {
            type: 'chat_message',
            message: chatMsg,
        });
    }

    #handleCodeSync(clientId, msg) {
        const client = this.clients.get(clientId);
        if (!client?.sessionId) return;

        const session = this.sessions.get(client.sessionId);
        
        // Update session state
        if (msg.file) {
            session.state.files[msg.file] = msg.code;
        } else {
            session.state.code = msg.code;
        }

        // Broadcast to others (not sender)
        this.#broadcastToSession(client.sessionId, {
            type: 'code_update',
            code: msg.code,
            file: msg.file,
            userId: client.userId,
            version: msg.version || 1,
        }, clientId);
    }

    #handleCursor(clientId, msg) {
        const client = this.clients.get(clientId);
        if (!client?.sessionId) return;

        const session = this.sessions.get(client.sessionId);
        session.state.cursor[client.userId] = {
            line: msg.line,
            column: msg.column,
            selection: msg.selection,
        };

        this.#broadcastToSession(client.sessionId, {
            type: 'cursor_update',
            userId: client.userId,
            position: { line: msg.line, column: msg.column },
        }, clientId);
    }

    #handleExecute(clientId, msg) {
        const client = this.clients.get(clientId);
        if (!client?.sessionId) return;

        // Broadcast execution request
        this.#broadcastToSession(client.sessionId, {
            type: 'execution_request',
            code: msg.code,
            language: msg.language,
            requestedBy: client.userId,
        });

        // Execute locally and broadcast results
        // (In production, would use code sandbox)
        setTimeout(() => {
            this.#broadcastToSession(client.sessionId, {
                type: 'execution_result',
                output: 'Executed: ' + msg.code.substring(0, 50) + '...',
                requestedBy: client.userId,
            });
        }, 100);
    }

    #handleTerminal(clientId, msg) {
        const client = this.clients.get(clientId);
        if (!client?.sessionId) return;

        // Broadcast terminal output to all in session
        this.#broadcastToSession(client.sessionId, {
            type: 'terminal_output',
            data: msg.data,
            userId: client.userId,
        });
    }

    #handlePresence(clientId, msg) {
        const client = this.clients.get(clientId);
        if (!client?.sessionId) return;

        this.#broadcastToSession(client.sessionId, {
            type: 'presence',
            userId: client.userId,
            status: msg.status,
        }, clientId);
    }

    #broadcastToSession(sessionId, message, excludeClientId = null) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const msgStr = JSON.stringify(message);

        for (const clientId of session.clients) {
            if (clientId === excludeClientId) continue;
            
            const client = this.clients.get(clientId);
            if (client?.ws.readyState === WebSocket.OPEN) {
                client.ws.send(msgStr);
            }
        }
    }

    #send(clientId, message) {
        const client = this.clients.get(clientId);
        if (client?.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }

    #serializeSession(session) {
        return {
            id: session.id,
            name: session.name,
            created: session.created,
            state: session.state,
            userCount: session.clients.size,
        };
    }

    #getSessionUsers(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return [];

        return Array.from(session.clients).map(clientId => {
            const client = this.clients.get(clientId);
            return {
                userId: client.userId,
                joined: client.joined,
            };
        });
    }

    stop() {
        if (this.wss) {
            this.wss.close();
        }
        if (this.server) {
            this.server.close();
        }
        console.log(chalk.yellow('🛑 Collaboration server stopped'));
    }
}

// 2026: Client-side WebSocket manager
export class CollaborationClient extends EventEmitter {
    constructor(options = {}) {
        super();
        this.url = options.url || 'ws://localhost:8765';
        this.userId = options.userId || 'user_' + crypto.randomBytes(4).toString('hex');
        this.ws = null;
        this.sessionId = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                console.log('🔗 Connected to collaboration server');
                resolve();
            });

            this.ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                this.#handleMessage(msg);
            });

            this.ws.on('close', () => {
                this.emit('disconnected');
            });

            this.ws.on('error', (err) => {
                reject(err);
            });
        });
    }

    #handleMessage(msg) {
        switch (msg.type) {
            case 'connected':
                this.clientId = msg.clientId;
                break;
            case 'session_created':
            case 'session_joined':
                this.sessionId = msg.sessionId;
                this.emit('session_joined', msg);
                break;
            case 'chat_message':
                this.emit('chat', msg.message);
                break;
            case 'code_update':
                this.emit('code_update', msg);
                break;
            case 'cursor_update':
                this.emit('cursor', msg);
                break;
            case 'terminal_output':
                this.emit('terminal', msg);
                break;
            case 'user_joined':
            case 'user_left':
                this.emit('presence', msg);
                break;
        }
    }

    createSession(name) {
        this.send({ type: 'create_session', name, userId: this.userId });
    }

    joinSession(sessionId) {
        this.send({ type: 'join_session', sessionId, userId: this.userId });
    }

    sendCode(code, file = null, version = 1) {
        this.send({ type: 'code_sync', code, file, version });
    }

    sendCursor(line, column, selection = null) {
        this.send({ type: 'cursor', line, column, selection });
    }

    sendChat(content) {
        this.send({ type: 'chat', content });
    }

    execute(code, language = 'javascript') {
        this.send({ type: 'execute', code, language });
    }

    sendTerminal(data) {
        this.send({ type: 'terminal', data });
    }

    setPresence(status) {
        this.send({ type: 'presence', status });
    }

    send(message) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    disconnect() {
        this.ws?.close();
    }
}

export function createCollaborationServer(options) {
    return new CollaborationServer(options);
}

export default CollaborationServer;
