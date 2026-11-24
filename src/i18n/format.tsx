import { Fragment, type ReactNode } from "react";

/** Sustituye {nombre} por su valor: fmt("Hola {name}", { name: "Ana" }). */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/**
 * Igual que fmt, pero los valores pueden ser elementos (negritas, enlaces):
 * rich("Tu academia {name} fue creada", { name: <strong>{n}</strong> }).
 */
export function rich(template: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const match = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{match && match[1] in vars ? vars[match[1]] : part}</Fragment>;
  });
}
