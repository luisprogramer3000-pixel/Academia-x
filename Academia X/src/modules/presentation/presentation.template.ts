import JSZip from "jszip";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { imageTheme, paletteTheme, type DeckTheme } from "./presentation.themes";
import { loadPptxTemplate, type PptxTemplate } from "./pptx-template";

/** Modelo listo para usar: el .pptx se rellena tal cual; el tema se usa para el PDF (o si no hay plantilla). */
export interface ResolvedModel {
  template?: PptxTemplate;
  theme: DeckTheme;
}

function hexLuminance(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tema para el PDF a partir de una plantilla: sus colores y tipografía, con contraste garantizado. */
export function templatePdfTheme(tpl: PptxTemplate): DeckTheme {
  const bg = tpl.palette.background ?? "FFFFFF";
  const readable = (c?: string) => (c && Math.abs(hexLuminance(c) - hexLuminance(bg)) > 0.35 ? c : undefined);
  const text = readable(tpl.palette.text) ?? (hexLuminance(bg) > 0.5 ? "1E293B" : "F8FAFC");
  const title = readable(tpl.palette.title) ?? text;
  return paletteTheme({ background: bg, title, text, accent: title, font: tpl.palette.bodyFont ?? tpl.palette.font });
}

async function resolvePptx(bytes: Uint8Array): Promise<ResolvedModel> {
  try {
    const template = await loadPptxTemplate(bytes);
    return { template, theme: templatePdfTheme(template) };
  } catch {
    // Sin diapositivas de texto reutilizables: se usa su fondo y sus colores
    return { theme: await themeFromPptx(bytes) };
  }
}

export async function resolveUploadedModel(bytes: Uint8Array): Promise<ResolvedModel> {
  if (bytes.length > MAX_PPTX_BYTES) throw new TemplateError("El archivo supera los 36 MB.");
  if (isZip(bytes)) return resolvePptx(bytes);
  return { theme: await themeFromUpload(bytes) };
}

export async function resolveWebModel(url: string): Promise<ResolvedModel> {
  const first = await safeFetch(url.trim());
  if (isZip(first.bytes)) return resolvePptx(first.bytes);
  return { theme: await themeFromUrl(url, first) };
}

/**
 * Modelos personalizados para la presentación:
 *   - imagen (PNG/JPG) → fondo de todas las diapositivas
 *   - .pptx → colores, fuente y fondo del patrón de diapositivas
 *   - enlace web → imagen directa o la imagen principal de la página (og:image)
 */

/** Imágenes: 12 MB. Presentaciones .pptx de Canva: hasta 36 MB (llevan muchas fotos). */
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PPTX_BYTES = 36 * 1024 * 1024;

export class TemplateError extends Error {}

type Img = { data: Uint8Array; mime: "image/png" | "image/jpeg" };

function sniffImage(bytes: Uint8Array): Img | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { data: bytes, mime: "image/png" };
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { data: bytes, mime: "image/jpeg" };
  return null;
}

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

export async function themeFromUpload(bytes: Uint8Array): Promise<DeckTheme> {
  if (bytes.length > MAX_BYTES) throw new TemplateError("El archivo supera los 12 MB.");
  const img = sniffImage(bytes);
  if (img) return imageTheme(img);
  if (isZip(bytes)) return themeFromPptx(bytes);
  throw new TemplateError("Formato no admitido. Sube una imagen PNG o JPG, o una presentación .pptx.");
}

