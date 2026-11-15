import sys; sys.path.insert(0, '.')
from voxel import Szene
W = 1024
DEFS = '''<defs>
<radialGradient id="nacht" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2b3550"/><stop offset=".55" stop-color="#161d2e"/><stop offset="1" stop-color="#0a0d15"/></radialGradient>
<radialGradient id="abend" cx="50%" cy="80%" r="90%"><stop offset="0" stop-color="#e8a45a"/><stop offset=".35" stop-color="#9a5a4a"/><stop offset=".7" stop-color="#3a2f4a"/><stop offset="1" stop-color="#151a2a"/></radialGradient>
<radialGradient id="glut" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd79a" stop-opacity=".95"/><stop offset=".35" stop-color="#e3a54e" stop-opacity=".55"/><stop offset="1" stop-color="#e3a54e" stop-opacity="0"/></radialGradient>
<radialGradient id="mond" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e9eefc"/><stop offset=".7" stop-color="#c9d3ef"/><stop offset="1" stop-color="#9fb0dc"/></radialGradient>
<filter id="schein" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="weich" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
</defs>'''
# Rune Algiz (Schutz) – eckig wie gemeißelt
def rune(cx, cy, h, farbe='#ffcf7a', breite=None):
    b = breite or h*0.13; s = h/2
    d = f'M{cx},{cy+s} L{cx},{cy-s} M{cx},{cy-s*0.05} L{cx-s*0.62},{cy-s*0.72} M{cx},{cy-s*0.05} L{cx+s*0.62},{cy-s*0.72}'
    return f'<path d="{d}" stroke="{farbe}" stroke-width="{b}" stroke-linecap="square" stroke-linejoin="miter" fill="none" filter="url(#schein)"/>'
def insel(sz, n=8, gras='#5f8f3e', erde='#6b4a2f', stein='#4d5262'):
    for x in range(n):
        for y in range(n):
            sz.setze(x,y,0,gras)
            if (x+y)%3: sz.setze(x,y,-1,erde)
            else: sz.setze(x,y,-1,shade_e(erde))
            if 1<=x<n-1 and 1<=y<n-1: sz.setze(x,y,-2,stein)
            if 2<=x<n-2 and 2<=y<n-2: sz.setze(x,y,-3,stein)
def shade_e(h): return '#5c3f28'
def rahmen(inhalt, grund='url(#nacht)'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}">{DEFS}<rect width="{W}" height="{W}" fill="{grund}"/>{inhalt}</svg>'

# ---------- A: Runenturm ----------
def a():
    sz = Szene(46); insel(sz, 8)
    st, st2 = '#8d93a3', '#7a8091'
    sz.quader(2,2,1,6,6,9, st)
    for x in range(2,6):
        for y in range(2,6):
            if (x in (2,5) or y in (2,5)) and (x+y)%2==0: sz.setze(x,y,9,st2)
    for z in (3,6): sz.setze(5,3,z,'#ffc266'); sz.setze(3,5,z,'#ffc266')
    sz.setze(5,4,1,'#3b2a1c'); sz.setze(5,4,2,'#3b2a1c')
    body = sz.svg(512, 470, leucht=('#ffc266',))
    sterne = ''.join(f'<rect x="{x}" y="{y}" width="6" height="6" fill="#cfd8f5" opacity="{o}"/>' for x,y,o in [(150,170,.7),(860,130,.6),(790,260,.4),(220,330,.35),(905,420,.4),(110,520,.3)])
    return rahmen(f'<circle cx="760" cy="230" r="90" fill="url(#mond)" opacity=".9"/>{sterne}<ellipse cx="512" cy="150" rx="180" ry="180" fill="url(#glut)" filter="url(#weich)"/><ellipse cx="512" cy="640" rx="120" ry="50" fill="#ffc266" opacity=".18" filter="url(#weich)"/>{body}{rune(512,140,170)}')

