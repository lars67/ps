import WebSocket from 'ws';

export interface PS2Config {
  host: string;
  loginPort: number;
  appPort: number;
  login: string;
  password: string;
  ssl: boolean;
  timeout: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  fragments: Map<number, string>;
}

export function configFromEnv(): PS2Config {
  const login = process.env.PS2_LOGIN;
  const password = process.env.PS2_PASSWORD;
  if (!login || !password) {
    throw new Error('PS2_LOGIN and PS2_PASSWORD environment variables are required');
  }
  return {
    host: process.env.PS2_HOST ?? 'top.softcapital.com',
    loginPort: parseInt(process.env.PS2_LOGIN_PORT ?? '3331'),
    appPort: parseInt(process.env.PS2_APP_PORT ?? '3332'),
    login,
    password,
    ssl: process.env.PS2_SSL !== 'false',
    timeout: parseInt(process.env.PS2_TIMEOUT ?? '30000'),
  };
}

export class PS2Client {
  private config: PS2Config;
  private ws: WebSocket | null = null;
  private pending = new Map<number, PendingRequest>();
  private msgIdCounter = 1;
  private connectingPromise: Promise<void> | null = null;

  constructor(config: PS2Config) {
    this.config = config;
  }

  private proto(): string {
    return this.config.ssl ? 'wss' : 'ws';
  }

  private async doLogin(): Promise<string> {
    const url = `${this.proto()}://${this.config.host}:${this.config.loginPort}`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { rejectUnauthorized: false });
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('Login timed out'));
      }, this.config.timeout);

      ws.once('open', () => {
        ws.send(JSON.stringify({
          cmd: 'login',
          login: this.config.login,
          password: this.config.password,
        }));
      });

      ws.once('message', (raw) => {
        clearTimeout(timer);
        ws.close();
        try {
          const msg = JSON.parse(raw.toString()) as { token?: string; error?: string };
          if (msg.error) return reject(new Error(msg.error));
          if (msg.token) return resolve(msg.token);
          reject(new Error('Unexpected login response'));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });

      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      const token = await this.doLogin();
      const url = `${this.proto()}://${this.config.host}:${this.config.appPort}/?${token}`;

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url, { rejectUnauthorized: false });
        const timer = setTimeout(() => {
          ws.terminate();
          reject(new Error('App WebSocket connection timed out'));
        }, this.config.timeout);

        ws.once('open', () => {
          clearTimeout(timer);
          this.ws = ws;
          this.connectingPromise = null;
          resolve();
        });

        ws.on('message', (raw) => this.onMessage(raw.toString()));

        ws.once('error', (err) => {
          clearTimeout(timer);
          this.connectingPromise = null;
          reject(err);
        });

        ws.on('close', () => {
          this.ws = null;
          this.connectingPromise = null;
          for (const [, req] of this.pending) {
            clearTimeout(req.timer);
            req.reject(new Error('WebSocket connection closed'));
          }
          this.pending.clear();
        });
      });
    })();

    return this.connectingPromise;
  }

  // Responses arrive as 1024-char JSON fragments: {index, total, data, msgId}
  private onMessage(raw: string): void {
    let fragment: { index?: number; total?: number; data?: string; msgId?: number };
    try {
      fragment = JSON.parse(raw);
    } catch {
      return;
    }

    const { index, total, data, msgId } = fragment;
    if (index == null || total == null || data == null || msgId == null) return;

    const req = this.pending.get(msgId);
    if (!req) return;

    req.fragments.set(index, data);
    if (req.fragments.size < total) return;

    // All fragments received — reassemble in order
    let assembled = '';
    for (let i = 0; i < total; i++) {
      assembled += req.fragments.get(i) ?? '';
    }

    clearTimeout(req.timer);
    this.pending.delete(msgId);

    try {
      const msg = JSON.parse(assembled) as { data?: unknown; error?: string };
      if (msg.error) {
        req.reject(new Error(msg.error));
      } else {
        req.resolve(msg.data !== undefined ? msg.data : msg);
      }
    } catch {
      req.reject(new Error(`Failed to parse response for msgId ${msgId}`));
    }
  }

  async send(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const msgId = this.msgIdCounter++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(msgId);
        reject(new Error(`Command "${command}" timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      this.pending.set(msgId, { resolve, reject, timer, fragments: new Map() });
      this.ws!.send(JSON.stringify({ command, msgId, ...params }));
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
