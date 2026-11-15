import math, colorsys
C30, S30 = math.cos(math.pi/6), 0.5
def hexrgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def shade(h, f):
    r,g,b = hexrgb(h); return '#%02x%02x%02x' % tuple(max(0,min(255,int(c*f))) for c in (r,g,b))
class Szene:
    def __init__(s, gr=20): s.v = {}; s.gr = gr; s.extra = []
    def setze(s, x,y,z,f): s.v[(x,y,z)] = f
    def quader(s, x0,y0,z0,x1,y1,z1,f):
        for x in range(x0,x1):
            for y in range(y0,y1):
                for z in range(z0,z1): s.v[(x,y,z)] = f
    def p(s, x,y,z, ox,oy):
        g=s.gr; return (ox + (x-y)*C30*g, oy + (x+y)*S30*g - z*g)
    def svg(s, ox, oy, leucht=()):
        out=[]
        for (x,y,z) in sorted(s.v, key=lambda k:(k[0]+k[1]+k[2], k[2])):
            f=s.v[(x,y,z)]; lf = f in leucht
            j = 1 + (((x*73+y*37+z*11) % 7) - 3) * (0.0 if lf else 0.018)
            def poly(pts, col): out.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="0.6" stroke-linejoin="round"/>' % (' '.join('%.1f,%.1f'%s.p(*q,ox,oy) for q in pts), col, col))
            if (x,y,z+1) not in s.v: poly([(x,y,z+1),(x+1,y,z+1),(x+1,y+1,z+1),(x,y+1,z+1)], shade(f, (1.12 if not lf else 1.05)*j))
            if (x,y+1,z) not in s.v: poly([(x,y+1,z),(x+1,y+1,z),(x+1,y+1,z+1),(x,y+1,z+1)], shade(f, (0.78 if not lf else 0.95)*j))
            if (x+1,y,z) not in s.v: poly([(x+1,y,z),(x+1,y+1,z),(x+1,y+1,z+1),(x+1,y,z+1)], shade(f, (0.58 if not lf else 0.85)*j))
        return '\n'.join(out)
