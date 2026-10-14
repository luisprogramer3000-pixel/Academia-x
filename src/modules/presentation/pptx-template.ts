import JSZip from "jszip";
import type { DeckSlide } from "./presentation.service";
import type { LessonImage } from "./presentation.images";

/** Hueco de foto del modelo: una foto de ejemplo (JPG grande) que se sustituye por una imagen de la lección */
interface PhotoSlot {
  xml: string;
  w: number;
  h: number;
}

/**
 * Rellena un modelo .pptx (p. ej. exportado de Canva) con el contenido de la
 * lección, conservando su diseño: se duplican las diapositivas del modelo
 * (portada, separador, contenido, cierre) y solo se sustituye el texto.
 * Fondos, ilustraciones, formas, tipografías y colores quedan intactos.
 */

const EMU_PER_PT = 12700;
const SLIDE_CT = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const SLIDE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

interface TextShape {
  xml: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** tamaño de letra máximo, en puntos */
  size: number;
  text: string;
}

interface TemplateSlide {
  path: string;
  relsPath: string;
  xml: string;
  shapes: TextShape[];
  title?: TextShape;
  bodies: TextShape[];
  others: TextShape[];
  /** Columna de etiquetas del modelo (p. ej. una lista a la derecha): se reutiliza para las viñetas */
  listGroup: TextShape[];
  photos: PhotoSlot[];
  hasBackgroundColor?: string;
}

