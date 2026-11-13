/// <reference lib="webworker" />
import { setzeSeed } from '@runeboom/core';
import { bauChunk, uebersicht } from './chunk.ts';

/** Hintergrund-Rechner: baut Kacheln und die Übersicht, ohne das Bild ruckeln zu lassen. */
const ich = self as unknown as DedicatedWorkerGlobalScope;
ich.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.art === 'seed') { setzeSeed(m.seed); return; }
  if (m.art === 'chunk') {
    const r = bauChunk(m.cx, m.cz, m.aend || []); const tr: ArrayBuffer[] = [];
    for (const set of [r.grob, r.fein]) for (const b of set) if (b) tr.push(b.p.buffer as ArrayBuffer, b.n.buffer as ArrayBuffer, b.c.buffer as ArrayBuffer, b.i.buffer as ArrayBuffer);
    tr.push(r.wasser.buffer as ArrayBuffer, r.lava.buffer as ArrayBuffer);
    ich.postMessage({ art: 'chunk', cx: m.cx, cz: m.cz, gen: m.gen, r }, tr);
  }
  if (m.art === 'uebersicht') {
    const u = uebersicht();
    ich.postMessage({ art: 'uebersicht', gen: m.gen, u }, [u.p.buffer, u.n.buffer, u.c.buffer, u.i.buffer, u.dekoListe.buffer] as ArrayBuffer[]);
  }
};
