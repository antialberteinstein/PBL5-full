// Convert a base64 JPEG (from expo-camera takePictureAsync) into a
// Uint8Array. React Native's WebSocket transmits Uint8Array (an
// ArrayBufferView) as a binary frame, which is what the backend
// register_stream endpoint expects (`message.get("bytes")`).
//
// Note: we intentionally return a Uint8Array — passing a raw
// ArrayBuffer to ws.send() in RN 0.81 has been observed to send
// the payload as text. Uint8Array is reliable across platforms.

import { Buffer } from "buffer";

export const base64ToBinary = (b64) => {
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
};