export interface PptxTemplate {
  bytes: Uint8Array;
  slides: TemplateSlide[];
  cover: TemplateSlide;
  section: TemplateSlide;
  /** Diapositivas de contenido sin foto (para texto solo) */
  contents: TemplateSlide[];
  /** Diapositivas de contenido con hueco de foto (para texto + imagen de la lección) */
  photoContents: TemplateSlide[];
  /** Diapositiva con texto + columna de lista (para contenido con muchas viñetas) */
  listSlide?: TemplateSlide;
  closing?: TemplateSlide;
  /** "poor": el modelo no tiene ninguna diapositiva donde quepa texto (solo diagramas o fichas) */
  contentFit: "good" | "poor";
  palette: { background?: string; title?: string; text?: string; font?: string; bodyFont?: string };
  thumbnail?: Uint8Array;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function parseShapes(xml: string): TextShape[] {
  const shapes: TextShape[] = [];
  for (const m of xml.matchAll(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g)) {
    const s = m[0];
    if (!s.includes("<p:txBody>")) continue;
    const text = [...s.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(" ").trim();
    if (!text) continue;
    const off = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = s.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!off || !ext) continue;
    const sizes = [...s.matchAll(/ sz="(\d+)"/g)].map((x) => Number(x[1]) / 100);
    shapes.push({
      xml: s,
      x: Number(off[1]) / EMU_PER_PT, y: Number(off[2]) / EMU_PER_PT,
      w: Number(ext[1]) / EMU_PER_PT, h: Number(ext[2]) / EMU_PER_PT,
      size: sizes.length ? Math.max(...sizes) : 18,
      text,
    });
  }
  return shapes;
}

/**
 * Fotos de ejemplo del modelo. Canva exporta las fotos en JPG y los adornos del
 * diseño en PNG/SVG, así que solo cuentan las imágenes JPG que ocupan al menos
 * un 4 % de la diapositiva: los adornos nunca se tocan.
 */
async function parsePhotos(xml: string, rels: string, slideAreaPt: number): Promise<PhotoSlot[]> {
  const slots: PhotoSlot[] = [];
  // Dentro de un grupo, las medidas van en unidades del grupo: se escalan con ext/chExt
  const groups = [...xml.matchAll(/<p:grpSp>[\s\S]*?<\/p:grpSp>/g)].map((g) => {
    const x = g[0].match(/<p:grpSpPr>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"\/>[\s\S]*?<a:chExt cx="(\d+)" cy="(\d+)"\/>/);
    return {
      start: g.index!, end: g.index! + g[0].length,
      sx: x && Number(x[3]) ? Number(x[1]) / Number(x[3]) : 1,
      sy: x && Number(x[4]) ? Number(x[2]) / Number(x[4]) : 1,
    };
  });
  const scaleAt = (index: number) =>
    groups.filter((g) => index > g.start && index < g.end).reduce((acc, g) => ({ sx: acc.sx * g.sx, sy: acc.sy * g.sy }), { sx: 1, sy: 1 });

  const candidates = [
    ...xml.matchAll(/<p:pic\b[^>]*>[\s\S]*?<\/p:pic>/g),
    ...[...xml.matchAll(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g)].filter((m) => m[0].includes("<a:blipFill") && !/<a:t>[^<]+<\/a:t>/.test(m[0])),
  ];
  for (const m of candidates) {
    const s = m[0];
    const rid = s.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
    const ext = s.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!rid || !ext) continue;
    const target = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    if (!target || !/\.jpe?g$/i.test(target)) continue;
    const { sx, sy } = scaleAt(m.index!);
    const w = (Number(ext[1]) * sx) / EMU_PER_PT;
    const h = (Number(ext[2]) * sy) / EMU_PER_PT;
    const ratio = (w * h) / slideAreaPt;
    // Muy pequeñas: adornos. Casi a pantalla completa: fondo del diseño, se conserva
    if (ratio < 0.01 || ratio > 0.55) continue;
    slots.push({ xml: s, w, h });
  }
  // La imagen de la lección va al hueco más grande
  return slots.sort((a, b) => b.w * b.h - a.w * a.h);
}

/** Recorte (en milésimas de porcentaje) para que la imagen llene el hueco sin deformarse. */
function coverCrop(img: LessonImage, slot: PhotoSlot) {
  const slotRatio = slot.w / slot.h;
  const imgRatio = img.width / img.height;
  if (imgRatio > slotRatio) {
    const side = Math.round(((1 - slotRatio / imgRatio) / 2) * 100000);
    return `<a:srcRect l="${side}" r="${side}"/>`;
  }
  const side = Math.round(((1 - imgRatio / slotRatio) / 2) * 100000);
  return `<a:srcRect t="${side}" b="${side}"/>`;
}

/** Pone la imagen de la lección en el hueco: nueva relación, recorte y sin la versión SVG de la foto original. */
function fillPhoto(slot: PhotoSlot, rid: string, img: LessonImage): string {
  return slot.xml
    // La foto de ejemplo podía venir girada o volteada: la de la lección se muestra derecha
    .replace(/(<a:xfrm\b[^>]*?) rot="-?\d+"/, "$1")
    .replace(/(<a:xfrm\b[^>]*?) flipH="(true|1)"/, '$1 flipH="false"')
    .replace(/(<a:xfrm\b[^>]*?) flipV="(true|1)"/, '$1 flipV="false"')
    .replace(/<a:blip\b([^>]*?)(\/>|>[\s\S]*?<\/a:blip>)/, (_m, attrs: string) => `<a:blip${attrs.replace(/r:embed="[^"]+"/, `r:embed="${rid}"`)}/>`)
    .replace(/<a:srcRect\b[^>]*\/>/g, "")
    .replace(/<a:fillRect\b[^>]*\/>/g, "<a:fillRect/>")
    .replace(/(<a:blip\b[^>]*\/>)/, `$1${coverCrop(img, slot)}`);
}

const area = (s: TextShape) => (s.w * s.h) / 5184; // pulgadas²
const SKIP_TITLE = /teacher resources|gracias|thank|the end|^fin$|índice|indice|agenda|resumen de conten|contenido/i;
const CLOSING = /gracias|thank|the end|^fin$/i;

function classify(slide: TemplateSlide) {
  const sorted = [...slide.shapes].sort((a, b) => b.size - a.size);
  slide.title = sorted[0];
  const rest = sorted.slice(1);
  // Hay modelos con letra de cuerpo muy grande (55-76 pt junto a títulos de 114 pt): el límite depende del título
  // (solo en cuadros grandes: un subtítulo corto como "happy writing!" no es cuerpo)
  const bigBody = (sorted[0]?.size ?? 0) * 0.7;
  slide.bodies = rest.filter((s) => area(s) >= 5 && (s.size <= 45 || (s.size <= bigBody && area(s) >= 20))).sort((a, b) => area(b) - area(a));
  slide.others = rest.filter((s) => !slide.bodies.includes(s));
  const labels = slide.others.filter((s) => s.text.length > 3);
  slide.listGroup = labels.length >= 3 && labels.every((s) => sameColumn(s, labels[0])) && !slide.bodies.some((b) => sameColumn(b, labels[0]))
    ? [...labels].sort((a, b) => a.y - b.y)
    : [];
}

/**
 * Diapositivas que no sirven para contenido: comparativas (varios encabezados
 * grandes, p. ej. "IDEA A vs. IDEA B") o con el título en un cuadro diminuto.
 */
const isComparisonLayout = (s: TemplateSlide) => {
  if (!s.title || area(s.title) < 2.5) return true;
  // Diagramas (Venn, esquemas numerados): letras o números casi tan grandes como el título
  if (s.others.some((o) => o.text.length <= 3 && o.size >= s.title!.size * 0.6)) return true;
  // Encabezado = etiqueta casi tan grande como el título y mayor que el texto del cuerpo (citas o ejemplos del tamaño del cuerpo no cuentan)
  const bodySize = Math.max(0, ...s.bodies.map((b) => b.size));
  return s.others.some((o) => o.text.length > 3 && o.size >= s.title!.size * 0.6 && o.size > bodySize * 1.1);
};

/** Etiquetas sueltas que quedarían vacías al rellenar: cuanto menos, mejor encaja el contenido. */
const leftovers = (s: TemplateSlide) => s.others.filter((o) => o.text.length > 3 && !s.listGroup.includes(o)).length;

export async function loadPptxTemplate(bytes: Uint8Array): Promise<PptxTemplate> {
  const zip = await JSZip.loadAsync(bytes);
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  const presRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!presXml || !presRels) throw new Error("El archivo no es una presentación de PowerPoint válida.");

