export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function utf8(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

function sha1(input: number[]): number[] {
  const length = Math.ceil((input.length + 9) / 64) * 64;
  const message = new Uint8Array(length);
  message.set(input);
  message[input.length] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(length - 8, Math.floor((input.length * 8) / 2 ** 32));
  view.setUint32(length - 4, (input.length * 8) >>> 0);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) { const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!; w[i] = (x << 1) | (x >>> 31); }
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 || i >= 60 ? b ^ c ^ d : (b & c) | (b & d) | (c & d);
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]!) >>> 0;
      e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = t;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0; h[4] = (h[4]! + e) >>> 0;
  }
  return h.flatMap((word) => [word >>> 24, (word >>> 16) & 255, (word >>> 8) & 255, word & 255]);
}

// RFC 4122 version-5 UUID, identical to Postgres's extensions.uuid_generate_v5(namespace, name).
export function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = namespace.replace(/-/g, "").match(/../g)!.map((pair) => parseInt(pair, 16));
  const bytes = sha1([...namespaceBytes, ...utf8(name)]).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
