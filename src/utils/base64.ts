// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2025 CodeMagic LTD

const b64dict = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToByteArray(base64str: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Node.js:
    return Uint8Array.from(Buffer.from(base64str, 'base64'));
  } else {
    // Browser:
    return Uint8Array.from(atob(base64str), (c) => c.charCodeAt(0));
  }
}


export function byteArrayToBase64(bufArr: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    // Node.js:
    return Buffer.from(bufArr).toString('base64');
  } else {
    // Browser:
    const buf = new Uint8Array(bufArr);
    let result = '';
    for (let i = 0; i < buf.length - 2; i += 3) {
      result += b64dict[buf[i] >> 2];
      result += b64dict[((buf[i] & 0x03) << 4) | (buf[i + 1] >> 4)];
      result += b64dict[((buf[i + 1] & 0x0f) << 2) | (buf[i + 2] >> 6)];
      result += b64dict[buf[i + 2] & 0x3f];
    }
    if (buf.length % 3 === 1) {
      result += b64dict[buf[buf.length - 1] >> 2];
      result += b64dict[(buf[buf.length - 1] & 0x03) << 4];
      result += '==';
    }
    if (buf.length % 3 === 2) {
      result += b64dict[buf[buf.length - 2] >> 2];
      result += b64dict[((buf[buf.length - 2] & 0x03) << 4) | (buf[buf.length - 1] >> 4)];
      result += b64dict[(buf[buf.length - 1] & 0x0f) << 2];
      result += '=';
    }
    return result;
  }
}