  const order = [...presXml.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  const sldSz = presXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const slideAreaPt = sldSz ? (Number(sldSz[1]) / EMU_PER_PT) * (Number(sldSz[2]) / EMU_PER_PT) : 960 * 540;
  const slides: TemplateSlide[] = [];
  for (const rid of order) {
    const target = presRels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1]
      ?? presRels.match(new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    if (!target) continue;
    const path = `ppt/${target.replace(/^\/?ppt\//, "")}`;
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const file = path.split("/").pop()!;
    const relsPath = `ppt/slides/_rels/${file}.rels`;
    const slideRels = (await zip.file(relsPath)?.async("string")) ?? "";
    const slide: TemplateSlide = {
      path, relsPath, xml, shapes: parseShapes(xml), bodies: [], others: [], listGroup: [],
      photos: await parsePhotos(xml, slideRels, slideAreaPt),
      hasBackgroundColor: xml.match(/<p:bg>[\s\S]*?srgbClr val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase(),
    };
    classify(slide);
    slides.push(slide);
  }
  const withText = slides.filter((s) => s.title);
  if (!withText.length) throw new Error("El modelo no tiene diapositivas con texto que podamos reutilizar.");

  const cover = withText[0];
  const middle = withText.slice(1).filter((s) => !SKIP_TITLE.test(s.title!.text));
  const closing = withText.slice(1).reverse().find((s) => CLOSING.test(s.title!.text));

  // Contenido: título + 1-2 cuadros de texto, sin etiquetas que queden huérfanas; se prefieren los de un solo cuadro grande
  const withBodies = middle.filter((s) => s.bodies.length >= 1 && s.bodies.length <= 2 && !isComparisonLayout(s));
  const listSlide = withBodies.find((s) => s.listGroup.length >= 3);
  const ranked = withBodies
    .filter((s) => s !== listSlide)
    .sort((a, b) => (leftovers(a) - leftovers(b)) || (a.bodies.length - b.bodies.length) || (area(b.bodies[0]) - area(a.bodies[0])));
  // Más de 3 etiquetas por quitar: es una ficha o un esquema, no una diapositiva de texto
  const clean = ranked.filter((s) => leftovers(s) <= 3);
  const photoContents = clean.filter((s) => s.photos.length > 0).slice(0, 2);
  const plain = clean.filter((s) => s.photos.length === 0).slice(0, 2);
  const contents = plain.length ? plain : photoContents;
  const section = middle.find((s) => s.bodies.length === 0 && s.title!.size >= 90) ?? cover;

  const titleRun = cover.title!.xml;
  const bodySample = (contents[0]?.bodies[0] ?? cover.others[0])?.xml ?? "";
  const palette = {
    background: cover.hasBackgroundColor ?? contents[0]?.hasBackgroundColor,
    title: titleRun.match(/<a:rPr[^>]*>[\s\S]*?srgbClr val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase(),
    text: bodySample.match(/<a:rPr[^>]*>[\s\S]*?srgbClr val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase(),
    font: titleRun.match(/<a:latin typeface="([^"]+)"/)?.[1],
    bodyFont: bodySample.match(/<a:latin typeface="([^"]+)"/)?.[1],
  };

  return {
    bytes,
    slides,
    cover,
    section,
    contents: contents.length ? contents : listSlide ? [listSlide] : [cover],
    contentFit: contents.length || listSlide ? "good" : "poor",
    photoContents,
    listSlide,
    closing,
    palette,
    thumbnail: await zip.file("docProps/thumbnail.jpeg")?.async("uint8array"),
  };
}

// ─── Texto ────────────────────────────────────────────────────────────────────

/** Tamaño de letra que hace caber el texto en el cuadro (estimación por ancho medio de carácter). */
function fitSize(paragraphs: string[], w: number, h: number, maxSize: number, minSize: number): number {
  // La palabra más larga debe caber en una línea: si no, PowerPoint la parte ("Concept / os")
  const longestWord = Math.max(1, ...paragraphs.flatMap((p) => p.split(/\s+/)).map((word) => word.length));
  for (let size = maxSize; size > minSize; size -= Math.max(1, size * 0.06)) {
    if (longestWord * size * 0.6 > w) continue;
    const perLine = Math.max(4, Math.floor(w / (size * 0.56)));
    const lines = paragraphs.reduce((acc, p) => acc + Math.max(1, Math.ceil(p.length / perLine)), 0);
    if (lines * size * 1.3 <= h * 0.95) return Math.round(size);
  }
  return Math.round(minSize);
}

/** Cuántos caracteres caben en un cuadro con un tamaño de letra dado. */
export function capacity(shape: { w: number; h: number }, size: number): number {
  const perLine = Math.floor(shape.w / (size * 0.56));
  const lines = Math.floor((shape.h * 0.95) / (size * 1.3));
  return Math.max(60, perLine * lines);
}

/** Sustituye el texto de una forma conservando el estilo de su primer párrafo y su primera letra. */
function setShapeText(shape: TextShape, paragraphs: Array<{ text: string; bullet?: boolean }>, size?: number): string {
  const body = shape.xml.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/)?.[1] ?? "";
  const bodyPr = body.match(/<a:bodyPr\b[^>]*\/>|<a:bodyPr\b[^>]*>[\s\S]*?<\/a:bodyPr>/)?.[0] ?? "<a:bodyPr/>";
  const lstStyle = body.match(/<a:lstStyle\/>|<a:lstStyle>[\s\S]*?<\/a:lstStyle>/)?.[0] ?? "<a:lstStyle/>";
  const firstP = body.match(/<a:p>[\s\S]*?<\/a:p>/)?.[0] ?? "";
  const pPr = firstP.match(/<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/)?.[0] ?? "";
  let rPr = firstP.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/)?.[0] ?? '<a:rPr lang="es-ES"/>';
  if (size) {
    const original = Number(rPr.match(/ sz="(\d+)"/)?.[1] ?? 0) / 100;
    rPr = / sz="\d+"/.test(rPr) ? rPr.replace(/ sz="\d+"/, ` sz="${size * 100}"`) : rPr.replace("<a:rPr", `<a:rPr sz="${size * 100}"`);
    // El espaciado entre letras del modelo se escala con la letra, si no se montan
    if (original) rPr = rPr.replace(/ spc="(-?\d+)"/, (_m, spc: string) => ` spc="${Math.round((Number(spc) * size) / original)}"`);
  }
  rPr = rPr.replace(/ lang="[^"]*"/, ' lang="es-ES"');

