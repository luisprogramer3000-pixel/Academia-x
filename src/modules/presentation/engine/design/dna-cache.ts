import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import os from "os";
import type { PresentationDesignDNA } from "../types";
import { ANALYZER_VERSION, analyzeDesign, hashBytes } from "./analyzer";

/**
 * Caché del ADN de diseño: memoria (proceso) + disco (sobrevive a reinicios).
 * La clave es el hash SHA-256 del archivo y la versión del analizador: si el
 * modelo cambia o mejora el analizador, se vuelve a analizar; si no, se reutiliza.
 */

const memory = new Map<string, PresentationDesignDNA>();
const MAX_MEMORY = 50;

function cacheDir(): string {
  return process.env.PRESENTATION_CACHE_DIR || path.join(process.cwd(), ".cache", "presentation-dna");
}

async function readDisk(key: string): Promise<PresentationDesignDNA | null> {
  for (const dir of [cacheDir(), path.join(os.tmpdir(), "presentation-dna")]) {
    try {
      return JSON.parse(await readFile(path.join(dir, `${key}.json`), "utf8")) as PresentationDesignDNA;
    } catch {
      // no está en esta carpeta
    }
  }
  return null;
}

async function writeDisk(key: string, dna: PresentationDesignDNA) {
  for (const dir of [cacheDir(), path.join(os.tmpdir(), "presentation-dna")]) {
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${key}.json`), JSON.stringify(dna));
      return;
    } catch {
      // carpeta sin permisos: se prueba la temporal del sistema
    }
  }
}

export async function getDesignDNA(bytes: Uint8Array, id: string): Promise<{ dna: PresentationDesignDNA; cached: boolean }> {
  const key = `${hashBytes(bytes)}-v${ANALYZER_VERSION}`;
  const hit = memory.get(key) ?? (await readDisk(key));
  if (hit) {
    memory.set(key, hit);
    return { dna: { ...hit, id }, cached: true };
  }
  const dna = await analyzeDesign(bytes, id);
  if (memory.size >= MAX_MEMORY) memory.delete(memory.keys().next().value as string);
  memory.set(key, dna);
  await writeDisk(key, dna);
  return { dna, cached: false };
}
