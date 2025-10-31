import { type ITransport } from './AbstractTransport.js';

export class MessagePortTransport implements ITransport {
  public onMessage: (message: any) => void = () => {};
  public onClose?: (code: number, reason?: string) => void;
  public onError?: (error: Error) => void;

  private readonly port: MessagePort;

  constructor(port: MessagePort) {
    this.port = port;
    // Set up listener for incoming messages on the port
    this.port.onmessage = (event) => {
      this.onMessage(event.data);
    };
    // Start the port if needed (required if using addEventListener;
    // with onmessage it’s usually started implicitly:contentReference[oaicite:0]{index=0})
    this.port.start();
  }

  async connect(): Promise<void> {
    // MessagePort is ready to use immediately; no handshake needed
  }

  send(message: any): void {
    // Send the message object via postMessage (structured clone)
    this.port.postMessage(message);
  }

  close(): void {
    // Close the message port to clean up
    try {
      this.port.close();
    } catch {}
    // (No specific close event; the port is simply terminated)
  }
}