  const bulletPPr = (() => {
    const attrs = (pPr.match(/<a:pPr\b([^>]*?)\/?>/)?.[1] ?? "").replace(/ (algn|marL|indent)="[^"]*"/g, "");
    const inner = pPr.match(/<a:pPr\b[^>]*>([\s\S]*?)<\/a:pPr>/)?.[1]?.replace(/<a:bu\w+[^>]*\/>|<a:bu\w+[^>]*>[\s\S]*?<\/a:bu\w+>/g, "") ?? "";
    return `<a:pPr${attrs} algn="l" marL="342900" indent="-342900">${inner}<a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>`;
  })();

  const ps = (paragraphs.length ? paragraphs : [{ text: "" }])
    .map((p) => `<a:p>${p.bullet ? bulletPPr : pPr}${p.text ? `<a:r>${rPr}<a:t>${esc(p.text)}</a:t></a:r>` : ""}<a:endParaRPr lang="es-ES"/></a:p>`)
    .join("");
  const newBody = `<p:txBody>${bodyPr}${lstStyle}${ps}</p:txBody>`;
  return shape.xml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, () => newBody);
}

/** Une varios cuadros de texto de la misma columna en uno solo que ocupa su espacio. */
function mergeColumn(shapes: TextShape[]): { merged: TextShape; removed: TextShape[] } {
  const [first, ...rest] = shapes;
  const x = Math.min(...shapes.map((s) => s.x));
  const y = Math.min(...shapes.map((s) => s.y));
  const w = Math.max(...shapes.map((s) => s.x + s.w)) - x;
  const h = Math.max(...shapes.map((s) => s.y + s.h)) - y;
  const xml = first.xml
    .replace(/<a:off x="-?\d+" y="-?\d+"/, `<a:off x="${Math.round(x * EMU_PER_PT)}" y="${Math.round(y * EMU_PER_PT)}"`)
    .replace(/<a:ext cx="\d+" cy="\d+"/, `<a:ext cx="${Math.round(w * EMU_PER_PT)}" cy="${Math.round(h * EMU_PER_PT)}"`);
  return { merged: { ...first, xml, x, y, w, h }, removed: rest };
}

