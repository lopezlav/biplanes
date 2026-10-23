// Port of class b: the game canvas. It holds the game state, the main loop,
// drawing of all screens, input handling and the network packets.
// Static fields keep their original one-letter names. The most used ones:
//   a   screen state: 0 title picture, 1 game, 2 menu, 3 text entry,
//       4 game over (closing circle), 5 score board, 6/7 score board
//       open/close, 8-10 result pages, 11 records, 12 help, 13 splash,
//       14 exit adverts
//   r,s screen width/height     ai,aj camera     ak,al camera limits
//   a6  the two planes (a6[0] is the local player)
//   a7  plane frames   a8 other pictures   a9 cloud   ba ground   bb sky
//   bk  game strings (/tg)   bl taunts (/tt)   bm,bn,bo fonts
//   as  game type: 0 = vs computer, 1 = Bluetooth
//   d   Bluetooth connected   g sound on   i taunts on   e world moves
//   ac,ad,ag,af  records: best accuracy, fewest hits taken, medal, unlocked
'use strict';

const B = {
  // ------------------------------------------------------------ fields
  a: 0, b: false, c: false, d: false, e: false, f: false, g: false, h: false, i: false, j: false,
  k: false, l: false, m: false, n: false,
  o: 0, p: 0, q: 0, r: 0, s: 0, t: 0, u: 0,
  v: [239, 16],
  w: null, x: 0, y: 10, z: 0,
  aa: null, ab: null, ac: null, ad: null, ae: null, af: null, ag: null,
  ah: 0, ai: 0, aj: 0, ak: 0, al: 0, am: 0, an: 0, ao: 0, ap: 0, aq: 0, ar: 0, as: 0,
  at: 0, au: 0, av: 0, aw: 0, ax: 0, ay: 0, az: 0, a0: 0, a1: 0, a2: 0, a3: 0, a4: 0,
  a5: null, a6: null, a7: null, a8: null, a9: null,
  ba: null, bb: null, bc: null, bd: null, be: null, bf: null,
  bg: null, bh: null, bi: null, bj: null,
  bk: null, bl: null, bm: null, bn: null, bo: null, bp: '', bq: null,
  br: null, bs: null, bt: 0, bu: null,
  bw: null, bx: null, by: null, bz: null, b0: 0, b1: 0,
  b3: [9578383, 2593407, 281486],
  b4: [0xFFFE00, 16768512, 16757760, 0xFF0101],
  b5: null, b6: null, b7: 0, b8: 0, b9: 0, ca: 0, cb: 0, cc: 0, cd: 0, ce: 0, cf: 0, cg: 0,
  ch: null, ci: null, cj: null, ck: null, cl: null, cm: null, cn: null, co: null,
  cp: ['Engine Sleep', 'Engine Latency', 'Bluetooth Sleep'],
  cq: 0, cr: 12, cs: 5, ct: 0, cu: 0, cv: 13, cw: 15, cx: 7, cy: 0, cz: 0,
  c0: 0, c1: 0, c2: null, c3: 0, c4: 0, c5: 0, c6: false, c7: false, c8: 0, c9: null,
  da: 0, db: 0, dc: 43, dd: new Array(40),
  de: new Uint8Array(8), df: null, dg: new Uint8Array(12), dh: new Uint8Array(15), di: new Uint8Array(4),
  dj: new Int32Array(256), dk: false,
  dl: [0, 2, 4, 7, 9, 11, 13, 16, 18, 20, 22, 24, 27, 29, 31, 33, 35, 37, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 73, 75, 77, 79, 81, 82, 84, 86, 87, 89, 91, 92, 94, 95, 97, 98, 99, 101, 102, 104, 105, 106, 107, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 119, 120, 121, 122, 122, 123, 124, 124, 125, 125, 126, 126, 126, 127, 127, 127, 128, 128, 128, 128, 128],
  dm: [[45, 27, 18, 14, 11, 9, 8, 7, 6, 6], [63, 45, 34, 27, 22, 18, 16, 14, 13, 11], [72, 56, 45, 37, 31, 27, 23, 21, 18, 17], [76, 63, 53, 45, 39, 34, 30, 27, 24, 22], [79, 68, 59, 51, 45, 40, 36, 32, 29, 27], [81, 72, 63, 56, 50, 45, 41, 37, 34, 31], [82, 74, 67, 60, 54, 49, 45, 41, 38, 35], [83, 76, 69, 63, 58, 53, 49, 45, 42, 39], [84, 77, 72, 66, 61, 56, 52, 48, 45, 42], [84, 79, 73, 68, 63, 59, 55, 51, 48, 45]],
  dn: 0, do: 0, dp: 0, dq: 0, dr: 0, ds: 0, dt: 0, du: 0, dv: 0, dw: 0,
  dx: null, dy: null, dz: null, d0: null, d1: null, d2: null,
  d3: 0, d4: 0, d5: 0, d6: false, d7: 0,
  d8: ['0_', '1-@', 'ABC2abc', 'DEF3def', 'GHI4ghi', 'JKL5jkl', 'MNO6mno', 'PQRS7pqrs', 'TUV8tuv', 'WXYZ9wxyz'],

  // web runtime
  screen: null,     // Graphics on the visible canvas
  pending: false,   // a repaint() is waiting
  onExit: null,

  // ------------------------------------------------------------ constructor b(BluetoothBiplanes)
  // Web: the screen is a Graphics of the display layer (render.js), w x h.
  async init(screen, w, h) {
    B.screen = screen;
    B.r = w;
    B.s = h;
    B.x = B.r === 128 ? 50 : 25;
    B.dn = 5;
    B.do = B.dn + 3;
    B.dt = B.r - 3;
    B.ds = B.dt - 2;
    B.dq = B.ds - 6;
    B.dp = B.ds - 8;
    B.dr = 0;
    B.d6 = false;
    B.d5 = Date.now();
    B.d7 = 500;
    B.dz = [2, 11];
    B.d0 = [10, 11];
    B.d1 = [B.s - 48, B.s - 28];
    B.d2 = [1, 0];
    B.dx = ['', ''];
    B.dy = [0, 0];
    B.b1 = 666;
    B.br = new Int8Array(18);
    B.w = new JRandom();
    B.bp = '';
    B.g = true;
    await B.load();
    B.repaint();
    B.i = true;
  },

  // ------------------------------------------------------------ network
  // a(boolean): called when the link closes (empty in the original)
  linkClosed(bl) {},

  // a(String): status text shown at the top while not connected
  setStatus(string) { B.bp = string; },

  // a(int, DataInputStream): one state packet from the other phone
  recvPacket(n2, dis) {
    try {
      B.an = n2;
      const e2 = B.a6[1];
      const e3 = B.a6[0];
      const br = B.br;
      dis.readFully(br);
      let n3 = 0;
      e2.a = br[n3++];
      if (e2.a === 2) e2.p = 0;
      e2.d = br[n3++] & 0xFF;
      e2.e = br[n3++] & 0xFF;
      e2.b = e2.d << 6;
      e2.c = e2.e << 6;
      e2.f = br[n3++];
      e3.p = br[n3++];
      let n4 = 2;
      while (--n4 >= 0) {
        const f2 = e2.av[n4];
        f2.a = br[n3++] & 0xFF;
        f2.b = br[n3++] & 0xFF;
      }
      for (let n5 = B.aq; n5 < B.ar; n5++) {
        B.aa[n5] = (br[n3++] & 0xFF) * 2;
        B.ab[n5] = (br[n3++] & 0xFF) * 2;
      }
      e2.v = br[n3++];
      if (e2.v !== 0) {
        e2.w = (br[n3++] & 0xFF) << 6;
        e2.x = (br[n3++] & 0xFF) << 6;
        e2.aa = br[n3++];
        e2.ac = br[n3++];
      }
      if (B.an > 1) e2.setAccuracy(br[n3++]);
      else e2.ae = br[n3++];
      const by = br[n3++];
      if ((by & 1) !== 0) {
        --e2.m;
        if (e2.m < 0) e2.m = 0;
        B.taunt(e3);
        B.updateScoreBox(e2);
      }
      if ((by & 2) !== 0) e2.explode();
      if ((by & 4) !== 0) {
        --e2.m;
        if (e2.m < 0) e2.m = 0;
        B.updateScoreBox(e2);
        B.taunt(e3);
      }
      if ((by & 8) !== 0) {
        e3.v = 3;
        e3.aa = 0;
        e2.m += 2;
        B.updateScoreBox(e2);
        B.taunt(e2);
      }
      if ((by & 0x10) !== 0) e2.ao.v = 5;
      if ((by & 0x20) !== 0) {
        e3.explode();
        if (e3.v === 0) {
          e3.v = 3;
          e3.aa = 0;
          ++e2.m;
          B.updateScoreBox(e2);
          B.taunt(e2);
          B.bt = toByte(B.bt + 64);
        }
      }
      if ((by & 0x40) !== 0) {
        ++e3.m;
        B.updateScoreBox(e3);
        B.taunt(e3);
      }
      if ((by & 0x80) !== 0) B.checkWin();
    } catch (exception) {
      console.error(exception);
    }
  },

  // b(boolean): result of the connection attempt
  connected(bl) {
    B.d = bl;
    if (B.d) {
      B.a6[1].ap = true;
      B.o = B.a6[0] === B.bx ? 1 : 2;
    } else {
      B.bp = B.bk[44];
    }
    return B.d;
  },

  // a(): step through the result pages after a won game
  nextResult() {
    switch (B.a) {
      case 7:
        if (B.as === 1 || B.by !== B.bw) {
          B.a = 2;
          return;
        }
        B.a = 8;
        if (B.m) break;
        B.nextResult();
        break;
      case 8:
        B.a = 9;
        if (B.n) break;
        B.nextResult();
        break;
      case 9:
        B.a = 10;
        if (B.l) break;
        B.nextResult();
        break;
      case 10:
        B.a = 2;
    }
    B.repaint();
  },

  // j(int): unlock pilot n2
  unlock(n2) {
    B.af[n2] = true;
    B.loadMenuStrings();
  },

  // n(): read the menu strings again and hide names of locked pilots
  loadMenuStrings() {
    try {
      G.g = B.readStrings('/tm');
      let n2 = 3;
      while (--n2 >= 0) {
        if (B.af[n2]) continue;
        G.g[4 + n2] = B.bk[5];
        G.g[27 + n2] = B.bk[5];
        G.g[38 + n2] = B.bk[5];
        G.g[43 + n2] = B.bk[5];
      }
    } catch (exception) {
      console.error(exception);
    }
  },

  // o(): load all resources
  async load() {
    B.bm = await C.load('/f');
    B.bn = await C.load('/fzr');
    B.bo = await C.load('/fzb');
    B.bk = B.readStrings('/tg');
    B.bl = B.readStrings('/tt');
    B.b5 = new Int32Array(3);
    B.b6 = new Int32Array(3);
    B.ac = new Int32Array(4);
    B.ad = new Int32Array(4);
    let n2 = 4;
    while (--n2 >= 0) B.ad[n2] = 10;
    B.ag = new Array(4).fill(false);
    B.af = new Array(3).fill(false);
    B.g = true;
    B.i = true;
    if (!B.loadRecords()) B.saveRecords(true);
    B.cd = B.bm.width(B.bk[11] + ' 100% ');
    B.cl = MImage.createMutable(B.cd, 15);
    B.cm = MImage.createMutable(B.cd, 15);
    B.cn = B.cl.getGraphics();
    B.co = B.cm.getGraphics();
    B.loadMenuStrings();
    B.ak = 255 - B.r;
    B.al = 208 - B.s;
    B.bu = [];
    for (let n3 = 0; n3 < 50; n3++) B.bu[n3] = new D();
    B.aa = new Int32Array(2);
    B.ab = new Int32Array(2);
    B.ae = [false, false];
    let n4 = 2;
    while (--n4 >= 0) {
      B.aa[n4] = B.rnd(255);
      B.ab[n4] = B.rnd(104);
      B.ae[n4] = B.rnd(2) === 0;
    }
    B.ay = B.rnd(255) << 6;
    B.az = B.rnd(104);
    B.a6 = [];
    let n5 = 2;
    while (--n5 >= 0) B.a6[n5] = new E(n5 === 0);
    B.a6[0].ao = B.a6[1];
    B.a6[1].ao = B.a6[0];
    B.a5 = Res.get('/r');
    const byArray = B.readBlock();
    B.x = toByte(byArray[0]);
    B.z = toByte(byArray[1]);
    B.bs = Int8Array.from(B.readBlock(), toByte);
    const byArray2 = Int8Array.from(B.readBlock(), toByte);
    G.init(byArray2);
    B.readPngParts();
    B.a7 = await B.readImages(32);
    B.ba = await B.readImage();
    B.bb = await B.readImage();
    const image = await B.readImage();
    B.t = image.getWidth();
    B.u = image.getHeight();
    B.bc = MImage.createMutable(B.t, B.u);
    B.bg = B.bc.getGraphics();
    B.bg.drawImage(image, 0, 0, 20);
    B.bd = MImage.createMutable(26, 9);
    B.bh = B.bd.getGraphics();
    B.a8 = await B.readImages(72);
    B.a9 = await B.readRawImages(1);
    const n6 = B.a8[69].getWidth();
    const n7 = B.a8[69].getHeight();
    B.be = MImage.createMutable(n6, n7);
    B.bi = B.be.getGraphics();
    B.bf = MImage.createMutable(128, 100);
    B.bj = B.bf.getGraphics();
    H.load(B.a5);
    B.a5 = null;
    B.cy = -1;
    B.a = 13;
  },

  // c(boolean): write the records (bl = first time)
  saveRecords(bl) {
    try {
      B.k = true;
      const recordStore = RecordStore.openRecordStore('s', true);
      const dos = new DataOutputStream();
      if (recordStore.getSizeAvailable() >= 600) {
        for (let n2 = 0; n2 < 3; n2++) dos.writeBoolean(B.af[n2]);
        for (let n3 = 0; n3 < 4; n3++) {
          dos.writeByte(B.ac[n3]);
          dos.writeBoolean(B.ag[n3]);
          dos.writeByte(B.ad[n3]);
        }
        dos.writeBoolean(B.g);
        dos.writeBoolean(B.i);
        const byArray = dos.toByteArray();
        if (bl) recordStore.addRecord(byArray, 0, byArray.length);
        else recordStore.setRecord(1, byArray, 0, byArray.length);
        B.k = false;
      }
      recordStore.closeRecordStore();
    } catch (exception) {
      console.error(exception);
      B.k = true;
    }
  },

  // b(): read the records
  loadRecords() {
    try {
      const recordStore = RecordStore.openRecordStore('s', true);
      if (recordStore.getNumRecords() > 0) {
        const dis = new DataInputStream(recordStore.getRecord(1));
        for (let n2 = 0; n2 < 3; n2++) B.af[n2] = dis.readBoolean();
        for (let n3 = 0; n3 < 4; n3++) {
          B.ac[n3] = dis.readByte();
          B.ag[n3] = dis.readBoolean();
          B.ad[n3] = dis.readByte();
        }
        B.g = dis.readBoolean();
        B.i = dis.readBoolean();
        recordStore.closeRecordStore();
        return true;
      }
      recordStore.closeRecordStore();
    } catch (exception) {}
    return false;
  },

  // a(int, int): play a sound if sound is on
  playSound(n2, n3) {
    try {
      if (B.g) H.play(n2, n3);
    } catch (exception) {
      console.error(exception);
    }
  },

  // a(int x7): throw n2 debris particles from (n3, n4)
  spawnDebris(n2, n3, n4, n5, n6, n7, n8) {
    let n9 = 50;
    while (--n9 >= 0) {
      if (B.bu[n9].a !== -1) continue;
      let n10 = n6 - n5;
      const n11 = B.rnd(n10) + n5;
      n10 = n8 - n7;
      const n12 = B.rnd(n10) + n7;
      B.bu[n9].init(n3, n4, n11, n12);
      if (--n2 !== 0) continue;
      return;
    }
  },

  // a(e): put a plane back on its start position
  respawn(e2) {
    if (B.as === 1) {
      if (J.d) e2.reset(0, B.v[1], 180, 3);
      else e2.reset(0, B.v[0], 180, 2);
    } else if (B.as === 0) {
      if (e2 === B.a6[0]) e2.reset(0, B.v[1], 180, 3);
      else e2.reset(0, B.v[0], 180, 2);
    }
  },

  // run(): one pass of the main thread loop. Returns false to stop.
  tick() {
    B.ah = Date.now();
    B.handleInput();
    if (B.cy >= 0) {
      B.repaint();
      return true;
    }
    switch (B.a) {
      case 14:
        if (++B.p !== 50) break;
        B.p = 0;
        if (++B.q === 3) {
          B.c = true;
          if (B.onExit) B.onExit();
          return false;
        }
        B.repaint();
        break;
      case 2:
        B.repaint();
        break;
      case 5:
      case 6:
      case 7:
        B.repaint();
        break;
      case 0:
        if (++B.a2 <= 120) break;
        B.a = 2;
        break;
      case 13:
        if (B.a2 === 0) B.playSound(0, 1);
        if (++B.a2 <= 120) break;
        B.a2 = 0;
        B.a = 0;
        B.repaint();
        break;
      case 3:
        B.repaint();
        break;
      case 1:
      case 4: {
        if (B.as === 0) B.e = true;
        else if (B.as === 1) B.e = !B.d || B.am - B.an < 2;
        if (!B.e) {
          if (++B.a4 > 50) {
            if (B.cy === -1) B.showMessage(B.bk[18], 0);
            B.a4 = 0;
          }
        } else {
          B.a4 = 0;
        }
        if (B.e && B.d && B.as === 1) {
          const e2 = B.a6[0];
          const br = B.br;
          let n2 = 0;
          br[n2++] = e2.a;
          br[n2++] = e2.d;
          br[n2++] = e2.e;
          let n3 = e2.f;
          if (e2.i === 3) n3 += 16;
          br[n2++] = n3;
          br[n2++] = e2.ao.p;
          if (e2.ao.p > 2) e2.ao.p = 0;
          let n4 = 2;
          while (--n4 >= 0) {
            br[n2++] = e2.av[n4].a;
            br[n2++] = e2.av[n4].b;
          }
          for (let n5 = B.ao; n5 < B.ap; n5++) {
            br[n2++] = idiv(B.aa[n5], 2);
            br[n2++] = idiv(B.ab[n5], 2);
          }
          br[n2++] = e2.v;
          if (e2.v !== 0) {
            br[n2++] = e2.w >> 6;
            br[n2++] = e2.x >> 6;
            br[n2++] = e2.aa;
            br[n2++] = e2.ac;
          }
          br[n2++] = B.am > 1 ? e2.af : e2.ae;
          br[n2++] = B.bt;
          B.bt = 0;
          // In the original one try block covers the whole pass: a failed
          // write skips ++am and the repaint.
          try {
            B.bq.c.writeInt(B.am);
            B.bq.c.write(br);
            B.bq.c.flush();
          } catch (exception) {
            console.error(exception);
            return true;
          }
          ++B.am;
        }
        B.repaint();
      }
    }
    return true;
  },

  // c(): serviceRepaints() + repaint()
  repaint() {
    if (B.pending) B.paintNow();
    B.pending = true;
  },

  // The display layer (render.js) runs paint().
  paintNow() {
    R.paint();
  },

  // d(): start the next Bluetooth game on the same link
  restartLinkGame() {
    B.bw.ap = true;
    B.bx.ap = true;
    if (B.o === 1) {
      B.a6[0].init(0, B.v[0], 180, 2);
      B.a6[1].init(0, B.v[1], 180, 3);
    } else {
      B.a6[0].init(0, B.v[1], 180, 3);
      B.a6[1].init(0, B.v[0], 180, 2);
    }
    B.am = 0;
    B.an = 0;
    B.a4 = 0;
    B.as = 1;
    B.a = 1;
  },

  // a(int): menu command n2
  menuAction(n2) {
    switch (n2) {
      case 6:
        B.showMessage(B.bk[36], 0);
        break;
      case 33:
        B.showMessage(B.bk[37], 0);
        break;
      case 7:
        B.a = 11;
        break;
      case 21:
        if (B.as !== 1) break;
        B.bq.quit();
        B.bp = '';
        B.o = 0;
        B.d = false;
        break;
      case 13:
        B.a = 12;
        B.at = 0;
        break;
      case 8:
        B.i = true;
        B.saveRecords(false);
        break;
      case 9:
        B.i = false;
        B.saveRecords(false);
        break;
      case 10:
        B.g = true;
        B.saveRecords(false);
        break;
      case 11:
        B.g = false;
        B.saveRecords(false);
        break;
      case 20:
        B.a = 1;
        break;
      case 24:
      case 25:
      case 26:
      case 27:
        // Start Bluetooth Game (this phone waits for the other)
        if (n2 === 24 || B.af[n2 - 1 - 24]) {
          if (B.bq) B.bq.dispose();
          B.bq = new J();
          B.bq.start(false);
          B.d = false;
          B.bx = B.a6[0];
          B.bw = B.a6[1];
          B.a6[1].ae = -1;
          B.a6[0].init(0, B.v[0], 180, 2);
          B.a6[1].init(0, B.v[1], 180, 3);
          B.bw.ap = false;
          B.am = 0;
          B.an = 0;
          B.a4 = 0;
          B.aq = 0;
          B.ar = 1;
          B.ao = 1;
          B.ap = 2;
          B.as = 1;
          B.a6[0].ae = 39 + n2 - 24;
          B.a = 1;
          B.au = 30;
          break;
        }
        B.showMessage(B.bk[8], 0);
        G.open(0);
        break;
      case 28:
      case 29:
      case 30:
      case 31:
        // Join Bluetooth Game (this phone searches)
        if (n2 === 28 || B.af[n2 - 1 - 28]) {
          if (B.bq) B.bq.dispose();
          B.bq = new J();
          B.bq.start(true);
          B.d = false;
          B.bw = B.a6[0];
          B.bx = B.a6[1];
          B.a6[0].init(0, B.v[1], 180, 3);
          B.a6[1].init(0, B.v[0], 180, 2);
          B.bx.ap = false;
          B.a6[1].ae = -1;
          B.updateScoreBox(B.bx);
          B.am = 0;
          B.an = 0;
          B.a4 = 0;
          B.ao = 0;
          B.ap = 1;
          B.aq = 1;
          B.ar = 2;
          B.as = 1;
          B.a6[0].ae = 35 + n2 - 28;
          B.a = 1;
          B.au = 30;
          break;
        }
        B.showMessage(B.bk[8], 0);
        G.open(0);
        break;
      case 0:
      case 1:
      case 2:
      case 3:
        if (n2 === 0 || B.af[n2 - 1]) {
          B.a6[0].ae = 35 + n2;
          G.open(25);
          break;
        }
        B.showMessage(B.bk[8], 0);
        break;
      case 16:
      case 17:
      case 18:
      case 19:
        if (n2 - 16 === 0 || B.af[n2 - 16 - 1]) {
          B.a6[1].ae = 39 + n2 - 16;
          B.a6[1].u = n2 - 16;
          B.a6[0].init(0, B.v[1], 180, 3);
          B.a6[1].init(0, B.v[0], 180, 2);
          B.as = 0;
          G.open(33);
          break;
        }
        B.showMessage(B.bk[8], 0);
        break;
      case 23:
        B.j = true;
        B.a = 1;
        B.au = 30;
        break;
      case 22:
        B.j = false;
        B.a = 1;
        B.au = 30;
        break;
      case 32:
        B.restartLinkGame();
        break;
      case 5:
        G.open(41);
        break;
      case 4:
        G.open(36);
        break;
      case 14:
        B.ba = null;
        B.bb = null;
        B.a = 14;
        B.p = 0;
        B.q = -1;
    }
  },

  // e(): handle one queued key action and the held keys
  handleInput() {
    if (B.b0 > 0) {
      --B.b0;
      return;
    }
    const n2 = I.next();
    if (B.cy >= 0) {
      switch (n2) {
        case 10:
          B.scrollMessage(1);
          B.cz = 0;
          break;
        case 11:
          B.scrollMessage(2);
          B.cz = 0;
          break;
        case 16:
          if (B.c7) {
            B.cy = -1;
            B.repaint();
            break;
          }
          B.scrollMessage(2);
          B.cz = 0;
      }
      return;
    }
    block5: switch (B.a) {
      case 11:
        if (n2 === 16) {
          B.a = 2;
          B.h = false;
        }
        if (n2 !== 15) break;
        B.showMessage(B.bk[21], 0);
        break;
      case 12:
        if (n2 === 16) {
          B.a = 2;
          B.h = false;
        }
        if (n2 !== 15) break;
        if (++B.at === 3) B.at = 0;
        B.repaint();
        break;
      case 8:
      case 9:
      case 10:
        if (n2 !== 16) break;
        B.nextResult();
        return;
      case 5:
        if (n2 === -66) break;
        B.a = 7;
        B.a1 = Math.max(B.r, B.s) >> 1;
        break;
      case 3: {
        // Text entry ("send to a friend"); no menu opens this state.
        switch (n2) {
          case 15:
            B.h = false;
            B.a = 2;
            break;
          case 16: {
            let string = B.bk[3] + B.dx[0];
            string = string + B.bk[4];
            B.sendText(B.dx[1], string);
            B.h = false;
            B.a = 2;
          }
        }
        if (n2 === -66) return;
        let bl = false;
        let n4 = 666;
        for (let n5 = 0; n5 !== 10; n5++) {
          if (n2 === n5) {
            n4 = n5;
            bl = true;
            break;
          }
        }
        B.d3 = Date.now() - B.d4;
        B.d4 = Date.now();
        const n6 = 1050;
        if (!bl) {
          if (n2 === 19) {
            n4 = 19;
          } else {
            if (n2 === 20 && B.dw > 0) {
              B.selectField(B.dw - 1);
              B.b1 = n4;
              return;
            }
            if (n2 === 21 && B.dw < 1) {
              B.selectField(B.dw + 1);
              B.b1 = n4;
              return;
            }
          }
        }
        if (n4 === 666) return;
        if (!(B.dx[B.dw].length < B.d0[B.dw] || (bl && B.d3 < n6 && B.b1 === n4 && B.d2[B.dw] !== 0))) {
          if (bl) return;
          if (n2 !== 19) return;
        }
        const dw = B.dw;
        const sb = B.dx[dw];
        if (B.d2[dw] === 0) {
          if (bl) {
            B.dx[dw] = sb + n4;
            ++B.du;
          } else if (n2 === 19) {
            if (--B.du < 0) B.du = 0;
            else B.dx[dw] = sb.slice(0, B.du) + sb.slice(B.du + 1);
          }
        } else if (bl) {
          if (B.d3 < n6 && B.b1 === n4) {
            B.d6 = false;
            B.d5 = Date.now() + B.d7;
            --B.du;
            if (++B.dv >= B.d8[n4].length) B.dv = 0;
            B.dx[dw] = sb.slice(0, B.du) + B.d8[n4][B.dv] + sb.slice(B.du + 1);
            ++B.du;
          } else {
            B.dv = 0;
            B.dx[dw] = sb + B.d8[n4][B.dv];
            ++B.du;
          }
        } else if (n2 === 19) {
          if (--B.du < 0) B.du = 0;
          else B.dx[dw] = sb.slice(0, B.du) + sb.slice(B.du + 1);
        }
        B.b1 = n4;
        break;
      }
      case 2:
        switch (n2) {
          case 10:
            G.nav(0);
            break;
          case 11:
            G.nav(1);
            break;
          case 14:
          case 15:
            G.nav(2);
            break;
          case 16:
            if (G.a === 66 || G.a === 50) break;
            G.open(0);
        }
        B.repaint();
        break;
      case 1:
      case 4: {
        if (I.held(10)) {
          if (B.f) {
            if (--B.cq < 0) B.cq = 2;
            B.b0 = 3;
            return;
          }
          B.a6[0].accelerate();
        }
        if (I.held(11)) {
          if (B.f) {
            B.b0 = 3;
            if (++B.cq === 3) B.cq = 0;
            return;
          }
          B.a6[0].decelerate();
        }
        if (I.held(12)) {
          if (B.f) {
            switch (B.cq) {
              case 0: if (--B.x < 0) B.x = 0; break;
              case 1: if (--B.y < 0) B.y = 0; break;
              case 2: if (--B.z < 0) B.z = 0;
            }
            return;
          }
          B.a6[0].turn(2);
        }
        if (I.held(13)) {
          if (B.f) {
            switch (B.cq) {
              case 0: ++B.x; break;
              case 1: ++B.y; break;
              case 2: ++B.z;
            }
            return;
          }
          B.a6[0].turn(3);
        }
        if (I.held(14)) B.a6[0].fire();
        switch (n2) {
          case 17:
            B.a6[0].eject();
            break block5;
          case 16:
            G.open(30);
            B.a = 2;
        }
      }
    }
  },

  keyPressed(n2) { I.pressed(n2); },
  keyReleased(n2) { I.released(n2); },

  // a(Graphics): move and draw the game world
  drawWorld(graphics) {
    graphics.layer = 'world';   // web: marks for the display layer
    if (B.a6[0].v === 0) {
      B.ai = B.a6[0].d - (B.r >> 1);
      B.aj = B.a6[0].e - (B.s >> 1);
    } else {
      B.ai = (B.a6[0].w >> 6) - (B.r >> 1);
      B.aj = (B.a6[0].x >> 6) - (B.s >> 1);
    }
    B.ai = B.ai < 0 ? 0 : (B.ai > B.ak ? B.ak : B.ai);
    B.aj = B.aj < 0 ? 0 : (B.aj > B.al ? B.al : B.aj);
    const n3 = 124;
    graphics.setColor(52479);
    graphics.fillRect(0, 0, B.r, n3);
    graphics.translate(-B.ai, -B.aj);
    graphics.space = 'world';
    for (let n4 = 0; n4 < 255; n4 += 128) {
      graphics.drawImage(B.ba, n4, n3, 20);
      graphics.drawImage(B.bb, n4, 0, 20);
    }
    const n5 = B.ay >> 6;
    graphics.tag = 'ship';
    graphics.drawImage(B.a8[57], n5, B.az, 20);
    graphics.drawImage(B.bd, n5 + B.cw, B.az + B.cx, 20);
    graphics.tag = null;
    if (B.e) {
      B.ay += 16;
      if (n5 > 255) {
        B.ay = -3200;
        B.az = B.rnd(104);
      }
    }
    let n6 = 2;
    while (--n6 >= 0) {
      const e2 = B.a6[n6];
      if (!e2.ap) continue;
      if (B.as === 0 && n6 === 1) e2.think();
      e2.update(graphics, B.e && (B.as === 0 || n6 === 0));
    }
    graphics.drawImage(B.a8[1], 109, 168, 20);
    let n7 = 2;
    while (--n7 >= 0) {
      let bl = false;
      graphics.tag = 'cloud' + n7;
      graphics.drawImage(B.a9[0], B.aa[n7], B.ab[n7], 3);
      graphics.tag = null;
      if (B.as === 1) {
        if ((J.d && n7 < B.ap) || (!J.d && n7 >= B.ao)) bl = true;
      } else {
        bl = true;
      }
      if (!bl || !B.e || B.rnd(3) !== 0) continue;
      if (B.ae[n7]) {
        B.aa[n7] = B.aa[n7] - 2;
        if (B.aa[n7] >= -32) continue;
        B.aa[n7] = 287;
        B.ab[n7] = B.rnd(104);
        continue;
      }
      B.aa[n7] = B.aa[n7] + 2;
      if (B.aa[n7] <= 287) continue;
      B.aa[n7] = -32;
      B.ab[n7] = B.rnd(104);
    }
    let n10 = 50;
    while (--n10 >= 0) {
      if (B.bu[n10].a === -1) continue;
      graphics.tag = 'debris' + n10;
      B.bu[n10].update(graphics);
      graphics.tag = null;
    }
    graphics.translate(B.ai, B.aj);
    graphics.space = null;
    if (B.s < 208) {
      const n11 = idiv(B.r * B.r, 255);
      const n12 = idiv(B.ai * n11, B.ak);
      graphics.setColor(0x660000);
      graphics.fillRect(0, B.s - 2, B.r, 2);
      graphics.setColor(0xFF0000);
      graphics.fillRect(n12, B.s - 2, n11, 2);
    }
    if (B.a === 1 && (B.as === 0 || B.d)) {
      // Arrow at the screen edge that points to the enemy plane
      const e3 = B.as === 0 ? B.bx : B.a6[1];
      const n13 = e3.d;
      const n14 = e3.e;
      if (!B.inView(n13 - 8, n14 - 8, 16, 16)) {
        const e4 = e3.ao;
        const n15 = B.angleTo(e4.d, e4.e, n13, n14);
        if (n15 >= 45 && n15 < 135) {
          let n16 = n14 - B.aj;
          if (n16 < 4) n16 = 4;
          else if (n16 > B.s - 4) n16 = B.s - 4;
          graphics.drawImage(B.a8[63], B.r, n16, 10);
        } else if (n15 >= 135 && n15 < 225) {
          let n17 = n13 - B.ai;
          if (n17 < 4) n17 = 4;
          else if (n17 > B.r - 4) n17 = B.r - 4;
          graphics.drawImage(B.a8[61], n17, B.s, 33);
        } else if (n15 >= 225 && n15 < 315) {
          let n18 = n14 - B.aj;
          if (n18 < 4) n18 = 4;
          else if (n18 > B.s - 4) n18 = B.s - 4;
          graphics.drawImage(B.a8[62], 0, n18, 6);
        } else if (n15 > 315 || n15 < 45) {
          let n19 = n13 - B.ai;
          if (n19 < 4) n19 = 4;
          else if (n19 > B.r - 4) n19 = B.r - 4;
          graphics.drawImage(B.a8[60], n19, 0, 17);
        }
      }
    }
    if (B.aw > 0) {
      if (B.i && (B.as === 0 || B.d)) {
        if (B.ax === 3) graphics.drawImage(B.bc, 2, 2, 20);
        else graphics.drawImage(B.bc, B.r - 2, 2, 24);
      }
      if (--B.aw === 0) B.checkWin();
    }
    if (B.au > 0) {
      B.drawSoftKey(graphics, B.bk[38], false);
      --B.au;
    }
    graphics.layer = null;
  },

  // a(int, int, int, int): is the box on screen
  inView(n2, n3, n4, n5) {
    return n2 >= B.ai - n4 && n2 <= B.ai + B.r && n3 >= B.aj - n5 && n3 <= B.aj + B.s;
  },

  // g(): end the game when a pilot has 10 points
  checkWin() {
    if (B.as === 0 && !B.j) {
      if (B.a6[0].m >= 10) {
        B.by = B.a6[0];
        B.bz = B.a6[1];
        B.l = false;
        B.m = false;
        let bl = false;
        B.n = B.by.at;
        B.a3 = B.a6[1].u;
        if (B.bz.m < B.ad[B.a3]) {
          B.ad[B.a3] = B.bz.m;
          bl = true;
        }
        if (B.by.af > B.ac[B.a3]) {
          B.ac[B.a3] = B.by.af;
          B.m = true;
        }
        if (B.n) B.ag[B.a3] = true;
        if (B.a3 < 3 && !B.af[B.a3]) {
          B.unlock(B.a3);
          B.l = true;
        }
        if (B.l || B.m || B.n || bl) B.saveRecords(false);
        G.open(0);
        B.a = 4;
        if (B.as === 1) B.bt = toByte(B.bt + 128);
      } else if (B.a6[1].m >= 10) {
        G.open(0);
        B.a = 4;
        B.by = B.a6[1];
        B.bz = B.a6[0];
      }
    } else if (B.as === 1) {
      if (B.a6[0].m >= 10) {
        B.by = B.a6[0];
        B.bz = B.a6[1];
        G.open(0);
        B.a = 4;
      } else if (B.a6[1].m >= 10) {
        B.bz = B.a6[0];
        B.by = B.a6[1];
        G.open(0);
        B.a = 4;
      }
    }
    if (B.a === 4) B.a1 = Math.max(B.r, B.s) >> 1;
  },

  // b(e): show a taunt from the pilot of plane e2
  taunt(e2) {
    B.aw = 45;
    if (!B.i || (B.as === 1 && !B.d) || e2.ae === -1) return;
    B.av = e2.ae;
    B.ax = e2.i;
    let n2 = (B.av - 35) * 4;
    if (e2.m < e2.ao.m) n2 += 2;
    const stringArray = B.bm.wrap(B.bl[n2 += B.rnd(2)], B.t - 12 - 32);
    B.bg.setColor(0xFFFFFF);
    B.bg.fillRect(4, 2, B.t - 8 + 1, B.u - 4);
    const image = B.a8[B.av];
    if (B.ax === 3) {
      B.bg.drawImage(image, 4, 4, 20);
      B.bm.drawLines(B.bg, stringArray, 40, 4, 20);
    } else {
      B.bg.drawImage(image, B.t - 4, 4, 24);
      B.bm.drawLines(B.bg, stringArray, B.t - 8 - 32, 4, 24);
    }
  },

  // b(Graphics): records screen
  drawRecords(graphics) {
    graphics.setColor(52479);
    graphics.fillRect(0, 0, B.r, B.s);
    const bi = B.bi;
    bi.setColor(16751203);
    bi.fillRect(2, 2, 103, 78);
    bi.drawImage(B.a8[69], 0, 0, 20);
    bi.fillRect(11, 58, 77, 18);
    let n2 = 8;
    for (let n3 = 0; n3 < 4; n3++) {
      bi.setColor(B.b4[n3]);
      bi.fillRect(4, n2, 96, 13);
      let image = B.a8[47 + n3];
      if (n3 > 0 && !B.af[n3 - 1]) image = B.a8[52];
      bi.drawImage(image, 7, n2 - 1, 20);
      B.bm.drawString(bi, B.ac[n3] + '%', 65, n2 + 7, 6);
      if (B.ad[n3] < 10) B.bm.drawString(bi, '10-' + B.ad[n3], 26, n2 + 7, 6);
      if (B.ag[n3]) bi.drawImage(B.a8[71], 87, n2 - 1, 20);
      n2 += 17;
    }
    bi.drawImage(B.a8[70], 50, 8, 20);
    const n4 = B.r >> 1;
    const n5 = B.s >> 1;
    graphics.drawImage(B.be, n4, n5, 3);
    B.bm.drawString(graphics, B.bk[19], n4 - (B.be.getWidth() >> 1) + 8, n5 - (B.be.getHeight() >> 1) - 4, 20);
    B.drawSoftKey(graphics, B.bk[7], false);
    B.drawSoftKey(graphics, B.bk[20], true);
  },

  // c(Graphics): help screens (keys)
  drawHelp(graphics) {
    graphics.setColor(52479);
    graphics.fillRect(0, 0, B.r, B.s);
    const bj = B.bj, bm = B.bm, bk = B.bk;
    bj.setColor(15466636);
    bj.fillRect(0, 0, 128, 100);
    bj.setColor(16751203);
    bj.fillRect(2, 2, 124, 96);
    bj.setColor(0xFFFF00);
    bj.fillRect(57, 7, 12, 60);
    bj.fillRect(7, 34, 114, 12);
    if (B.at === 0) bj.fillRect(5, 68, 12, 10);
    if (B.at !== 2) bj.fillRect(5, 80, 12, 10);
    switch (B.at) {
      case 0: {
        bj.drawImage(B.a7[17], 63, 39, 3);
        bm.drawString(bj, bk[22], 62, 14, 3);
        bm.drawString(bj, bk[23], 62, 60, 3);
        let stringArray = bm.wrap(bk[25], 46);
        bm.drawLines(bj, stringArray, 4, 32, 20);
        stringArray = bm.wrap(bk[24], 46);
        bm.drawLines(bj, stringArray, 124, 32, 24);
        bm.drawString(bj, '#', 11, 73, 3);
        bm.drawString(bj, '*', 11, 85, 3);
        bm.drawString(bj, bk[26], 20, 73, 6);
        bm.drawString(bj, bk[27], 20, 85, 6);
        bm.drawString(bj, bk[23], 62, 60, 3);
        break;
      }
      case 1: {
        bj.drawImage(B.a8[21], 63, 42, 3);
        bj.drawImage(B.a8[28], 63, 32, 3);
        let stringArray = bm.wrap(bk[28], 46);
        bm.drawLines(bj, stringArray, 4, 32, 20);
        stringArray = bm.wrap(bk[29], 46);
        bm.drawLines(bj, stringArray, 124, 32, 24);
        bm.drawString(bj, '*', 11, 85, 3);
        bm.drawString(bj, bk[30], 20, 85, 6);
        break;
      }
      case 2: {
        bj.setClip(46, 40, 33, 16);
        bj.drawImage(B.ba, 0, 60, 36);
        bj.setClip(0, 0, 128, 100);
        bj.drawImage(B.a8[23], 63, 37, 3);
        let stringArray = bm.wrap(bk[28], 46);
        bm.drawLines(bj, stringArray, 4, 32, 20);
        stringArray = bm.wrap(bk[29], 46);
        bm.drawLines(bj, stringArray, 124, 32, 24);
        bm.drawString(bj, bk[31], 5, 87, 6);
      }
    }
    B.drawSoftKey(graphics, bk[7], false);
    B.drawSoftKey(graphics, bk[6], true);
    graphics.drawImage(B.bf, B.r >> 1, B.s >> 1, 3);
  },

  // d(Graphics): result pages 8, 9, 10
  drawResult(graphics) {
    graphics.setColor(52479);
    graphics.fillRect(0, 0, B.r, B.s);
    const bi = B.bi;
    bi.setColor(B.b3[B.a - 8]);
    bi.fillRect(2, 2, 103, 78);
    bi.drawImage(B.a8[69], 0, 0, 20);
    bi.setColor(0xFFFFFF);
    bi.fillRect(13, 60, 62, 14);
    bi.drawImage(B.a8[B.by.ae + 8], 6, 6, 20);
    let n2 = B.bz.ae + 8;
    if (B.a === 10) n2 = 48 + B.a3;
    bi.drawImage(B.a8[n2], 85, 60, 20);
    B.bm.drawString(bi, B.bk[12 + B.a - 8], 41, 66, 3);
    const stringArray = B.bm.wrap(B.bk[15 + B.a - 8], 78);
    B.bm.drawLines(bi, stringArray, 25, 6, 20);
    if (B.a === 9) bi.drawImage(B.a8[68], 6, 23, 20);
    graphics.drawImage(B.be, B.r >> 1, B.s >> 1, 3);
    B.drawSoftKey(graphics, B.bk[7], false);
  },

  // e(Graphics): score board with the two pilots flying past
  drawScoreBoard(graphics) {
    let n2;
    const n3 = 124;
    graphics.setColor(52479);
    graphics.fillRect(0, 0, B.r, n3);
    graphics.translate(-B.ce, 0);
    for (let n4 = 0; n4 < 255 + B.ce; n4 += 128) {
      graphics.drawImage(B.ba, n4, n3, 20);
      graphics.drawImage(B.bb, n4, 0, 20);
    }
    graphics.translate(B.ce, 0);
    if ((B.ce += 2) > 128) B.ce = 0;
    let n5 = 3;
    while (--n5 >= 0) {
      B.b5[n5] = B.b5[n5] - (1 + n5);
      graphics.drawImage(B.a9[0], B.b5[n5], B.b6[n5], 3);
      if (B.b5[n5] >= -32) continue;
      n2 = idiv(B.s, 3);
      B.b6[n5] = n2 * n5 + B.rnd(n2);
      B.b5[n5] = B.r + 32;
    }
    n2 = B.b7 >> 6;
    const n7 = B.b9 >> 6;
    const n8 = B.b8 >> 6;
    const n9 = B.cb >> 6;
    graphics.drawImage(B.a8[64], n2, 20, 10);
    graphics.drawImage(B.cj, n2 - 25, 17, 10);
    const n10 = B.rnd(3);
    const n11 = B.ca >> 6;
    graphics.drawImage(B.a8[64], n7, 80 + n10 + n11, 10);
    graphics.drawImage(B.ck, n7 - 25, 77 + n10 + n11, 10);
    graphics.drawImage(B.a8[14 + B.rnd(3)], n7 - 56, 75 + n11, 3);
    graphics.drawImage(B.a8[14 + B.rnd(3)], n7 - 14, 85 + n11, 3);
    graphics.drawImage(B.a8[14 + B.rnd(3)], n7 - 38, 93 + n11, 3);
    if (B.cf - 32 - (B.cd >> 1) < B.r >> 1) B.cf = n8;
    graphics.drawImage(B.a8[65], B.cf - 24, 50, 10);
    graphics.drawImage(B.cl, B.cf - 32, 50, 10);
    graphics.drawImage(B.a8[66], B.cf - 32 - B.cd, 50, 10);
    graphics.drawImage(B.ch, n8, 50, 10);
    if (B.cg - 32 - (B.cd >> 1) < B.r >> 1) B.cg = n9;
    graphics.drawImage(B.a8[65], B.cg - 24, 110, 10);
    graphics.drawImage(B.cm, B.cg - 32, 110, 10);
    graphics.drawImage(B.a8[66], B.cg - 32 - B.cd, 110, 10);
    graphics.drawImage(B.ci, n9, 110, 10);
    if (++B.cc > 350) B.a = 7;
    if (B.cc > 0 && ((B.b7 >> 6) < (B.r >> 1) + (B.r >> 2) || B.cc > 300)) B.b7 += 50;
    if (B.cc > 70) B.b8 += 120;
    if (B.cc > 100) {
      if ((B.b9 >> 6) < (B.r >> 1) + (B.r >> 2) || B.cc > 300) B.b9 += 50;
      if (n7 > (B.r >> 1) + (B.r >> 2)) B.ca += 60;
    }
    if (B.cc > 170) B.cb += 120;
  },

  // a(e, e): prepare the score board (winner e2, loser e3)
  startScoreBoard(e2, e3) {
    B.a = 6;
    B.a1 = 0;
    B.cg = 0;
    B.cf = 0;
    B.cc = 0;
    B.ca = 0;
    B.cb = 0;
    B.b9 = 0;
    B.b8 = 0;
    B.b7 = 1024;
    B.ch = e2.i === 3 ? B.a7[16] : B.a8[67];
    B.ci = e3.i === 3 ? B.a7[16] : B.a8[67];
    B.cj = B.a8[e2.ae + 8];
    B.ck = B.a8[e3.ae + 8];
    const cn = B.cn, co = B.co;
    cn.setColor(0xFBFBFB);
    cn.fillRect(0, 0, B.cd, 15);
    cn.setColor(0x474747);
    cn.drawLine(0, 0, B.cd, 0);
    cn.drawLine(0, 14, B.cd, 14);
    co.setColor(0xFBFBFB);
    co.fillRect(0, 0, B.cd, 15);
    co.setColor(0x474747);
    co.drawLine(0, 0, B.cd, 0);
    co.drawLine(0, 14, B.cd, 14);
    B.bm.drawString(cn, B.bk[11] + B.by.an, B.cd >> 1, 7, 3);
    B.bm.drawString(co, B.bk[11] + B.bz.an, B.cd >> 1, 7, 3);
    let n2 = 3;
    while (--n2 >= 0) {
      B.b5[n2] = B.rnd(B.r);
      const n3 = idiv(B.s, 3);
      B.b6[n2] = n3 * n2 + B.rnd(n3);
    }
    if (B.as === 1) {
      B.bq.quit();
      B.bp = '';
      B.o = 0;
      B.d = false;
    }
    B.playSound(4, 0);
  },

  // f(Graphics): engine tuning overlay (B.f is never set in the game)
  drawTuning(graphics) {
    const n2 = 5, n3 = 130, n4 = 40, n5 = 20, n6 = 10, n7 = 20;
    graphics.setColor(0x333399);
    graphics.fillRect(n2 - n6, n4 - n6 - n7, B.r - (n2 << 1) + (n6 << 1), n5 * 3 + (n6 << 1) + n7);
    graphics.setColor(0xFFFFFF);
    graphics.drawString(J.d ? 'MASTER' : 'SLAVE', n2, n4 - n7, 20);
    for (let n8 = 0; n8 < 3; n8++) {
      if (n8 === B.cq) graphics.fillRect(n2 - 10, n4 + n8 * n5, 8, 10);
      graphics.drawString(B.cp[n8], n2, n4 + n8 * n5, 20);
      const string2 = String([B.x, B.y, B.z][n8]);
      graphics.drawString(string2, n3, n4 + n8 * n5, 20);
    }
  },

  // c(e): draw the score of plane e2 on the airship
  updateScoreBox(e2) {
    if (B.a === 4) return;
    let n2 = B.ct;
    if (e2.i === 2) n2 = B.cv;
    B.bh.setColor(0xE6E3E3);
    B.bh.fillRect(n2, B.cu, B.cr, B.cs);
    B.bh.setColor(0xFFFFFF);
    B.bh.fillRect(n2, B.cu + B.cs, B.cr, B.cs);
    let c2 = B.bn;
    if (e2 === B.bw) c2 = B.bo;
    let string = String(e2.m);
    if (string.length === 1) string = '0' + string;
    c2.drawString(B.bh, string, n2 + 2, B.cu, 20);
    B.a0 = 30;
  },

  // a(Graphics, String, boolean): soft key label (bl = left)
  drawSoftKey(graphics, string, bl) {
    const n2 = B.bm.width(string) + 4;
    const n3 = B.bm.a + 4;
    let n4 = 0;
    if (!bl) n4 = B.r - n2;
    graphics.setColor(6488245);
    graphics.fillRect(n4, B.s - n3, n2, n3);
    graphics.setColor(0xFFFF00);
    graphics.fillRect(n4 + 1, B.s - n3 + 1, n2 - 2, n3 - 2);
    B.bm.drawString(graphics, string, n4 + 2, B.s - n3 + 2, 20);
  },

  paint(graphics) {
    try {
      if (B.cy >= 0) {
        B.drawMessage(graphics);
        let string = B.bk[6];
        if (B.c7) string = B.bk[7];
        B.drawSoftKey(graphics, string, false);
        return;
      }
      switch (B.a) {
        case 14: {
          if (B.q === -1) {
            graphics.setColor(39663);
            graphics.fillRect(0, 0, B.r, B.s);
            B.bm.drawString(graphics, B.bk[45], B.r >> 1, B.s >> 1, 3);
            break;
          }
          B.ba = MImage.fromResource('/ad' + B.q + '.png');
          // Web: the 128 x 128 picture in the middle, over a blurred copy
          graphics.drawBackdrop(B.ba);
          graphics.drawImage(B.ba, (B.r - 128) >> 1, (B.s - 128) >> 1, 20);
          break;
        }
        case 13: {
          const n2 = B.bm.a + 2;
          const n3 = (B.s - (n2 << 2)) >> 1;
          graphics.setColor(39663);
          graphics.fillRect(0, 0, B.r, B.s);
          B.bm.drawString(graphics, B.bk[32], B.r >> 1, n3, 17);
          B.bm.drawString(graphics, B.bk[33], B.r >> 1, n3 + n2, 17);
          B.bm.drawString(graphics, B.bk[34], B.r >> 1, n3 + (n2 << 1), 17);
          B.bm.drawString(graphics, B.bk[35], B.r >> 1, n3 + n2 * 3, 17);
          graphics.drawImage(B.a7[1], B.r - 4, B.s + 2, 40);
          break;
        }
        case 12:
          B.drawHelp(graphics);
          break;
        case 11:
          B.drawRecords(graphics);
          break;
        case 8:
        case 9:
        case 10:
          B.drawResult(graphics);
          break;
        case 5:
          B.drawScoreBoard(graphics);
          break;
        case 0:
          // Web: the 128 x 128 title picture in the middle, over a blurred copy
          graphics.drawBackdrop(B.a8[0]);
          graphics.drawImage(B.a8[0], (B.r - 128) >> 1, (B.s - 128) >> 1, 20);
          break;
        case 3:
          break;
        case 2:
          if (!B.h) {
            B.e = false;
            B.drawWorld(graphics);
            B.h = true;
          }
          G.draw(graphics, B.r, B.s, B.r, 1, 2, 4, G.a === 14 || G.a === 60 || G.a === 92 || G.a === 82 ? 16 : B.bm.a + 4, B.bm);
          if (G.a !== 66 && G.a !== 50) B.drawSoftKey(graphics, B.bk[1], false);
          B.drawSoftKey(graphics, B.bk[39], true);
          break;
        case 4: {
          graphics.setColor(0);
          graphics.fillRect(0, 0, B.r, B.s);
          const n4 = B.bw.d - B.ai;
          const n5 = B.bw.e - B.aj;
          graphics.setClip(n4 - B.a1, n5 - B.a1, B.a1 << 1, B.a1 << 1);
          if ((B.a1 -= 8) <= 0) B.startScoreBoard(B.by, B.bz);
          B.drawWorld(graphics);
          break;
        }
        case 6:
        case 7: {
          graphics.setColor(0);
          graphics.fillRect(0, 0, B.r, B.s);
          const n6 = B.r >> 1;
          const n7 = B.s >> 1;
          graphics.setClip(n6 - B.a1, n7 - B.a1, B.a1 << 1, B.a1 << 1);
          B.drawScoreBoard(graphics);
          if (B.a === 6) {
            if ((B.a1 += 8) <= B.r << 1) break;
            B.a = 5;
            break;
          }
          if ((B.a1 -= 8) >= 0) break;
          B.nextResult();
          B.repaint();
          break;
        }
        case 1: {
          B.drawWorld(graphics);
          if (B.f) B.drawTuning(graphics);
          if (B.a0 <= 0) break;
          --B.a0;
          const string = B.bw.m + ' - ' + B.bx.m;
          B.bm.drawString(graphics, string, B.r >> 1, B.s >> 1, 3);
        }
      }
      if (!B.d && B.a === 1) B.bm.drawString(graphics, B.bp, B.r >> 1, 0, 17);
    } catch (exception) {
      console.error(exception);
    }
  },

  // a(String, int): open a message box
  showMessage(string, n2) {
    B.cy = n2;
    if (B.c2 === string) {
      B.cz = n2 >= 0 ? 0 : 2;
      B.c8 = 0;
      return;
    }
    B.c2 = string;
    const n3 = B.bm.width(string);
    if (n3 > 94) {
      B.wrapMessage(string, 94, 58);
      B.c0 = 100;
    } else {
      B.c0 = n3 + 4 + 2;
      B.wrapMessage(string, n3, 58);
    }
    B.c1 = B.c4 + 4 + 2;
    B.cz = 2;
  },

  // g(Graphics): draw the message box (it grows in over 3 frames)
  drawMessage(graphics) {
    if (B.cz > -1) {
      const bl = B.messageArrows() !== 0;
      let n2 = B.c0;
      let n3 = B.c1;
      n2 >>= B.cz;
      n3 >>= B.cz;
      let n4 = (B.r - n2) >> 1;
      let n5;
      if (B.al - B.aj < B.c1) n5 = (B.s >> 1) - n3 + B.bm.a + 8;
      else n5 = B.s - n3 - B.bm.a - 8;
      graphics.setColor(0x6699CC);
      let n6 = n2;
      if (bl) n6 += 9;
      graphics.fillRect(n4, n5, n6, n3 + 1);
      graphics.setColor(6488245);
      ++n4;
      const n7 = n4 + n2 - 2;
      const n8 = n3 - 2;
      ++n5;
      graphics.drawRect(n4, n5, n7 - n4, n8);
      if (bl) graphics.drawRect(n7, n5, 8, n8);
      if (B.cz === 0) {
        n4 += 2;
        n5 += 2;
        B.drawMessageLines(graphics, n4, n5);
        graphics.setColor(0xFFFFFF);
        const n9 = n4 + n2 - 2;
        if ((B.messageArrows() & 1) !== 0) graphics.drawImage(B.a8[58], n9, n5, 20);
        if ((B.messageArrows() & 2) !== 0) graphics.drawImage(B.a8[59], n9, n5 + n3 - 1 - 2 - 5, 20);
      }
      --B.cz;
    }
  },

  // showNotify(): the canvas is shown again; a running game pauses
  showNotify() {
    I.clear();
    if (B.a === 1) {
      G.open(30);
      B.a = 2;
      B.h = false;
      G.h = 2;
    }
    G.h = 2;
  },

  // a(String, int, int): split the message into lines (dd) and pages (c9)
  wrapMessage(string, n2, n3) {
    let n4 = 0;
    let n5;
    B.c8 = 0;
    B.c3 = n2;
    B.c4 = n3;
    B.db = 0;
    const cArray = string;
    let n7 = 0, n8 = 0, n9 = 0, n10 = 0, n11 = 0;
    let bl = false;
    let bl2 = false;
    while (!bl) {
      block19: {
        block18: {
          n5 = cArray.charCodeAt(n7);
          if (n5 === 32) {
            n10 += B.bm.b;
            n8 = n7;
            n11 = 0;
          } else if (n5 === 10) {
            bl2 = true;
            n8 = n7;
            n11 = 0;
          } else {
            n4 = B.bm.charWidth(n5);
            n11 += n4;
            if ((n10 += n4) > n2) bl2 = true;
          }
          if (n7 !== cArray.length - 1) break block18;
          n8 = n7 + 1;
          bl2 = true;
          bl = true;
          if (n9 > n7) break block19;
        }
        if (bl2) {
          n4 = n8 <= n9 ? 1 : 0;
          if (n4 !== 0) n8 = n7;
          B.dd[B.db] = cArray.substring(n9, n8);
          if (n4 !== 0) {
            n9 = n8;
            n10 = 0;
          } else {
            n9 = n8 + 1;
            n10 = n11;
          }
          bl2 = false;
          ++B.db;
        }
      }
      ++n7;
    }
    B.c9 = new Int32Array(12);
    n5 = 0;
    n4 = 0;
    B.c5 = 0;
    let n14 = 0;
    for (let n13 = 0; n13 < B.db; n13++) {
      const n15 = B.bm.a + 1;
      if (n15 + n14 > B.c4) n4 = 1;
      n14 += n15;
      if ((n4 !== 0 || n13 === B.db - 1) && n14 > B.c5) B.c5 = n14;
      if (n4 !== 0) {
        B.c9[n5++] = n13;
        n14 = n15;
        n4 = 0;
      }
    }
    B.da = n5;
    B.c9[n5++] = B.db;
    if (B.da > 0) B.c5 -= B.bm.a + 1;
    B.c4 = B.c5;
    B.c7 = B.da === 0;
  },

  // a(Graphics, int, int): draw the lines of the current page
  drawMessageLines(graphics, n2, n3) {
    B.c6 = true;
    let n4 = 0;
    for (let i2 = 0; i2 !== B.c9[n4] || ++n4 <= B.c8; ++i2) {
      const string = B.dd[i2];
      if (n4 !== B.c8) continue;
      B.bm.drawString(graphics, string, n2, n3, 20);
      n3 += B.bm.a + 1;
    }
  },

  // b(int): message page up (1) or down (2)
  scrollMessage(n2) {
    if (n2 === 2) {
      if (B.c8 < B.da) ++B.c8;
      if (B.c8 === B.da) B.c7 = true;
    } else if (n2 === 1 && B.c8 > 0) {
      --B.c8;
    }
    B.c6 = false;
  },

  // h(): 1 = page above, 2 = page below
  messageArrows() {
    let n2 = 0;
    if (B.c8 > 0) n2 |= 1;
    if (B.c8 < B.da) n2 |= 2;
    return n2;
  },

  // c(int): random number 0 .. n2-1
  rnd(n2) {
    return Math.abs(B.w.nextInt() % n2);
  },

  // ------------------------------------------------------------ resource reading
  // i(): the shared PNG parts (signature, IHDR, IDAT name, PLTE/tRNS, IEND)
  readPngParts() {
    const a5 = B.a5;
    a5.readFully(B.de);
    a5.readFully(B.dh);
    a5.readFully(B.di);
    B.df = new Uint8Array((a5.readShort() & 0xFFFF) + 13);
    a5.readFully(B.df);
    a5.readFully(B.dg);
  },

  // j(): build one full PNG file from its stored parts
  readPng() {
    const a5 = B.a5;
    const n2 = a5.readShort() & 0xFFFF;
    const byArray = new Uint8Array(n2);
    a5.readFully(byArray);
    const n3 = B.df.length;
    const byArray2 = new Uint8Array(33 + B.df.length + n2 + 12 + 12);
    let n4 = 0;
    byArray2.set(B.de.subarray(0, 8), n4);
    n4 = 8;
    byArray2.set(B.dh.subarray(0, 15), n4 += 3);
    n4 = 8;
    n4 += 10;
    byArray2[n4++] = a5.readByte();
    byArray2[n4++] = a5.readByte();
    n4 += 2;
    byArray2[n4++] = a5.readByte();
    byArray2[n4++] = a5.readByte();
    B.crc(byArray2, 12, 17);
    n4 = 33;
    byArray2.set(B.df, n4);
    n4 += n3;
    n4 += 2;
    byArray2[n4++] = n2 >> 8;
    byArray2[n4++] = n2;
    byArray2.set(B.di.subarray(0, 4), n4);
    byArray2.set(byArray, n4 += 4);
    B.crc(byArray2, n4 - 4, n2 + 4);
    byArray2.set(B.dg.subarray(0, 12), n4 += n2 + 4);
    return byArray2;
  },

  // d(int)
  async readImages(n2) {
    const imageArray = [];
    for (let n3 = 0; n3 < n2; n3++) imageArray[n3] = await B.readImage();
    return imageArray;
  },

  // k()
  async readImage() {
    const byArray = B.readPng();
    return MImage.fromBytes(byArray, 0, byArray.length);
  },

  // e(int)
  async readRawImages(n2) {
    const imageArray = [];
    for (let n3 = 0; n3 < n2; n3++) imageArray[n3] = await B.readRawImage();
    return imageArray;
  },

  // a(byte[], int, int): write the CRC-32 of n3 bytes after them
  crc(byArray, n2, n3) {
    if (!B.dk) {
      let n4 = 256;
      while (--n4 >= 0) {
        let l3 = n4;
        for (let n5 = 0; n5 < 8; n5++) l3 = (l3 & 1) !== 0 ? (0xEDB88320 ^ (l3 >>> 1)) : (l3 >>> 1);
        B.dj[n4] = l3;
      }
      B.dk = true;
    }
    let l2 = 0xFFFFFFFF;
    for (let n6 = 0; n6 < n3; n6++) {
      l2 = (B.dj[(l2 ^ byArray[n2 + n6]) & 0xFF] ^ (l2 >>> 8)) >>> 0;
    }
    l2 = (l2 ^ 0xFFFFFFFF) >>> 0;
    n2 += n3;
    byArray[n2] = l2 >>> 24;
    byArray[n2 + 1] = l2 >>> 16;
    byArray[n2 + 2] = l2 >>> 8;
    byArray[n2 + 3] = l2;
  },

  // b(String): string table file
  readStrings(name) {
    const dis = Res.get(name);
    const n2 = dis.readInt();
    const stringArray = [];
    for (let n3 = 0; n3 < n2; n3++) stringArray[n3] = dis.readUTF();
    return stringArray;
  },

  // l(): an image stored as a full PNG file
  async readRawImage() {
    try {
      const n2 = B.a5.readInt();
      const byArray = new Uint8Array(n2);
      B.a5.readFully(byArray);
      return await MImage.fromBytes(byArray, 0, n2);
    } catch (exception) {
      console.error(exception);
      return null;
    }
  },

  // m(): a block of bytes with its length first
  readBlock() {
    try {
      const n2 = B.a5.readInt();
      const byArray = new Uint8Array(n2);
      B.a5.readFully(byArray);
      return byArray;
    } catch (exception) {
      console.error(exception);
      return null;
    }
  },

  // ------------------------------------------------------------ fixed point maths
  // f(int): cosine * 128
  cos(n2) {
    n2 = B.normAngle(n2 + 90);
    return B.sin(n2);
  },

  // g(int)
  normAngle(n2) {
    if (n2 < 0) return 360 + n2;
    if (n2 > 359) return n2 - 360;
    return n2;
  },

  // h(int): sine * 128
  sin(n2) {
    const dl = B.dl;
    if (n2 < 0) return 1;
    if (n2 < 90) return dl[n2];
    if (n2 === 90) return 128;
    if (n2 < 180) return dl[180 - n2];
    if (n2 === 180) return 0;
    if (n2 < 270) return -dl[n2 - 180];
    if (n2 === 270) return -128;
    if (n2 < 360) return -dl[360 - n2];
    return 1;
  },

  // b(int, int, int, int): angle from (n4, n5) to (n2, n3)
  angleTo(n2, n3, n4, n5) {
    let bl = true;
    let bl2 = true;
    let n6 = n2 - n4;
    let n7 = n3 - n5;
    if (n7 < 0) bl2 = false;
    if (n6 < 0) bl = false;
    if (n6 === 0) return n7 >= 0 ? 0 : 180;
    if (n7 === 0) return n6 >= 0 ? 270 : 90;
    n6 = Math.abs(n6);
    n7 = Math.abs(n7);
    const n8 = n6 + n7;
    n6 = idiv(n6 * 10, n8);
    n7 = idiv(n7 * 10, n8);
    const dm = B.dm;
    if (!bl && bl2) return dm[n6][n7];
    if (!bl && !bl2) return 90 + dm[n7][n6];
    if (bl && !bl2) return 180 + dm[n6][n7];
    if (bl && bl2) return 270 + dm[n7][n6];
    return -1;
  },

  // b(int, int): which way to turn from angle n2 to angle n3
  turnDir(n2, n3) {
    if (Math.abs(n2 - n3) <= E.a0) return 0;
    if (n3 >= n2) {
      const n4 = n3 - n2;
      const n5 = 360 - n3 + n2;
      if (n4 <= n5) return 3;
      return 2;
    }
    const n6 = n2 - n3;
    const n7 = 360 - n2 + n3;
    if (n6 <= n7) return 2;
    return 3;
  },

  // a(String, String): send a text message (empty in the original)
  sendText(string, string2) {},

  // i(int): select a text field
  selectField(n2) {
    B.du = B.dx[n2].length;
    B.dv = 0;
    B.d6 = true;
    B.d5 = Date.now() + B.d7;
    B.dw = n2;
    B.du = B.dx[B.dw].length;
    B.dv = 0;
  },
};
