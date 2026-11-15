/**
 * Prolog sprechen lassen (einmalig, Ergebnis liegt im Repo unter apps/web/public/prolog/).
 * ElevenLabs, Stimme „Brian“, Modell eleven_multilingual_v2. Jeder Absatz einzeln (mit Zeitmarken je Zeichen),
 * danach mit Pausen zu einer Datei verbunden; die Zeiten je Zeile kommen nach <sprache>-<art>.json.
 * Aufruf: node --experimental-strip-types tools/prolog_sprechen.ts [de|en|fr|es] [lang|kurz]
 * Braucht curl und ffmpeg; der Schlüssel kommt über den Netz-Proxy der Umgebung (Kopfzeile xi-api-key) oder ELEVENLABS_API_KEY.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROLOG, type ProlSprache } from '../apps/web/src/prolog.ts';

const STIMME = 'nPczCjzI2devNBz1zQrb'; // Brian
const ZIEL = join(import.meta.dirname, '..', 'apps', 'web', 'public', 'prolog');
const VOR = 0.8, PAUSE = 1.1, ENDE = 1.5; // Sekunden Stille: am Anfang, zwischen Absätzen, am Schluss
const arbeit = mkdtempSync(join(tmpdir(), 'prolog-'));
const SPEICHER = join(tmpdir(), 'prolog-antworten'); mkdirSync(SPEICHER, { recursive: true }); mkdirSync(ZIEL, { recursive: true });
const schluessel = process.env.ELEVENLABS_API_KEY;

function sprich(text: string, sprache: ProlSprache, vorher: string, nachher: string): { mp3: string; start: number[]; ende: number[] } {
  const anfrage = join(arbeit, 'anfrage.json');
  const inhalt = JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: sprache, previous_text: vorher || undefined, next_text: nachher || undefined,
    voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } });
  writeFileSync(anfrage, inhalt);
  // bereits gesprochene Absätze nicht noch einmal bezahlen
  const antwort = join(SPEICHER, createHash('sha1').update(STIMME + inhalt).digest('hex') + '.json');
  if (!existsSync(antwort)) {
  const kopf = ['-H', 'Content-Type: application/json', ...(schluessel ? ['-H', `xi-api-key: ${schluessel}`] : [])];
  const code = execFileSync('curl', ['-s', '-o', antwort, '-w', '%{http_code}', '-X', 'POST', ...kopf, '--data', `@${anfrage}`,
    `https://api.elevenlabs.io/v1/text-to-speech/${STIMME}/with-timestamps?output_format=mp3_44100_128`]).toString();
  if (code !== '200') { const f = readFileSync(antwort, 'utf8').slice(0, 300); execFileSync('rm', ['-f', antwort]); throw new Error(`ElevenLabs ${code}: ${f}`); }
  }
  const a = JSON.parse(readFileSync(antwort, 'utf8'));
  const roh = join(arbeit, `teil-${Math.random().toString(36).slice(2)}.mp3`), mp3 = roh.replace(/\.mp3$/, '.wav');
  writeFileSync(roh, Buffer.from(a.audio_base64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', roh, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', mp3]); // für das Zusammenfügen alles als WAV
  const al = a.alignment;
  if (al.characters.join('') !== text) console.warn('Hinweis: Zeitmarken passen nicht Zeichen für Zeichen zum Text');
  return { mp3, start: al.character_start_times_seconds, ende: al.character_end_times_seconds };
}
const dauer = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const stille = (s: number) => { const f = join(arbeit, `still-${s}.wav`); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(s), '-c:a', 'pcm_s16le', f]); return f; };

function erzeuge(sprache: ProlSprache, art: 'lang' | 'kurz'): void {
  const absaetze = PROLOG[sprache][art], texte = absaetze.map((z) => z.join('\n'));
  const teile: string[] = [stille(VOR)], zeilen: [number, number][][] = [];
  let t = VOR;
  absaetze.forEach((z, i) => {
    const r = sprich(texte[i], sprache, texte[i - 1] || '', texte[i + 1] || '');
    let pos = 0; const zz: [number, number][] = [];
    for (const zeile of z) {
      const a = texte[i].indexOf(zeile, pos), b = a + zeile.length - 1; pos = b + 1;
      zz.push([+(t + r.start[a]).toFixed(2), +(t + r.ende[b]).toFixed(2)]);
    }
    zeilen.push(zz); teile.push(r.mp3); t += dauer(r.mp3);
    if (i < absaetze.length - 1) { teile.push(stille(PAUSE)); t += PAUSE; }
    console.log(sprache, art, 'Absatz', i + 1, '/', absaetze.length);
  });
  teile.push(stille(ENDE)); t += ENDE;
  const liste = join(arbeit, 'liste.txt'); writeFileSync(liste, teile.map((f) => `file '${f}'`).join('\n'));
  const ziel = join(ZIEL, `${sprache}-${art}.mp3`);
  // einheitlich mono 44,1 kHz, 96 kbit/s, leicht angehoben und begrenzt
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-ac', '1', '-ar', '44100', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-b:a', '96k', ziel]);
  writeFileSync(join(ZIEL, `${sprache}-${art}.json`), JSON.stringify({ dauer: +dauer(ziel).toFixed(2), zeilen }));
  console.log('fertig:', ziel);
}

const [s, a] = process.argv.slice(2) as [ProlSprache | undefined, 'lang' | 'kurz' | undefined];
for (const sp of s ? [s] : (Object.keys(PROLOG) as ProlSprache[])) for (const art of a ? [a] : (['lang', 'kurz'] as const)) erzeuge(sp, art);
