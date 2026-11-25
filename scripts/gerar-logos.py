"""Gera as logos, os ícones e o QR code do Instagram do ProjetoTrid a partir da arte em docs/marca/.
   logo-horizontal.png: "TRID" branco + cubos (fundo transparente). logo-simbolo.png: cubos com brilho vermelho.
   Uso: python3 scripts/gerar-logos.py   (precisa de Pillow e segno)"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import segno, io
import os
RAIZ=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
U=os.path.join(RAIZ,'docs/marca/')
R=os.path.join(RAIZ,'site/app/')
hor=Image.open(U+'logo-horizontal.png').convert('RGBA')
hor=hor.crop(hor.getchannel('A').getbbox())
# horizontal logos
W=780; h=hor.resize((W,round(hor.height*W/hor.width)),Image.LANCZOS)
h.save(R+'img/logo-trid-escuro.png',optimize=True)
lt=h.copy(); px=lt.load()
for y in range(lt.height):
  for x in range(lt.width):
    r,g,b,a=px[x,y]
    if a and min(r,g,b)>200: px[x,y]=(0x1B,0x1B,0x1B,a)
lt.save(R+'img/logo-trid-claro.png',optimize=True)
# cubes symbol from horizontal: right part (no glow)
cut=int(hor.width*0.72); cub=hor.crop((cut,0,hor.width,hor.height)); cub=cub.crop(cub.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox())
def fit(im,s):
  f=s/max(im.size); return im.resize((round(im.width*f),round(im.height*f)),Image.LANCZOS)
c=fit(cub,680); c.save(R+'img/logo-trid-simbolo.png',optimize=True)
# mark 1024 transparent
m=Image.new('RGBA',(1024,1024),(0,0,0,0)); c2=fit(cub,820); m.paste(c2,((1024-c2.width)//2,(1024-c2.height)//2),c2); m.resize((512,512),Image.LANCZOS).save(R+'img/projeto-trid-mark.png',optimize=True)
# icons: dark rounded square + glowing symbol
sym=Image.open(U+'logo-simbolo.png').convert('RGBA')
BG=(17,17,17,255)
def icon(size,rounded,scale):
  base=Image.new('RGBA',(size*4,size*4),(0,0,0,0))
  mask=Image.new('L',base.size,0); d=ImageDraw.Draw(mask)
  if rounded: d.rounded_rectangle([0,0,base.width-1,base.height-1],radius=int(base.width*0.2266),fill=255)
  else: d.rectangle([0,0,base.width,base.height],fill=255)
  bg=Image.new('RGBA',base.size,BG); base.paste(bg,(0,0),mask)
  s=sym.resize((int(base.width*scale),)*2,Image.LANCZOS)
  o=(base.width-s.width)//2; layer=Image.new('RGBA',base.size,(0,0,0,0)); layer.paste(s,(o,o)); 
  base=Image.alpha_composite(base,Image.composite(layer,Image.new('RGBA',base.size,(0,0,0,0)),mask))
  return base.resize((size,size),Image.LANCZOS)
icon(512,False,1.0).save(R+'icons/trid-512.png',optimize=True)
icon(512,False,0.8).save(R+'icons/trid-maskable-512.png',optimize=True)  # Android recorta em círculo: símbolo menor
icon(192,False,1.0).save(R+'icons/trid-192.png',optimize=True)
icon(180,False,1.0).save(R+'icons/trid-apple-touch.png',optimize=True)
icon(64,True,1.05).save(R+'icons/trid-favicon.png',optimize=True)
# instagram QR
qr=segno.make('https://www.instagram.com/predooli/',error='h'); buf=io.BytesIO(); qr.save(buf,kind='png',scale=560//qr.symbol_size(border=0)[0],border=0,dark='#1B1B1B'); buf.seek(0)
q=Image.open(buf).convert('RGBA'); ig=Image.new('RGB',(863,788),'white'); ig.paste(q,((863-q.width)//2,60+(560-q.height)//2),q)
dr=ImageDraw.Draw(ig); 
# instagram glyph in centre
cx,cy,s=863//2,60+280,120; dr.rounded_rectangle([cx-s//2-14,cy-s//2-14,cx+s//2+14,cy+s//2+14],radius=30,fill='white')
dr.rounded_rectangle([cx-s//2,cy-s//2,cx+s//2,cy+s//2],radius=32,outline='#1B1B1B',width=13)
dr.ellipse([cx-28,cy-28,cx+28,cy+28],outline='#1B1B1B',width=13); dr.ellipse([cx+27,cy-43,cx+43,cy-27],fill='#1B1B1B')
f=ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',64)
t='@PREDOOLI'; tw=dr.textlength(t,font=f); dr.text(((863-tw)/2,660),t,font=f,fill='#1B1B1B')
ig.save(R+'img/qrcode-instagram.png',optimize=True)
