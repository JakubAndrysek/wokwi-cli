import { APIClient } from "../APIClient.js";
import { WebSocketTransport } from "./WebSocketTransport.js";

const DEFAULT_SERVER = process.env.WOKWI_CLI_SERVER ?? 'wss://wokwi.com/api/ws/beta';

export class WebSocketAPIClient extends APIClient {
  constructor(token: string, server: string = DEFAULT_SERVER) {
    const transport = new WebSocketTransport(token, server);
    super(transport);
    // Store server URL for logging in base (optional)
    (this as any).server = server;
  }
}
