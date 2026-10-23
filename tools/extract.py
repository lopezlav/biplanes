import sys, struct, zlib, os, json
jar, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
class R:
    def __init__(s, b): s.b=b; s.p=0
    def read(s,n): v=s.b[s.p:s.p+n]; s.p+=n; assert len(v)==n; return v
    def byte(s): return struct.unpack('>b', s.read(1))[0]
    def ubyte(s): return s.read(1)[0]
    def short(s): return struct.unpack('>h', s.read(2))[0]
    def ushort(s): return struct.unpack('>H', s.read(2))[0]
    def int(s): return struct.unpack('>i', s.read(4))[0]
    def utf(s): n=s.ushort(); return s.read(n).decode('utf-8', 'replace')
    def m(s): n=s.int(); return s.read(n)
r = R(open(os.path.join(jar,'r'),'rb').read())
meta = {}
b0 = r.m(); meta['x']=b0[0]; meta['z']=b0[1]; meta['b0']=list(b0)
meta['bs'] = list(struct.unpack('>%db'%len(bs), bs)) if (bs:=r.m()) else []
mb = r.m(); meta['menu'] = list(struct.unpack('>%db'%len(mb), mb))
de=r.read(8); dh=r.read(15); di=r.read(4); df=r.read(r.ushort()+13); dg=r.read(12)
def k():
    n2=r.ushort(); data=r.read(n2)
    out=bytearray(33+len(df)+n2+12+12)
    out[0:8]=de; out[11:26]=dh
    out[18]=r.ubyte(); out[19]=r.ubyte(); out[22]=r.ubyte(); out[23]=r.ubyte()
    c=zlib.crc32(bytes(out[12:29]))&0xffffffff; out[29:33]=struct.pack('>I',c)
    n4=33; out[n4:n4+len(df)]=df; n4+=len(df); n4+=2
    out[n4]=n2>>8&255; out[n4+1]=n2&255; n4+=2
    out[n4:n4+4]=di; n4+=4; out[n4:n4+n2]=data
    c=zlib.crc32(bytes(out[n4-4:n4+n2]))&0xffffffff; out[n4+n2:n4+n2+4]=struct.pack('>I',c)
    n4+=n2+4; out[n4:n4+12]=dg
    return bytes(out)
def save(name, data): open(os.path.join(out,name+'.png'),'wb').write(data)
for i in range(32): save('a7_%d'%i, k())
save('ba',k()); save('bb',k()); save('bc',k())
for i in range(72): save('a8_%d'%i, k())
save('a9_0', r.m())
# sounds
n = r.byte(); snd={'players':{}, 'sounds':[]}
for _ in range(n):
    t=r.byte()
    if t in (0,1):
        d=r.m(); ext='mid' if t==0 else 'wav'; open(os.path.join(out,'snd%d.%s'%(t,ext)),'wb').write(d); snd['players'][t]=ext
    elif t==2:
        cnt=r.byte()
        for i in range(cnt):
            d=r.m(); open(os.path.join(out,'nokia%d.bin'%i),'wb').write(d); snd['sounds'].append(len(d))
c=r.short(); types=list(struct.unpack('>%db'%c, r.read(c))); times=[r.int() for _ in range(c*2)]
snd['types']=types; snd['times']=times
meta['snd']=snd
print('remaining bytes', len(r.b)-r.p)
def strings(name):
    s=R(open(os.path.join(jar,name),'rb').read()); n=s.int(); return [s.utf() for _ in range(n)]
for nm in ('tg','tt','tm'): meta[nm]=strings(nm)
for nm in ('f','fzr','fzb'):
    s=R(open(os.path.join(jar,nm),'rb').read())
    s.byte(); cols=s.byte(); cw=s.byte(); ch=s.byte(); chars=s.utf(); widths=list(s.read(len(chars)))
    widths=[w-256 if w>127 else w for w in widths]
    png=s.m(); open(os.path.join(out,'font_%s.png'%nm),'wb').write(png)
    meta['font_'+nm]={'cols':cols,'cw':cw,'ch':ch,'chars':chars,'widths':widths,'rest':len(s.b)-s.p}
json.dump(meta, open(os.path.join(out,'meta.json'),'w'), ensure_ascii=False, indent=1)
