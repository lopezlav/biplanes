// Port of class g: the menu system. Static fields keep their original names:
//   a = position in the menu data (byte index), b = item count,
//   c = selected item, d = title, e = item entries, f = menu data,
//   g = menu strings (/tm), h = full redraw counter, i/j = glow animation.
'use strict';

const G = {
  a: 0, b: 0, c: 0, d: null, e: null, f: null, g: null, h: 0, i: 0, j: false,
  QUIT_ENTRY: 21,   // menu entry of "Quit" (/tm string 21)

  // a(Graphics, w, h, minW, hAlign, vAlign, textAnchor, rowH, font)
  draw(graphics, n2, n3, n4, n5, n6, n7, n8, c2) {
    let n9, n10, n11, n12;
    let n13 = 0;
    if (G.d != null) n13 = c2.width(G.d);
    let n14 = G.b;
    while (--n14 >= 0) {
      const n15 = c2.width(G.g[G.e[n14]]);
      if (n15 <= n13) continue;
      n13 = n15;
    }
    let n16 = G.b;
    if (G.d != null) ++n16;
    const n17 = n16 * n8 + 2 + 4 - 6;
    let n18 = n13 + 4 + 4;
    if (n18 < n4) n18 = n4;
    let n19 = 0, n20 = 0;
    switch (n5) {
      case 4: n19 = 0; break;
      case 1: n19 = (n2 - n18) >> 1; break;
      case 8: n19 = n2 - n18;
    }
    switch (n6) {
      case 16: n20 = 0; break;
      case 2: n20 = (n3 - n17) >> 1; break;
      case 32: n20 = n3 - n17;
    }
    if (G.h > 0) {
      graphics.setColor(6488245);
      graphics.fillRect(n19, n20, n18, n17);
      graphics.setColor(16671843);
      graphics.fillRect(n19 + 2, n20 + 2, n18 - 4, n17 - 4);
      n12 = n20 + 2 + 2;
      n11 = n19 + 2 + 2;
      switch (n7) {
        case 8: break;
        case 1: n11 = n19 + (n18 >> 1);
      }
      n10 = n8 - (n8 >> 1);
      if (G.d != null) {
        graphics.setColor(0x6699CC);
        graphics.fillRect(n19 + 2, n12 - 2, n18 - 4, n10 + 2);
        c2.drawString(graphics, G.d, n11, n12 - 7, n7);
        n12 += n10;
      }
      n9 = 0;
      while (n9 < G.b) {
        if (n9 === G.c) {
          graphics.setColor(0xFFFF00);
          graphics.fillRect(n19 + 2, n12, n18 - 4, n8);
        }
        if (G.drawIcon(graphics, n9, n11, n12)) n11 += 18;
        c2.drawString(graphics, G.g[G.e[n9]], n11, n12 + (n8 >> 1), n7 | 2);
        n12 += n8;
        if (G.a === 14 || G.a === 60 || G.a === 92 || G.a === 82) n11 -= 18;
        ++n9;
      }
      --G.h;
    }
    n12 = n20 + 2 + 2 + G.c * n8;
    n11 = n19 + 2 + 2;
    if (G.d != null) {
      n10 = n8 - (n8 >> 1);
      n12 += n10;
    }
    n10 = n18 - 4;
    let n21 = 0, n22 = 0;
    n9 = idiv(n10, 24);
    n21 = n9 * 24;
    if (n21 < n10) n22 = n10 - n21;
    let n23 = 0;
    for (let n24 = 0; n24 < 24; n24++) {
      G.glowColor(graphics, n24, true);
      graphics.fillRect(n19 + 2 + n23, n12, n9, n8);
      G.glowColor(graphics, n24, false);
      graphics.fillRect(n19 + 2 + n23, n12 + 1, n9, n8 - 2);
      n23 += n9;
    }
    if (n22 !== 0) {
      G.glowColor(graphics, 24, true);
      graphics.fillRect(n19 + 2 + n23, n12, n22, n8);
      G.glowColor(graphics, 24, false);
      graphics.fillRect(n19 + 2 + n23, n12 + 1, n22, n8 - 2);
    }
    if (G.drawIcon(graphics, G.c, n11, n12)) n11 += 18;
    c2.drawString(graphics, G.g[G.e[G.c]], n11, n12 + (n8 >> 1), n7 | 2);
    if (!G.j) {
      if (++G.i > 24) G.j = true;
    } else if (--G.i < 0) {
      G.j = false;
    }
  },

  // a(Graphics, int, boolean): colour of one strip of the selection glow
  glowColor(graphics, n2, bl) {
    let n3 = Math.abs(G.i - n2);
    if (bl) n3 = 24 - n3;
    const n4 = 256;
    const n5 = idiv((24 - n3) * n4, 24);
    let n6 = n5 * 255 + (n4 - n5) * 67;
    let n7 = n5 * 255 + (n4 - n5) * 137;
    let n8 = n5 * 0 + (n4 - n5) * 67;
    n6 = idiv(n6, n4);
    n7 = idiv(n7, n4);
    n8 = idiv(n8, n4);
    if (bl) { n6 -= 32; n7 -= 32; n8 -= 32; }
    n6 = n6 < 0 ? 0 : n6;
    n7 = n7 < 0 ? 0 : n7;
    n8 = n8 < 0 ? 0 : n8;
    graphics.setColor(n6, n7, n8);
  },

  // a(Graphics, int, int, int): pilot face in the "choose" menus
  drawIcon(graphics, n2, n3, n4) {
    if (G.a === 14 || G.a === 92) {
      if (n2 === 0 || B.af[n2 - 1]) graphics.drawImage(B.a8[43 + n2], n3, n4, 20);
      else graphics.drawImage(B.a8[51], n3, n4, 20);
      return true;
    }
    if (G.a === 60 || G.a === 82) {
      if (n2 === 0 || B.af[n2 - 1]) graphics.drawImage(B.a8[47 + n2], n3, n4, 20);
      else graphics.drawImage(B.a8[52], n3, n4, 20);
      return true;
    }
    return false;
  },

  // a(int): open the menu at entry n2
  open(n2) {
    B.h = false;
    G.h = 2;
    G.a = n2 << 1;
    G.reset();
  },

  // b(int): 0 = up, 1 = down, 2 = select
  nav(n2) {
    block0: switch (n2) {
      case 0:
        if (--G.c >= 0) break;
        G.c = G.b - 1;
        break;
      case 1:
        if (++G.c !== G.b) break;
        G.c = 0;
        break;
      case 2: {
        const n3 = G.e[G.c] << 1;
        switch (G.f[n3]) {
          case 3: {
            G.open(0);
            const by = G.f[n3 + 1];
            B.menuAction(by);
            break block0;
          }
        }
        B.h = false;
        G.a = n3;
        G.reset();
      }
    }
    G.h = 2;
  },

  // private a(boolean): parse one menu (bl = skip only)
  parse(bl) {
    let n2 = G.f[G.a + 1];
    if (!bl) {
      switch (G.f[G.a]) {
        case 0: G.d = null; break;
        case 1: G.d = G.g[G.a >> 1]; break;
        case 2: G.d = G.g[(G.a += 2) >> 1];
      }
    }
    G.a += 2;
    while (G.a < G.f.length && n2 > 0) {
      const by = G.f[G.a];
      switch (by) {
        case 0:
        case 1:
        case 2:
          // Web change: a web page cannot quit, so the main menu does not
          // list "Quit". The menu data is still read the same way.
          if (!bl && (G.a >> 1) !== G.QUIT_ENTRY) {
            G.e[G.b] = toByte(G.a >> 1);
            ++G.b;
          }
          --n2;
          G.parse(true);
          break;
        case 3:
          if (!bl) {
            G.e[G.b] = toByte(G.a >> 1);
            ++G.b;
          }
          --n2;
        // fall through
        default:
          G.a += 2;
      }
    }
  },

  // a()
  reset() {
    G.h = 2;
    G.b = 0;
    G.c = 0;
    G.parse(false);
  },

  // a(byte[])
  init(byArray) {
    G.f = byArray;
    G.e = new Int8Array(6);
    G.parse(false);
  },
};