function sameColumn(a: TextShape, b: TextShape) {
  const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  return overlap > Math.min(a.w, b.w) * 0.5;
}

/** Capacidad de texto de la diapositiva de contenido principal (para repartir el contenido). */
export function contentCapacity(tpl: PptxTemplate): number {
  const slide = tpl.contents[0];
  if (!slide.bodies.length) return 300;
  const bodies = slide.bodies.length === 2 && sameColumn(slide.bodies[0], slide.bodies[1]) ? [mergeColumn(slide.bodies).merged] : slide.bodies;
  // Tope de 32 pt: en modelos con letra de cuerpo enorme, el texto se reduce en vez de partirse en muchas diapositivas
  return bodies.reduce((acc, b) => acc + capacity(b, Math.min(32, Math.max(14, b.size * 0.8))), 0);
}

/**
 * Rellena una diapositiva del modelo: texto de la lección y, en el primer hueco
 * de foto, su imagen. Las demás fotos de ejemplo del modelo se quitan: en la
 * presentación solo aparece contenido de la lección.
 */
function fillSlide(
  slide: TemplateSlide,
  content: DeckSlide,
  role: "cover" | "section" | "content" | "closing",
  photo?: { rid: string; img: LessonImage }
): string {
  let xml = fillText(slide, content, role);
  slide.photos.forEach((slot, i) => {
    xml = xml.replace(slot.xml, () => (i === 0 && photo ? fillPhoto(slot, photo.rid, photo.img) : ""));
  });
  // PowerPoint no abre archivos con grupos vacíos (p. ej. una foto que estaba sola en su grupo)
  // Patrón "templado": cada parte no puede saltar más allá de su propia etiqueta de cierre,
  // así nunca abarca desde un grupo con contenido hasta otro vacío
  const emptyGroup =
    /<p:grpSp>\s*<p:nvGrpSpPr>(?:(?!<\/p:nvGrpSpPr>)[\s\S])*<\/p:nvGrpSpPr>\s*<p:grpSpPr\b(?:[^>]*\/>|[^>]*>(?:(?!<\/p:grpSpPr>)[\s\S])*<\/p:grpSpPr>)\s*<\/p:grpSp>/g;
  for (let prev = ""; prev !== xml; ) {
    prev = xml;
    xml = xml.replace(emptyGroup, "");
  }
  return xml;
}

