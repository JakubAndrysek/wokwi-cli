import { WebSocket } from 'ws';
import { readVersion } from '../readVersion.js';
import { type ITransport } from './AbstractTransport.js';

const retryDelays = [1000, 2000, 5000, 10000, 20000];

export class WebSocketTransport implements ITransport {
  public onMessage: (message: any) => void = () => {};
  public onClose?: (code: number, reason?: string) => void;
  public onError?: (error: Error) => void;

  private socket: WebSocket;
  private readonly token: string;
  private readonly server: string;
  private connectionAttempts = 0;
  private ignoreClose = false;  // to suppress close events when intentionally closing

  constructor(token: string, server: string) {
    this.token = token;
    this.server = server;
    this.socket = this.createSocket(token, server);
  }

  /** Create a new WebSocket instance with appropriate headers */
  private createSocket(token: string, server: string): WebSocket {
    const { sha, version } = readVersion();
    return new WebSocket(server, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `wokwi-cli/${version} (${sha})`,
      },
    });
  }

  // private async connectSocket(socket: WebSocket) {
  //   await new Promise((resolve, reject) => {
  //     socket.addEventListener('message', ({ data }) => {
  //       if (typeof data === 'string') {
  //         const message = JSON.parse(data);
  //         this.processMessage(message);
  //       } else {
  //         console.error('Unsupported binary message');
  //       }
  //     });
  //     this.socket.addEventListener('open', resolve);
  //     this.socket.on('unexpected-response', (req, res) => {
  //       this.closed = true;
  //       this.socket.close();
  //       const RequestTimeout = 408;
  //       const ServiceUnavailable = 503;
  //       const CfRequestTimeout = 524;
  //       if (
  //         res.statusCode === ServiceUnavailable ||
  //         res.statusCode === RequestTimeout ||
  //         res.statusCode === CfRequestTimeout
  //       ) {
  //         console.warn(
  //           `Connection to ${this.server} failed: ${res.statusMessage ?? ''} (${res.statusCode}).`,
  //         );
  //         resolve(this.retryConnection());
  //       } else {
  //         reject(
  //           new Error(
  //             `Error connecting to ${this.server}: ${res.statusCode} ${res.statusMessage ?? ''}`,
  //           ),
  //         );
  //       }
  //     });
  //     this.socket.addEventListener('error', (event) => {
  //       reject(new Error(`Error connecting to ${this.server}: ${event.message}`));
  //     });
  //     this.socket.addEventListener('close', (event) => {
  //       if (this.closed) {
  //         return;
  //       }

  //       const message = `Connection to ${this.server} closed unexpectedly: code ${event.code}`;
  //       if (this.onError) {
  //         this.onError({ type: 'error', message });
  //       } else {
  //         console.error(message);
  //       }
  //     });
  //   });
  // }

  // private async retryConnection() {
  //   const delay = retryDelays[this.connectionAttempts++];
  //   if (delay == null) {
  //     throw new Error(`Failed to connect to ${this.server}. Giving up.`);
  //   }

  //   console.log(`Will retry in ${delay}ms...`);

  //   await new Promise((resolve) => setTimeout(resolve, delay));

  //   console.log(`Retrying connection to ${this.server}...`);
  //   this.socket = this.createSocket(this.token, this.server);
  //   this.closed = false;
  //   await this.connectSocket(this.socket);
  // }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      // Set up event handlers for the initial connection:
      const handleOpen = () => {
        // Once open, set up ongoing message and close handlers
        this.socket.on('message', (data) => {
          // if (typeof data === 'string') {
          //   const messageObj = JSON.parse(data);
          //   this.onMessage(messageObj);
          // } else {
          //   console.error('Unsupported binary message2' + String(data));
          // }
          // TODO: fix type validation
          const messageObj = JSON.parse(String(data));
          this.onMessage(messageObj);
        });
        this.socket.on('close', (code, reason) => {
          // Only invoke onClose if not intentionally closed internally
          if (!this.ignoreClose) {
            this.onClose?.(code, reason?.toString());
          } else {
            this.ignoreClose = false;
          }
        });
        resolve();
      };

      const handleError = (err: Error) => {
        cleanup();
        reject(new Error(`Error connecting to ${this.server}: ${err.message}`));
      };

      const handleUnexpected = (_req: any, res: any) => {
        // Received an HTTP error during WebSocket upgrade (e.g., 503)
        cleanup();
        const statusCode = res.statusCode;
        const statusMsg = res.statusMessage ?? '';
        // Decide whether to retry based on the status code
        if ([408, 503, 524].includes(statusCode)) {
          const delay = retryDelays[this.connectionAttempts++];
          if (delay != null) {
            console.warn(`Connection to ${this.server} failed: ${statusMsg} (${statusCode}).`);
            console.log(`Will retry in ${delay}ms...`);
            this.ignoreClose = true;      // suppress close-event error logging
            this.socket.close();          // close before retrying
            setTimeout(() => {
              console.log(`Retrying connection to ${this.server}...`);
              // Create a new socket and attempt connection again
              this.socket = this.createSocket(this.token, this.server);
              // Recursively call connect() to attach new handlers and retry
              this.connect().then(resolve).catch(reject);
            }, delay);
            return;  // exit here; resolution will happen in recursive call
          }
          // No more retries left
          reject(new Error(`Failed to connect to ${this.server}. Giving up.`));
        } else {
          // Non-retryable error status
          reject(new Error(`Error connecting to ${this.server}: ${statusCode} ${statusMsg}`));
        }
      };

      // Utility to remove listeners after success/failure to avoid leaks
      const cleanup = () => {
        this.socket.off('open', handleOpen);
        this.socket.off('error', handleError);
        this.socket.off('unexpected-response', handleUnexpected);
      };

      // Attach handlers for this connection attempt
      this.socket.on('open', handleOpen);
      this.socket.on('error', handleError);
      this.socket.on('unexpected-response', handleUnexpected);
    });
  }

  send(message: any): void {
    // WebSocket expects a string or Buffer – send JSON string
    const json = JSON.stringify(message);
    this.socket.send(json);
  }

  close(): void {
    // Mark that a normal close is intentional (to suppress error log)
    this.ignoreClose = true;
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    } else {
      this.socket.terminate();
    }
  }
}
