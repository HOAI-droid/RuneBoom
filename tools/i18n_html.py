"""Hilfswerkzeug (einmalig für 0.6): Texte in TS-Code mit HTML-Vorlagen in t('…') einpacken."""
import re, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from i18n_wrap import lies_template, ist_text, DATEN
DATEN2 = re.compile(DATEN.pattern + r'|RES_NAME\[|ZA_NAMEN\[|WISSEN_NAME\[|MEHRZAHL\[')
def daten(expr):
    e = expr.strip()
    if e.startswith('t(') or not DATEN2.search(e): return expr
    # nur einfache Zugriffe einpacken (kein Aufruf, kein Ternär)
    if re.fullmatch(r"[\w$.\[\]!'()\- ]+", e) and '?' not in e and '=>' not in e: return f't({e})'
    return expr
def code(src):
    out = ''; i = 0; n = len(src)
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i); j = n if j < 0 else j; out += src[i:j]; i = j; continue
        if src.startswith('/*', i):
            j = src.find('*/', i) + 2; out += src[i:j]; i = j; continue
        if c == '/' and (out.rstrip()[-1:] in tuple('(,=:[!&|?{};') or out.rstrip().endswith('return')):
            j = i + 1; klasse = False
            while j < n and (src[j] != '/' or klasse):
                if src[j] == '\\': j += 1
                elif src[j] == '[': klasse = True
                elif src[j] == ']': klasse = False
                j += 1
            j += 1
            while j < n and src[j].isalpha(): j += 1
            out += src[i:j]; i = j; continue
        if c == '`':
            ende, teile = lies_template(src, i); out += vorlage(teile); i = ende; continue
        if c in "'\"":
            j = i + 1
            while src[j] != c: j += 2 if src[j] == '\\' else 1
            lit = src[i+1:j]; davor = out[-2:]
            if c == "'" and ist_text(lit) and not davor.endswith('t(') and not out.rstrip().endswith('import') and 'from' not in out[-6:]: out += f"t('{lit}')"
            else: out += src[i:j+1]
            i = j + 1; continue
        out += c; i += 1
    return out
def vorlage(teile):
    """teile: [('txt', s), ('expr', e), ...] → neues Template mit ${t('…')} um Textläufe"""
    toks = []  # ('tag', str) | ('txt', str) | ('expr', str)
    in_tag = False
    for art, v in teile:
        if art == 'expr': toks.append(('expr_tag' if in_tag else 'expr', v)); continue
        buf = ''
        for ch in v:
            if not in_tag and ch == '<':
                if buf: toks.append(('txt', buf)); buf = ''
                in_tag = True; buf = '<'
            elif in_tag and ch == '>':
                buf += '>'; toks.append(('tag', buf)); buf = ''; in_tag = False
            else: buf += ch
        if buf: toks.append(('tag' if in_tag else 'txt', buf))
    out = '`'; lauf = []
    def flush():
        nonlocal out, lauf
        if not lauf: return
        text = ''.join(v for a, v in lauf if a == 'txt')
        if re.search(r'[A-Za-zÄÖÜäöüß]{3}', text) and not re.fullmatch(r'\s*[A-Z]( [A-Z·])*\s*', text):
            # führende/folgende Leerzeichen und Satzzeichen wie „ · “ draußen lassen
            vor = ''; nach = ''
            n = 0; vorl = ''; params = []
            for a, v in lauf:
                if a == 'txt': vorl += v
                else: name = 'abcdefgh'[n]; n += 1; vorl += '{' + name + '}'; params.append(f'{name}: {daten(code(v))}')
            m = re.match(r'^(\s*[·|•]?\s*)(.*?)(\s*)$', vorl, re.S); vor, kern, nach = m.group(1), m.group(2), m.group(3)
            if params and re.fullmatch(r'\{[a-h]\}', kern.strip()):
                out += vorl.replace('{a}', '${' + daten(code(lauf[[a for a, _ in lauf].index('expr')][1])) + '}') if False else ''.join(v if a == 'txt' else '${' + daten(code(v)) + '}' for a, v in lauf)
            else:
                esc = kern.replace('\\', '\\\\').replace("'", "\\'")
                out += vor + "${t('" + esc + "'" + (', { ' + ', '.join(params) + ' }' if params else '') + ")}" + nach
        else:
            out += ''.join(v if a == 'txt' else '${' + daten(code(v)) + '}' for a, v in lauf)
        lauf = []
    for a, v in toks:
        if a in ('txt', 'expr'): lauf.append((a, v))
        else:
            flush()
            out += v if a == 'tag' else '${' + daten(code(v)) + '}'
    flush()
    return out + '`'
if __name__ == '__main__':
    p = sys.argv[1]; s = open(p).read()
    neu = code(s); open(p, 'w').write(neu)