function fillText(slide: TemplateSlide, content: DeckSlide, role: "cover" | "section" | "content" | "closing"): string {
  let xml = slide.xml;
  const replace = (shape: TextShape, next: string) => { xml = xml.replace(shape.xml, () => next); };
  const remove = (shape: TextShape) => { xml = xml.replace(shape.xml, ""); };
  const title = slide.title!;

  const titleText = content.title;
  replace(title, setShapeText(title, [{ text: titleText }], fitSize([titleText], title.w, title.h, title.size, Math.min(title.size, 20))));

  if (role === "cover" || role === "section" || role === "closing") {
    // Textos secundarios de la portada: curso y academia; el resto (handles, webs…) se vacían
    const extras = role === "cover" ? [content.body, content.footnote] : role === "section" ? [content.footnote?.toUpperCase(), content.body] : [content.footnote];
    const secondary = [...slide.bodies, ...slide.others].sort((a, b) => b.size - a.size);
    secondary.forEach((shape, i) => {
      const text = extras[i];
      if (text) replace(shape, setShapeText(shape, [{ text }], fitSize([text], shape.w, shape.h, shape.size, Math.min(shape.size, 12))));
      else remove(shape);
    });
    return xml;
  }

  // Contenido: cuerpo en el/los cuadros del modelo
  let paragraphs: Array<{ text: string; bullet?: boolean }> = [
    ...(content.body ? content.body.split(/\n{2,}/).map((t) => ({ text: t.replace(/\n/g, " ") })) : []),
    ...(content.bullets ?? []).map((b) => ({ text: b, bullet: content.kind !== "quiz" })),
  ];

  // Columna de lista del modelo: ahí van las viñetas, con su mismo estilo (sin símbolo)
  if (slide.listGroup.length && content.bullets?.length) {
    const { merged, removed } = mergeColumn(slide.listGroup);
    const items = content.bullets.map((text) => ({ text }));
    // Cada punto en una sola línea si es posible, como las etiquetas del modelo
    const longest = Math.max(...items.map((i) => i.text.length));
    const oneLine = merged.w / (0.52 * longest);
    const max = Math.max(14, Math.min(slide.listGroup[0].size, oneLine));
    replace(slide.listGroup[0], setShapeText(merged, items, fitSize(items.map((i) => i.text), merged.w, merged.h, max, 12)));
    removed.forEach(remove);
    paragraphs = paragraphs.filter((p) => !p.bullet);
    if (!paragraphs.length) paragraphs = [{ text: "" }];
  } else {
    slide.listGroup.forEach(remove);
  }

  let bodies = slide.bodies;
  if (bodies.length === 2 && sameColumn(bodies[0], bodies[1])) {
    const { merged, removed } = mergeColumn(bodies);
    replace(bodies[0], merged.xml);
    removed.forEach(remove);
    bodies = [merged];
  }

  if (bodies.length === 1) {
    const b = bodies[0];
    replace(b, setShapeText(b, paragraphs, fitSize(paragraphs.map((p) => p.text), b.w, b.h, b.size, Math.min(b.size, 11))));
  } else if (bodies.length === 2) {
    // Dos columnas: el texto en la primera y las viñetas en la segunda (o mitad y mitad)
    const texts = paragraphs.filter((p) => !p.bullet);
    const bullets = paragraphs.filter((p) => p.bullet);
    let [left, right] = texts.length && bullets.length
      ? [texts, bullets]
      : [paragraphs.slice(0, Math.ceil(paragraphs.length / 2)), paragraphs.slice(Math.ceil(paragraphs.length / 2))];
    // Un solo párrafo largo: se reparte por frases para no dejar una columna vacía (una frase corta no se corta)
    if (!right.length && left.length === 1 && left[0].text.length > 140) {
      const sentences = left[0].text.match(/[^.!?]+[.!?]*\s*/g) ?? [left[0].text];
      if (sentences.length > 1) {
        const half = Math.ceil(sentences.length / 2);
        left = [{ text: sentences.slice(0, half).join("").trim() }];
        right = [{ text: sentences.slice(half).join("").trim() }];
      }
    }
    const size = Math.min(
      fitSize(left.map((p) => p.text), bodies[0].w, bodies[0].h, bodies[0].size, Math.min(bodies[0].size, 11)),
      fitSize(right.map((p) => p.text), bodies[1].w, bodies[1].h, bodies[1].size, Math.min(bodies[1].size, 11))
    );
    replace(bodies[0], setShapeText(bodies[0], left, size));
    replace(bodies[1], setShapeText(bodies[1], right, size));
  }

  // Números o letras decorativos (1, 2, A…) se conservan; etiquetas y textos de ejemplo se quitan
  slide.others.filter((s) => s.text.length > 3 && !slide.listGroup.includes(s)).forEach(remove);
  return xml;
}

/**
 * Reparte el contenido para que quepa en los cuadros del modelo: una
 * diapositiva con demasiado texto se divide en varias ("Título (1/2)").
 */
