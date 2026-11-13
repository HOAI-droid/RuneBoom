"""Hilfswerkzeug: deutsche Texte in t('…', {…}) einpacken (einmalig für 0.6). Aufruf: python3 tools/i18n_wrap.py DATEI [zeilenfilter-regex]"""
import re, sys
DATEN = re.compile(r'(\.(name|kurz|text|wirkung|stoff)\b|ZEITALTER_NAME\[|BAUSTEIN_NAME\[|RES_NAMEN\[|FAEHIGKEIT_NAME\[|STUFE_NAME\[)')
def ist_text(s):
    return len(s) > 3 and (' ' in s or s[:1].isupper() or any(c in s for c in 'äöüÄÖÜß')) and not s.startswith('#')
def lies_template(src, i):
    # src[i] == '`'; gibt (ende, teile) zurück, teile: Liste von ('txt', str) | ('expr', str)
    j = i + 1; teile = []; buf = ''
    while j < len(src):
        c = src[j]
        if c == '\\': buf += src[j:j+2]; j += 2; continue
        if c == '`': teile.append(('txt', buf)); return j + 1, teile
        if c == '$' and src[j+1:j+2] == '{':
            teile.append(('txt', buf)); buf = ''; k = j + 2; tiefe = 1
            while tiefe:
                if src[k] == '{': tiefe += 1
                elif src[k] == '}': tiefe -= 1
                elif src[k] == '`':  # verschachteltes Template: überspringen
                    k2, _ = lies_template(src, k); k = k2 - 1
                k += 1
            teile.append(('expr', src[j+2:k-1])); j = k; continue
        buf += c; j += 1
    raise ValueError('offenes Template')
def wandle(zeile):
    out = ''; i = 0
    while i < len(zeile):
        c = zeile[i]
        if c == '`':
            ende, teile = lies_template(zeile, i)
            text = ''.join(t if a == 'txt' else '{%d}' % n for n, (a, t) in enumerate([(a, t) for a, t in teile]) )
            # Platzhalter nummerieren
            n = 0; vorlage = ''; params = []
            for a, v in teile:
                if a == 'txt': vorlage += v
                else:
                    name = 'abcdefgh'[n]; n += 1; vorlage += '{' + name + '}'
                    expr = wandle(v)
                    if DATEN.search(v) and not v.strip().startswith('tr('): expr = f'tr({expr})'
                    params.append(f'{name}: {expr}')
            if ist_text(re.sub(r'\{[a-h]\}', '', vorlage)):
                out += "tr('" + vorlage.replace("'", "\\'") + "'" + (', { ' + ', '.join(params) + ' }' if params else '') + ')'
            else: out += zeile[i:ende]
            i = ende; continue
        if c == "'":
            j = i + 1
            while zeile[j] != "'":
                j += 2 if zeile[j] == '\\' else 1
            lit = zeile[i+1:j]
            davor = zeile[max(0, i-3):i]
            if ist_text(lit) and not davor.endswith('tr('): out += f"tr('{lit}')"
            else: out += zeile[i:j+1]
            i = j + 1; continue
        out += c; i += 1
    return out
if __name__ == '__main__':
    pfad = sys.argv[1]; filt = re.compile(sys.argv[2]) if len(sys.argv) > 2 else None
    zeilen = open(pfad).read().split('\n'); neu = []
    for z in zeilen: neu.append(wandle(z) if (filt is None or filt.search(z)) else z)
    open(pfad, 'w').write('\n'.join(neu))
