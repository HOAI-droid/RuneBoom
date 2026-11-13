#!/usr/bin/env python3
"""
Klänge für runeBOOM holen und aufbereiten (einmalig, Ergebnis liegt im Repo unter apps/web/public/klang/).

Quellen:
- Geräusche: Kenney „50 RPG sound effects“ (CC0), https://opengameart.org/content/50-rpg-sound-effects
- Instrumente: FluidR3 GM (Frank Wen), vorgerendert von gleitz/midi-js-soundfonts, CC BY 3.0
  https://github.com/gleitz/midi-js-soundfonts

Aufruf: python3 tools/klaenge_holen.py <arbeitsordner>   (braucht curl, unzip, ffmpeg)
"""
import base64, json, os, re, subprocess, sys, zipfile

ZIEL = os.path.join(os.path.dirname(__file__), '..', 'apps', 'web', 'public', 'klang')
arbeit = sys.argv[1] if len(sys.argv) > 1 else '/tmp/runeboom-klaenge'
os.makedirs(arbeit, exist_ok=True); os.makedirs(ZIEL, exist_ok=True)

def lade(url, datei):
    subprocess.run(['curl', '-s', '-L', '-m', '120', '-o', datei, url], check=True)

def mp3(quelle, ziel, dauer, laut=0.0):
    """mono, 44,1 kHz, 64 kbit/s, gekürzt mit kurzem Ausblenden; laut in dB"""
    filt = f"atrim=0:{dauer},afade=t=out:st={max(0, dauer - 0.25)}:d=0.25,volume={laut}dB"
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', quelle, '-ac', '1', '-ar', '44100', '-af', filt, '-b:a', '64k', ziel], check=True)

# ---------- Geräusche (CC0) ----------
GERAEUSCHE = {
    'chop': 'chop', 'topf1': 'metalPot1', 'topf2': 'metalPot2', 'topf3': 'metalPot3', 'klick': 'metalClick', 'riegel': 'metalLatch',
    'tuer1': 'doorClose_1', 'tuer2': 'doorClose_2', 'tuer3': 'doorClose_3', 'tuer4': 'doorClose_4', 'knarr1': 'creak1', 'knarr2': 'creak2',
    'schritt1': 'footstep00', 'schritt2': 'footstep01', 'schritt3': 'footstep02', 'muenzen1': 'handleCoins', 'muenzen2': 'handleCoins2',
    'leder': 'dropLeather', 'blatt': 'bookFlip1', 'klinge': 'drawKnife1', 'schnitt': 'knifeSlice',
}
zipdatei = os.path.join(arbeit, 'rpg.zip')
if not os.path.exists(zipdatei): lade('https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip', zipdatei)
with zipfile.ZipFile(zipdatei) as z:
    for name, quelle in GERAEUSCHE.items():
        roh = os.path.join(arbeit, quelle + '.ogg')
        with open(roh, 'wb') as f: f.write(z.read(f'OGG/{quelle}.ogg'))
        mp3(roh, os.path.join(ZIEL, f'g_{name}.mp3'), 1.6)

# ---------- Instrumente (CC BY 3.0) ----------
NOTEN = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
def name(midi): return f'{NOTEN[midi % 12]}{midi // 12 - 1}'
# Instrument: (erste Note, letzte Note, Schritt in Halbtönen, Dauer in s)
INSTRUMENTE = {
    'flute': (72, 96, 3, 2.2), 'pan_flute': (72, 84, 4, 2.2), 'orchestral_harp': (48, 84, 4, 2.6), 'kalimba': (60, 84, 4, 1.8),
    'woodblock': (72, 72, 1, 0.6), 'string_ensemble_1': (48, 84, 4, 3.4), 'tubular_bells': (60, 84, 6, 3.2), 'dulcimer': (60, 84, 4, 2.2),
    'celesta': (72, 96, 6, 2.0), 'french_horn': (48, 72, 4, 2.6), 'trombone': (36, 60, 4, 2.2), 'taiko_drum': (36, 48, 6, 1.4),
    'timpani': (36, 48, 4, 2.0), 'contrabass': (28, 52, 4, 2.0), 'choir_aahs': (48, 72, 4, 3.4), 'cello': (36, 60, 4, 2.6),
}
liste = {}
for inst, (a, b, schritt, dauer) in INSTRUMENTE.items():
    js = os.path.join(arbeit, inst + '.js')
    if not os.path.exists(js): lade(f'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/{inst}-mp3.js', js)
    text = open(js, encoding='utf-8').read()
    noten = dict(re.findall(r'"([A-G]b?\d)":\s*"data:audio/mp3;base64,([^"]+)"', text))
    liste[inst] = []
    for m in range(a, b + 1, schritt):
        n = name(m)
        if n not in noten: continue
        roh = os.path.join(arbeit, f'{inst}_{n}.mp3')
        with open(roh, 'wb') as f: f.write(base64.b64decode(noten[n]))
        mp3(roh, os.path.join(ZIEL, f'i_{inst}_{m}.mp3'), dauer)
        liste[inst].append(m)
with open(os.path.join(ZIEL, 'instrumente.json'), 'w') as f: json.dump(liste, f)
print('fertig:', sum(len(v) for v in liste.values()), 'Instrumententöne,', len(GERAEUSCHE), 'Geräusche')
