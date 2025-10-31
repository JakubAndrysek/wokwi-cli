// SPDX-License-Identifier: MIT
// Main exports for wokwi-cli library usage

export { APIClient } from './APIClient.js';
export { MessagePortTransport } from './transport/MessagePortTransport.js';
export { WebSocketTransport } from './transport/WebSocketTransport.js';
export type { ITransport } from './transport/AbstractTransport.js';

export type {
  APIError,
  APIHello,
  APICommand,
  APIResponse,
  APIEvent,
  APISimStartParams,
  PinReadResponse,
  SerialMonitorDataPayload,
  ChipsLogPayload,
} from './APITypes.js';
