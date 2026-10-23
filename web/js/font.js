// Port of class c: bitmap font. Field names are kept from the original:
//   a = line height, b = space width, c = glyph sheet, d/e = glyph x/y,
//   f = glyph widths, g = glyph look-up buckets.
'use strict';

class C {
  // c(String): reads the font file. Async because the PNG decodes async.
  static async load(name) {
    const ft = new C();
    const dis = Res.get(name);
    dis.readByte();
    const by = dis.readByte();   // columns
    const by2 = dis.readByte();  // cell width
    const by3 = dis.readByte();  // cell height
    ft.a = by3;
    ft.b = by2 >> 1;
    const cArray = dis.readUTF();
    const n4 = cArray.length;
    ft.d = new Int16Array(n4);
    ft.e = new Int16Array(n4);
    ft.g = new Map();
    for (let n7 = 0; n7 < n4; n7++) {
      ft.d[n7] = (n7 % by) * by2;
      ft.e[n7] = idiv(n7, by) * by3;
      ft.g.set(cArray.charCodeAt(n7), n7);
    }
    ft.f = new Int8Array(n4);
    dis.readFully(ft.f);
    const n2 = dis.readInt();
    const byArray = new Uint8Array(n2);
    dis.readFully(byArray);
    ft.c = await MImage.fromBytes(byArray, 0, n2);
    return ft;
  }

  // String[] a(String, int): word wrap to the width n2. The text can hold
  // "\n" (as a real new line or as the two characters '\' 'n').
  wrap(string, n2) {
    let n3;
    let stringArray = [];
    let n4 = 0;
    const cArray = string;
    let n6 = 0, n7 = 0, n8 = 0, n9 = 0, n10 = 0;
    let bl = false, bl2 = false, bl3 = false, bl4 = false;
    while (!bl) {
      block24: {
        let c2;
        block23: {
          block22: {
            if (n6 !== cArray.length) break block22;
            n7 = n6;
            bl2 = true;
            bl = true;
            if (n8 <= n6) break block23;
            break block24;
          }
          c2 = cArray.charCodeAt(n6);
          if (bl3) {
            if (c2 === 110 /* n */) {
              n8 = n6 + 1;
            } else {
              bl2 = true;
              bl4 = true;
              if (c2 === 105 /* i */ || c2 === 103 /* g */) {
                n7 = n6 + 3;
                n8 = n6 - 1;
              } else {
                n7 = n6 + 1;
                n8 = n6 - 1;
              }
              n10 = 0;
            }
            bl3 = false;
          } else if (c2 === 10) {
            bl2 = true;
            n7 = n6;
            n10 = 0;
          } else if (c2 === 92 /* \ */) {
            bl3 = true;
            if (n8 < n6 || cArray.charCodeAt(n6 + 1) === 110) {
              bl2 = true;
              n7 = n6;
              n10 = 0;
            }
          } else if (c2 === 32) {
            n9 += this.b;
            n7 = n6;
            n10 = 0;
          } else {
            n3 = this.charWidth(c2);
            n10 += n3;
            if ((n9 += n3) > n2) bl2 = true;
          }
        }
        if (bl2) {
          const back = n7 <= n8;
          if (back) n7 = n6;
          stringArray[n4] = cArray.substring(n8, n7);
          if (back || bl4) {
            n8 = n7;
            n9 = 0;
          } else {
            n8 = n7 + 1;
            n9 = n10;
          }
          bl2 = false;
          bl4 = false;
          ++n4;
        }
      }
      ++n6;
    }
    return stringArray.slice(0, n4);
  }

  // int a(String)
  width(s) {
    let n4 = 0;
    for (let i = 0; i < s.length; i++) n4 += this.charWidth(s.charCodeAt(i));
    return n4;
  }

  // int a(char)
  charWidth(c2) {
    if (c2 === 32) return this.b;
    const n2 = this.index(c2);
    if (n2 === -1) return 0;
    return this.f[n2];
  }

  // private int a(int)
  index(c2) {
    const v = this.g.get(c2);
    return v === undefined ? -1 : v;
  }

  // void a(Graphics, String[], x, y, anchor)
  drawLines(g, lines, x, y, anchor) {
    for (let i = 0; i < lines.length; i++) {
      this.drawString(g, lines[i], x, y, anchor);
      y += this.a;
    }
  }

  // void a(Graphics, String, x, y, anchor)
  drawString(g, s, n2, n3, n4) {
    if ((n4 & C.h) > 0) {
      const n5 = this.width(s);
      if ((n4 & 8) > 0) n2 -= n5;
      else if ((n4 & 1) > 0) n2 -= idiv(n5, 2);
      if ((n4 & 0x20) > 0) n3 -= this.a;
      else if ((n4 & 2) > 0) n3 -= idiv(this.a, 2);
    }
    this._draw(g, s, n2, n3);
  }

  _draw(g, s, n2, n3) {
    const n4 = g.getClipX(), n5 = g.getClipY(), n6 = g.getClipWidth(), n7 = g.getClipHeight();
    g.setClip(n4, n5, n6, n7);
    for (let n10 = 0; n10 < s.length; n10++) {
      const c2 = s.charCodeAt(n10);
      if (c2 === 32) {
        n2 += this.b;
      } else {
        const n11 = this.index(c2);
        if (n11 !== -1) {
          const by = this.f[n11];
          g.clipRect(n2, n3, by, this.a);
          g.drawImage(this.c, n2 - this.d[n11], n3 - this.e[n11], 20);
          g.setClip(n4, n5, n6, n7);
          n2 += by;
        }
      }
    }
    g.setClip(n4, n5, n6, n7);
  }
}
C.h = 43;