export function splitForCapacity(deck: DeckSlide[], cap: number, hasListColumn = false): DeckSlide[] {
  const out: DeckSlide[] = [];
  for (const slide of deck) {
    if (slide.kind !== "content") { out.push(slide); continue; }

    // Con columna de lista en el modelo, las viñetas van aparte y acompañan a la última parte del texto
    const listBullets = hasListColumn && (slide.bullets?.length ?? 0) >= 3 ? slide.bullets!.slice(0, 10) : null;
    if (listBullets) {
      const textOnly = splitForCapacity([{ ...slide, bullets: undefined }], cap)
        .map((s) => ({ ...s, bullets: undefined as string[] | undefined }));
      textOnly[textOnly.length - 1].bullets = listBullets;
      out.push(...textOnly);
      continue;
    }

    const items: Array<{ text: string; bullet: boolean }> = [
      ...(slide.body ? slide.body.split(/\n{2,}/) : []).flatMap((p) =>
        p.length <= cap ? [p] : (p.match(/[^.!?]+[.!?]*\s*/g) ?? [p]).reduce<string[]>((acc, s) => {
          if (acc.length && (acc[acc.length - 1] + s).length <= cap) acc[acc.length - 1] += s;
          else acc.push(s);
          return acc;
        }, [])
      ).map((t) => ({ text: t.trim(), bullet: false })),
      ...(slide.bullets ?? []).map((b) => ({ text: b, bullet: true })),
    ];
    const pages: typeof items[] = [];
    let current: typeof items = [];
    let size = 0;
    for (const item of items) {
      const cost = item.text.length + (item.bullet ? 20 : 40);
      if (current.length && size + cost > cap) { pages.push(current); current = []; size = 0; }
      current.push(item);
      size += cost;
    }
    if (current.length) pages.push(current);
    if (pages.length <= 1) { out.push(slide); continue; }
    const base = slide.title.replace(/\s*\(\d+\/\d+\)$/, "");
    pages.forEach((page, i) => {
      out.push({
        kind: "content",
        image: i === 0 ? slide.image : undefined,
        title: `${base} (${i + 1}/${pages.length})`,
        body: page.filter((p) => !p.bullet).map((p) => p.text).join("\n\n") || undefined,
        bullets: page.filter((p) => p.bullet).map((p) => p.text),
      });
    });
  }
  return out;
}

