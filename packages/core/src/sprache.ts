/**
 * Sprachen: Der deutsche Text ist zugleich der Schlüssel. t('Tag {n}', { n: 3 }) sucht die Übersetzung
 * in der Tabelle der aktiven Sprache; fehlt sie, bleibt der deutsche Text. Platzhalter in geschweiften Klammern.
 */
export type Sprache = 'de' | 'en' | 'fr' | 'es';
export const SPRACHEN: Record<Sprache, string> = { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español' };
let aktiv: Sprache = 'de';
const tabellen: Partial<Record<Sprache, Record<string, string>>> = {};
export function registriereSprache(s: Sprache, tabelle: Record<string, string>): void { tabellen[s] = tabelle; }
export function setzeSprache(s: Sprache): void { aktiv = s; }
export function sprache(): Sprache { return aktiv; }
/** Sprache des Systems, sonst Englisch (Deutsch ist der Standard für deutsche Systeme) */
export function systemSprache(liste: readonly string[] = (globalThis as any).navigator?.languages || [(globalThis as any).navigator?.language || 'de']): Sprache {
  for (const l of liste) { const k = String(l).slice(0, 2).toLowerCase(); if (k === 'de' || k === 'en' || k === 'fr' || k === 'es') return k; }
  return 'en';
}
export function t(text: string, p?: Record<string, string | number>): string {
  let s = aktiv === 'de' ? text : (tabellen[aktiv]?.[text] ?? text);
  if (p) for (const [k, v] of Object.entries(p)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
/** fehlende Schlüssel einer Sprache (für Tests) */
export function fehlendeSchluessel(s: Sprache, schluessel: string[]): string[] { const tb = tabellen[s] || {}; return schluessel.filter((k) => !(k in tb)); }
