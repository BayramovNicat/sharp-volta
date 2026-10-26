import { getMattermostSession, onSessionChange } from './session';
import type { WebSocketMessage } from './types';

export class MattermostWebSocketClient {
  private onEvent: (msg: WebSocketMessage) => void;
  private ws: WebSocket | null = null;
  private seq = 1;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  public isConnected = false;

  constructor(onEvent: (msg: WebSocketMessage) => void) {
    this.onEvent = onEvent;

    onSessionChange(() => {
      console.log('[WS] Session refreshed, reconnecting socket gateway...');
      this.reconnectAttempts = 0;
      this.connect();
    });
  }

  connect(): void {
    this.cleanup();

    try {
      const session = getMattermostSession();
      const wsUrl = `${session.baseUrl.replace(/^http/, 'ws')}/api/v4/websocket`;
      console.log(`[WS] Connecting to gateway: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Gateway connected. Authenticating challenge...');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        this.send({
          seq: this.seq++,
          action: 'authentication_challenge',
          data: { token: session.token },
        });

        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WebSocketMessage;
          if (msg.status === 'OK' && msg.seq_reply) {
            if (this.pongTimeout) clearTimeout(this.pongTimeout);
            return;
          }

          if (msg.event && this.onEvent) {
            this.onEvent(msg);
          }
        } catch (err) {
          console.error('[WS] Message parsing error:', err);
        }
      };

      this.ws.onerror = (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[WS] Gateway error:', message);
      };

      this.ws.onclose = () => {
        console.warn('[WS] Gateway disconnected.');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[WS] Setup error:', err);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ seq: this.seq++, action: 'ping', data: {} });
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
        this.pongTimeout = setTimeout(() => {
          console.warn('[WS] Heartbeat timeout (no pong received). Stalled connection, resetting...');
          if (this.ws) {
            try {
              this.ws.close();
            } catch {}
          }
        }, 10000);
      }
    }, 20000);
  }

  private scheduleReconnect(): void {
    this.cleanup();
    this.isConnected = false;
    this.reconnectAttempts++;
    const baseDelay = Math.min(1500 * (1.5 ** (this.reconnectAttempts - 1)), 30000);
    const jitter = Math.random() * 1000;
    const delay = Math.round(baseDelay + jitter);

    console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...`);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  cleanup(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  send(data: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close(): void {
    this.cleanup();
  }
}