# ---------- B: Runenstein ----------
def b():
    import math
    g=92; ox,oy=512,540
    sz = Szene(g); sz.quader(0,0,0,3,3,3,'#454b5c')
    body = sz.svg(ox, oy-3*g+3*g, leucht=())
    c30=0.8660254
    # rechte Vorderseite x=3: u nach rechts, v nach unten, 0..300
    m = f'matrix({c30*g/100},{-0.5*g/100},0,{g/100},{ox},{oy})'
    pfad = 'M150,45 L150,265 M150,150 L68,62 M150,150 L232,62'
    rune_ = f'<g transform="{m}"><path d="{pfad}" stroke="#ffb347" stroke-width="34" stroke-linecap="square" fill="none" filter="url(#schein)"/><path d="{pfad}" stroke="#ffe2a8" stroke-width="16" stroke-linecap="square" fill="none"/></g>'
    # linke Seite y=3: kleiner Riss mit Glut
    ml = f'matrix({c30*g/100},{0.5*g/100},0,{g/100},{ox-3*c30*g},{oy-1.5*g+1.5*g-1.5*g})'
    riss = f'<g transform="{ml}"><path d="M60,30 L95,110 L70,170 L120,260" stroke="#ffb347" stroke-width="9" fill="none" filter="url(#schein)"/></g>'
    strahlen = ''.join(f'<polygon points="512,{oy} {512+760*math.cos(t)},{oy+760*math.sin(t)} {512+760*math.cos(t+0.1)},{oy+760*math.sin(t+0.1)}" fill="#e3a54e" opacity=".09"/>' for t in [i*0.3927+0.15 for i in range(16)])
    return rahmen(f'{strahlen}<ellipse cx="512" cy="{oy}" rx="360" ry="360" fill="url(#glut)" filter="url(#weich)" opacity=".75"/>{body}{riss}{rune_}')

# ---------- C: Feste in der goldenen Stunde ----------
def c(rahmen_=None):
    sz = Szene(40); insel(sz, 10)
    st='#b9ad96'; dach='#9b4a2c'; licht='#ffc266'; tor='#3b2a1c'
    sz.quader(3,3,1,7,7,9, st)                       # Hauptturm
    for x in range(3,7):
        for y in range(3,7):
            if (x in (3,6) or y in (3,6)) and (x+y)%2==0: sz.setze(x,y,9,st)
    sz.quader(4,4,9,6,6,11, dach)                    # Dachaufsatz
    sz.quader(1,6,1,3,8,6, st); sz.quader(7,1,1,9,3,6, st)   # Ecktürme
    for (a,b) in ((1,6),(2,7),(7,1),(8,2)): sz.setze(a,b,6,dach)
    sz.quader(3,7,1,7,8,4, st); sz.quader(7,3,1,8,7,4, st)   # Mauern
    for x in range(3,7):
        if x%2==1: sz.setze(x,7,4,st)
    for y in range(3,7):
        if y%2==1: sz.setze(7,y,4,st)
    # Tore mit Licht dahinter, Fenster nur auf den Seitenflächen
    sz.setze(7,4,1,licht); sz.setze(7,5,1,licht); sz.setze(7,4,2,licht); sz.setze(7,5,2,licht)
    sz.setze(4,7,1,tor); sz.setze(5,7,1,tor); sz.setze(4,7,2,tor); sz.setze(5,7,2,tor)
    for z in (4,6): sz.setze(6,4,z,licht); sz.setze(4,6,z,licht)
    sz.setze(8,1,3,licht); sz.setze(1,7,3,licht)
    body = sz.svg(512, 480, leucht=(licht,))
    hof = '<ellipse cx="700" cy="660" rx="120" ry="45" fill="#ffc266" opacity=".22" filter="url(#weich)"/>'
    return rahmen(f'<ellipse cx="512" cy="175" rx="170" ry="170" fill="url(#glut)" filter="url(#weich)"/>{hof}{body}{rune(512,150,150)}', grund='url(#abend)')

for n,f in (('a',a),('b',b),('c',c)): open(f'logo-{n}.svg','w').write(f())
print('ok')