/** Genera el .pptx final a partir del modelo y del guion de diapositivas. */
export async function fillPptxTemplate(
  tpl: PptxTemplate,
  deck: DeckSlide[],
  images: Map<string, LessonImage> = new Map()
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(tpl.bytes);

  // 1. Quitar las diapositivas originales
  const oldSlides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/(_rels\/)?slide\d+\.xml(\.rels)?$/.test(f));
  const sourceRels = new Map<string, string>();
  for (const s of tpl.slides) sourceRels.set(s.path, (await zip.file(s.relsPath)?.async("string")) ?? "");
  oldSlides.forEach((f) => zip.remove(f));

  // 2. Crear las nuevas a partir de las del modelo
  let contentTurn = 0;
  let photoTurn = 0;
  const created: string[] = [];
  const usedExtensions = new Set<string>();
  deck.forEach((slide, i) => {
    const img = slide.image ? images.get(slide.image) : undefined;
    let source: TemplateSlide;
    let role: "cover" | "section" | "content" | "closing";
    if (slide.kind === "cover") { source = tpl.cover; role = "cover"; }
    else if (slide.kind === "section") { source = tpl.section; role = source === tpl.cover ? "cover" : "section"; }
    else if (tpl.listSlide && slide.kind === "content" && (slide.bullets?.length ?? 0) >= 3 && !(img && !tpl.listSlide.photos.length && tpl.photoContents.length)) {
      source = tpl.listSlide; role = "content";
    } else if (img && tpl.photoContents.length) {
      // Con imagen de la lección: una diapositiva del modelo que tenga hueco de foto
      source = tpl.photoContents[photoTurn++ % tpl.photoContents.length]; role = "content";
    } else {
      source = tpl.contents[contentTurn++ % tpl.contents.length]; role = "content";
    }

    const n = i + 1;
    let rels = (sourceRels.get(source.path) ?? "").replace(/<Relationship[^>]*relationships\/notesSlide"[^>]*\/>/g, "");
    let photo: { rid: string; img: LessonImage } | undefined;
    if (img && source.photos.length) {
      const ext = img.mime === "image/png" ? "png" : "jpeg";
      usedExtensions.add(ext);
      const rid = `rIdLesson${n}`;
      // Copia propia: si los bytes son una vista de un búfer mayor, JSZip podría escribir el búfer entero
      zip.file(`ppt/media/lesson-img-${n}.${ext}`, Buffer.from(img.data), { createFolders: false });
      rels = rels.replace("</Relationships>", `<Relationship Id="${rid}" Type="${IMAGE_REL}" Target="../media/lesson-img-${n}.${ext}"/></Relationships>`);
      photo = { rid, img };
    }
    zip.file(`ppt/slides/slide${n}.xml`, fillSlide(source, slide, role, photo), { createFolders: false });
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, rels, { createFolders: false });
    created.push(`slides/slide${n}.xml`);
  });

  if (tpl.closing) {
    const n = created.length + 1;
    zip.file(`ppt/slides/slide${n}.xml`, fillSlide(tpl.closing, { kind: "cover", title: "¡Gracias!" }, "closing"), { createFolders: false });
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, (sourceRels.get(tpl.closing.path) ?? "").replace(/<Relationship[^>]*relationships\/notesSlide"[^>]*\/>/g, ""), { createFolders: false });
    created.push(`slides/slide${n}.xml`);
  }

  // 3. Registrar las nuevas en presentation.xml, sus relaciones y los tipos de contenido
  let presRels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  presRels = presRels.replace(/<Relationship[^>]*relationships\/slide"[^>]*\/>/g, "");
  presRels = presRels.replace("</Relationships>", created.map((t, i) => `<Relationship Id="rIdAx${i + 1}" Type="${SLIDE_REL}" Target="${t}"/>`).join("") + "</Relationships>");
  zip.file("ppt/_rels/presentation.xml.rels", presRels);

  let presXml = await zip.file("ppt/presentation.xml")!.async("string");
  const list = `<p:sldIdLst>${created.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdAx${i + 1}"/>`).join("")}</p:sldIdLst>`;
  presXml = /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/.test(presXml)
    ? presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, list)
    : presXml.replace(/(<p:sldMasterIdLst>[\s\S]*?<\/p:sldMasterIdLst>)/, `$1${list}`);
  presXml = presXml.replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/, "");
  zip.file("ppt/presentation.xml", presXml);

  let types = await zip.file("[Content_Types].xml")!.async("string");
  types = types.replace(/<Override[^>]*PartName="\/ppt\/(slides|notesSlides)\/[^"]+"[^>]*\/>/g, "");
  types = types.replace("</Types>", created.map((t) => `<Override PartName="/ppt/${t}" ContentType="${SLIDE_CT}"/>`).join("") + "</Types>");
  for (const ext of usedExtensions) {
    // El orden de los atributos varía según quién generó el archivo (Canva pone ContentType primero):
    // declarar la extensión dos veces hace que PowerPoint no abra el archivo
    if (!new RegExp(`<Default\\b[^>]*\\bExtension="${ext}"`, "i").test(types)) {
      types = types.replace("<Default ", `<Default Extension="${ext}" ContentType="${ext === "png" ? "image/png" : "image/jpeg"}"/><Default `);
    }
  }
  zip.file("[Content_Types].xml", types);

  Object.keys(zip.files).filter((f) => f.startsWith("ppt/notesSlides/")).forEach((f) => zip.remove(f));

  const app = await zip.file("docProps/app.xml")?.async("string");
  if (app) zip.file("docProps/app.xml", app.replace(/<Slides>\d+<\/Slides>/, `<Slides>${created.length}</Slides>`));

  // 4. Quitar imágenes que ya no usa ninguna diapositiva (los modelos de Canva pesan mucho)
  const relFiles = Object.keys(zip.files).filter((f) => f.endsWith(".rels"));
  const used = new Set<string>();
  for (const f of relFiles) {
    const content = await zip.file(f)!.async("string");
    for (const m of content.matchAll(/Target="([^"]+)"/g)) used.add(m[1].split("/").pop()!);
  }
  // Ojo: la entrada de la carpeta "ppt/media/" no se toca (borrarla eliminaría todo su contenido)
  Object.keys(zip.files)
    .filter((f) => f.startsWith("ppt/media/") && !zip.files[f].dir && !used.has(f.split("/").pop()!))
    .forEach((f) => zip.remove(f));

  return (await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })) as Buffer;
}