function color(xml: string, tag: string): string | undefined {
  const block = xml.match(new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`))?.[1];
  if (!block) return undefined;
  return (block.match(/srgbClr val="([0-9A-Fa-f]{6})"/)?.[1] ?? block.match(/lastClr="([0-9A-Fa-f]{6})"/)?.[1])?.toUpperCase();
}

async function themeFromPptx(bytes: Uint8Array): Promise<DeckTheme> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new TemplateError("No se pudo leer la presentación.");
  }
  if (!zip.file("ppt/presentation.xml")) throw new TemplateError("El archivo no es una presentación de PowerPoint.");

  const themeXml = (await zip.file("ppt/theme/theme1.xml")?.async("string")) ?? "";
  const colors = {
    accent: color(themeXml, "accent1"),
    text: color(themeXml, "dk1") ?? color(themeXml, "dk2"),
    title: color(themeXml, "dk2") ?? color(themeXml, "accent1"),
    font: themeXml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/)?.[1],
  };

  // Fondo: primero la primera diapositiva, luego el diseño y el patrón
  const candidates = [
    ["ppt/slides/slide1.xml", "ppt/slides/_rels/slide1.xml.rels"],
    ["ppt/slideLayouts/slideLayout1.xml", "ppt/slideLayouts/_rels/slideLayout1.xml.rels"],
    ["ppt/slideMasters/slideMaster1.xml", "ppt/slideMasters/_rels/slideMaster1.xml.rels"],
  ];
  let background: string | undefined;
  for (const [xmlPath, relsPath] of candidates) {
    const xml = await zip.file(xmlPath)?.async("string");
    const bg = xml?.match(/<p:bg>([\s\S]*?)<\/p:bg>/)?.[1];
    if (!bg) continue;
    const rel = bg.match(/r:embed="([^"]+)"/)?.[1];
    if (rel) {
      const rels = (await zip.file(relsPath)?.async("string")) ?? "";
      const target = rels.match(new RegExp(`Id="${rel}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rel}"`))?.[1];
      if (target) {
        const mediaPath = `ppt/${target.replace(/^(\.\.\/)+/, "")}`;
        const media = await zip.file(mediaPath)?.async("uint8array");
        const img = media ? sniffImage(media) : null;
        if (img) return imageTheme(img, colors);
      }
    }
    background ??= bg.match(/srgbClr val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
  }

  return paletteTheme({ ...colors, background });
}

// ─── Web ──────────────────────────────────────────────────────────────────────

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

/** Solo https y solo hosts públicos: evita que el servidor se use para acceder a la red interna. */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TemplateError("El enlace no es válido.");
  }
  if (url.protocol !== "https:") throw new TemplateError("El enlace debe empezar por https://");
  if (url.username || url.password) throw new TemplateError("El enlace no es válido.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new TemplateError("No se puede acceder a ese enlace.");
  return url;
}

export async function safeFetch(raw: string, redirects = 3): Promise<{ bytes: Uint8Array; contentType: string; url: URL }> {
  const url = await assertPublicUrl(raw);
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AcademiaX-TemplateFetcher/1.0)", Accept: "text/html,image/png,image/jpeg,*/*;q=0.5" },
  });
  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    if (!next || redirects <= 0) throw new TemplateError("El enlace redirige demasiadas veces.");
    return safeFetch(new URL(next, url).toString(), redirects - 1);
  }
  if (!res.ok || !res.body) throw new TemplateError(`La página respondió con error (${res.status}).`);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_PPTX_BYTES) {
      await reader.cancel();
      throw new TemplateError("El recurso del enlace es demasiado grande.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return { bytes, contentType: res.headers.get("content-type") ?? "", url };
}

function metaContent(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']+)["']/i)?.[1];
}

/**
 * Replica un modelo que el profesor encontró en la web: un enlace directo a una
 * imagen, un .pptx, o una página (se toma su imagen principal y su color).
 */
export async function themeFromUrl(raw: string, prefetched?: Awaited<ReturnType<typeof safeFetch>>): Promise<DeckTheme> {
  const first = prefetched ?? (await safeFetch(raw.trim()));

  const img = sniffImage(first.bytes);
  if (img) return imageTheme(img);
  if (isZip(first.bytes)) return themeFromPptx(first.bytes);

  if (!first.contentType.includes("html")) throw new TemplateError("El enlace no es una imagen, una presentación ni una página web.");
  const html = new TextDecoder().decode(first.bytes.slice(0, 600_000));
  const imageUrl = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
  const themeColor = metaContent(html, "theme-color")?.replace("#", "").toUpperCase();
  const accent = themeColor && /^[0-9A-F]{6}$/.test(themeColor) ? themeColor : undefined;

  if (imageUrl) {
    const second = await safeFetch(new URL(imageUrl, first.url).toString());
    const pageImg = sniffImage(second.bytes);
    if (pageImg) return imageTheme(pageImg, { accent });
  }
  if (accent) return paletteTheme({ accent });
  throw new TemplateError("No encontramos un diseño en esa página. Prueba con el enlace directo a la imagen de la plantilla.");
}
