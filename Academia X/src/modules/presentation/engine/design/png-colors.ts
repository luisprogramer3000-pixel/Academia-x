import { inflateSync } from "zlib";
import { saturation, relativeLuminance } from "./color";

/**
 * Colores dominantes de una imagen PNG (para extraer la paleta real de las
 * ilustraciones de un modelo de Canva, cuyo tema suele ser el de Office por
 * defecto). Decodificador mínimo: 8 bits, sin entrelazado, RGB/RGBA/paleta/gris.
 * Sin dependencias: usa zlib de Node.
 */

interface Decoded {
  width: number;
  height: number;
  pixel: (x: number, y: number) => [number, number, number, number];
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buf: Uint8Array): Decoded | null {
  if (buf.length < 33 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 8;
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= buf.length) {
    const len = view.getUint32(pos);
    const name = String.fromCharCode(buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = buf[pos + 16];
      type = buf[pos + 17];
      interlace = buf[pos + 20];
    } else if (name === "PLTE") palette = data;
    else if (name === "tRNS") trns = data;
    else if (name === "IDAT") idat.push(data);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !width || !height || width * height > 25_000_000) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type as 0 | 2 | 3 | 4 | 6];
  if (!channels) return null;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat.map((d) => Buffer.from(d))));
  } catch {
    return null;
  }
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? out[y * stride + i - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + i] : 0;
      const ul = y > 0 && i >= channels ? out[(y - 1) * stride + i - channels] : 0;
      const v = line[i] ?? 0;
      out[y * stride + i] = (filter === 0 ? v : filter === 1 ? v + left : filter === 2 ? v + up : filter === 3 ? v + ((left + up) >> 1) : v + paeth(left, up, ul)) & 0xff;
    }
  }
  return {
    width,
    height,
    pixel(x, y) {
      const i = y * stride + x * channels;
      switch (type) {
        case 0: return [out[i], out[i], out[i], 255];
        case 4: return [out[i], out[i], out[i], out[i + 1]];
        case 2: return [out[i], out[i + 1], out[i + 2], 255];
        case 3: {
          const p = out[i];
          return palette ? [palette[p * 3], palette[p * 3 + 1], palette[p * 3 + 2], trns && p < trns.length ? trns[p] : 255] : [0, 0, 0, 0];
        }
        default: return [out[i], out[i + 1], out[i + 2], out[i + 3]];
      }
    },
  };
}

const hex = (r: number, g: number, b: number) => [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

/**
 * Colores saturados dominantes (agrupados) de un PNG, con su peso (0-1).
 * Ignora transparentes, blancos, negros y grises: lo que se busca es la paleta.
 */
export function dominantColors(buf: Uint8Array, max = 4): Array<{ color: string; weight: number }> {
  const img = decodePng(buf);
  if (!img) return [];
  const step = Math.max(1, Math.floor(Math.sqrt((img.width * img.height) / 6000)));
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const [r, g, b, a] = img.pixel(x, y);
      if (a < 128) continue;
      total++;
      const c = hex(r, g, b);
      const lum = relativeLuminance(c);
      if (saturation(c) < 0.3 || lum > 0.85 || lum < 0.02) continue;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
      bk.r += r; bk.g += g; bk.b += b; bk.n++;
      buckets.set(key, bk);
    }
  }
  if (!total) return [];
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((bk) => ({ color: hex(Math.round(bk.r / bk.n), Math.round(bk.g / bk.n), Math.round(bk.b / bk.n)), weight: bk.n / total }))
    .filter((c) => c.weight > 0.01);
}
