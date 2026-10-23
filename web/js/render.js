// Display layer for the web version. It changes only how the game looks,
// never what the game does: it does not read or change game state that the
// logic uses, and it does not use the game's random numbers.
//
// What it adds:
// - The logical screen (B.r x B.s) follows the window shape: up to 255 px
//   wide (the whole arena) in landscape, up to 208 px tall in portrait.
// - Drawing at full device resolution, in whole steps so pixel art stays sharp.
// - 60 fps motion: during play, each game tick (20 per second) is kept as a
//   list of draw commands. The screen draws that list again on every display
//   frame and moves the camera and tagged sprites smoothly between ticks.
// - Parallax: the original sky and ground strips are split by colour into far
//   clouds, trees and ground, which scroll at different speeds over a sky
//   gradient.
// - A blurred copy of the picture behind the side bars.
'use strict';

const SKY_RGB = 0x00CCFF;   // the game's sky fill colour (52479)

// Logical screen size for a window of vw x vh CSS px
function chooseScreenSize(vw, vh) {
  const fixed = new URLSearchParams(location.search);
  if (fixed.has('w') && fixed.has('h')) return [parseInt(fixed.get('w'), 10), parseInt(fixed.get('h'), 10)];
  const a = vw / vh;
  if (a >= 1) return [Math.max(128, Math.min(255, Math.round(128 * a))), 128];
  return [128, Math.max(128, Math.min(208, Math.round(128 / a)))];
}

// The Graphics of the visible screen. It draws in logical pixels on a large
// canvas. During play it only records commands (see R.paint).
class ScreenGraphics extends Graphics {
  constructor(canvas) {
    super(canvas);
    this.rec = null;     // command list while recording
    this.layer = null;   // 'world' while the game draws the arena
    this.space = null;   // 'world' while the camera translation is on
    this.tag = null;     // name of the sprite being drawn (for smooth motion)
    this.bands = new Set();
  }
  reset() {
    this.tx = 0; this.ty = 0;
    this.cx = 0; this.cy = 0;
    this.cw = R.W; this.ch = R.H;
    this.rgb = 0;
    this.layer = null; this.space = null; this.tag = null;
    if (this.bands) this.bands.clear();
  }
  setColor(r, g, b) {
    if (g === undefined) this.rgb = r & 0xffffff;
    else this.rgb = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
  }
  _cmd(op, lx, ly) {
    return {
      op, lx, ly, tx: this.tx, ty: this.ty,
      clip: [this.cx, this.cy, this.cw, this.ch],
      space: this.space, layer: this.layer, tag: this.tag,
      camX: B.ai, camY: B.aj,
    };
  }
  _emit(cmd) {
    if (this.rec) { this.rec.push(cmd); return; }
    R.exec(R.fctx, cmd, null, this.bands);
    R.dirty = true;
  }
  _fill(x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const cmd = this._cmd(this.rgb === SKY_RGB ? 'sky' : 'rect', x - this.tx, y - this.ty);
    cmd.w = w; cmd.h = h; cmd.rgb = this.rgb;
    this._emit(cmd);
  }
  drawImage(img, x, y, anchor) {
    if (!img) throw new Error('NullPointerException');
    if (anchor === 0) anchor = TOP | LEFT;
    if (anchor & HCENTER) x -= img.w >> 1;
    else if (anchor & RIGHT) x -= img.w;
    if (anchor & VCENTER) y -= img.h >> 1;
    else if (anchor & BOTTOM) y -= img.h;
    if (this.cw <= 0 || this.ch <= 0) return;
    let op = 'img';
    if (R.layers && img === R.layers.baImg) op = 'ground';
    else if (R.layers && img === R.layers.bbImg) op = 'skyband';
    const cmd = this._cmd(op, x, y);
    cmd.img = img;
    this._emit(cmd);
  }
  // Web addition: the picture scaled to cover the whole screen, blurred and
  // darker. Used behind the 128 x 128 title and advert pictures.
  drawBackdrop(img) {
    const cmd = this._cmd('backdrop', 0, 0);
    cmd.img = img;
    this._emit(cmd);
  }
  drawString(str, x, y, anchor) {
    const cmd = this._cmd('text', x, y);
    cmd.str = str; cmd.anchor = anchor; cmd.rgb = this.rgb;
    this._emit(cmd);
  }
}

const R = {
  W: 128, H: 128, S: 1,
  view: null, vctx: null,     // visible canvas
  fb: null, fctx: null,       // the persistent picture (menus draw on top of old frames)
  back: null, bctx: null,     // blurred backdrop
  g: null,
  mode: 'fb',                 // 'list' during play, 'fb' otherwise
  fbStale: false,
  prev: null, cur: null,      // last two command lists {cmds, t, camX, camY}
  dirty: true,
  layers: null,
  started: false,

  init(view, back) {
    R.view = view;
    R.vctx = view.getContext('2d');
    R.back = back;
    R.bctx = back.getContext('2d');
    R.fb = document.createElement('canvas');
    R.fctx = R.fb.getContext('2d');
    R.g = new ScreenGraphics(R.fb);
    R.resize(true);
    window.addEventListener('resize', () => {
      clearTimeout(R._rt);
      R._rt = setTimeout(() => R.resize(false), 80);
    });
    requestAnimationFrame(R.frame);
  },

  // Fit the screen to the window. The logical size can change, so the game
  // gets the new size and draws everything again.
  resize(first) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const [W, H] = chooseScreenSize(vw, vh);
    const S = Math.max(1, Math.floor(Math.min(vw * dpr / W, vh * dpr / H)));
    R.W = W; R.H = H; R.S = S;
    for (const cv of [R.view, R.fb]) { cv.width = W * S; cv.height = H * S; }
    R.view.style.width = (W * S / dpr) + 'px';
    R.view.style.height = (H * S / dpr) + 'px';
    for (const ctx of [R.vctx, R.fctx]) { ctx.imageSmoothingEnabled = false; }
    R.back.width = 96; R.back.height = Math.max(1, Math.round(96 * vh / vw));
    R.prev = R.cur = null;
    R.fbStale = false;
    R.dirty = true;
    if (!first && B.a6) {
      // Same as when the phone screen comes back: draw everything again.
      B.r = W; B.s = H; B.ak = 255 - W; B.al = 208 - H;
      B.h = false;
      G.h = 2;
      B.repaint();
    }
  },

  // Split the original background strips into layers (once, after loading).
  buildLayers() {
    const read = (img) => {
      const c = document.createElement('canvas');
      c.width = img.w; c.height = img.h;
      const x = c.getContext('2d');
      x.drawImage(img.src, 0, 0);
      return x.getImageData(0, 0, img.w, img.h);
    };
    const make = (w, h, fn) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      const d = x.createImageData(w, h);
      fn(d.data);
      x.putImageData(d, 0, 0);
      return c;
    };
    const rgbAt = (d, i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const SKY = 0x00CBFF, CLOUD = [0x4BE7F4, 0x00D6E8];
    const GROUND_ROW = 63;

    const ba = read(B.ba), w = ba.width, h = ba.height, src = ba.data;
    const ground = make(w, h, (d) => {
      for (let i = GROUND_ROW * w * 4; i < src.length; i++) d[i] = src[i];
    });
    const trees = make(w, h, (d) => {
      for (let i = 0; i < GROUND_ROW * w * 4; i += 4) {
        const c = rgbAt(src, i);
        if (c !== SKY && !CLOUD.includes(c)) { d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; d[i + 3] = 255; }
      }
    });
    // Far clouds: the trees cover part of them, so fill under the trees with
    // cloud colour from the first cloud pixel down.
    const clouds = make(w, h, (d) => {
      for (let x = 0; x < w; x++) {
        let fill = -1;
        for (let y = 0; y < GROUND_ROW; y++) {
          const i = (y * w + x) * 4;
          const c = rgbAt(src, i);
          if (CLOUD.includes(c)) fill = i;
          if (c !== SKY && (CLOUD.includes(c) || fill >= 0)) {
            const s = CLOUD.includes(c) ? i : fill;
            d[i] = src[s]; d[i + 1] = src[s + 1]; d[i + 2] = src[s + 2]; d[i + 3] = 255;
          }
        }
      }
    });
    // The top sky strip stays as it is (it scrolls slower than the rest).
    const skyTop = B.bb.src;
    R.layers = { ground, trees, clouds, skyTop, baImg: B.ba, bbImg: B.bb };
  },

  // ---------------------------------------------------------------- painting
  // Called for each paint of the game (instead of a direct paint).
  paint() {
    B.pending = false;
    const g = R.g;
    const listMode = B.cy < 0 && (B.a === 1 || B.a === 4);
    if (!listMode && R.fbStale) {
      // Leaving play: put the last play frame into the persistent picture,
      // because menus and messages draw on top of it.
      if (R.cur) R.drawList(R.fctx, R.cur, null, 1);
      R.fbStale = false;
    }
    g.reset();
    R.fctx.setTransform(R.S, 0, 0, R.S, 0, 0);
    if (listMode) {
      g.rec = [];
      B.paint(g);
      const list = { cmds: g.rec, t: performance.now(), camX: B.ai, camY: B.aj };
      g.rec = null;
      R.prev = R.cur;
      R.cur = list;
      R.fbStale = true;
      R.mode = 'list';
    } else {
      B.paint(g);
      R.mode = 'fb';
      R.prev = R.cur = null;
    }
    R.dirty = true;
  },

  frame(now) {
    requestAnimationFrame(R.frame);
    // At most about 60 pictures per second (screens can run at 120 Hz).
    if (R._ft && now - R._ft < 15) return;
    R._ft = now;
    const ctx = R.vctx;
    if (R.mode === 'list' && R.cur) {
      let alpha = 1;
      const prev = R.prev;
      if (prev) {
        const span = R.cur.t - prev.t;
        alpha = span > 0 && span < 150 ? Math.min(1, (now - R.cur.t) / span) : 1;
      }
      R.drawList(ctx, R.cur, prev, alpha);
      R.dirty = true;
    } else if (R.dirty) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(R.fb, 0, 0);
    } else {
      return;
    }
    // Blurred backdrop, a few times per second
    if (!R._bt || now - R._bt > 120) {
      R._bt = now;
      const b = R.bctx;
      b.imageSmoothingEnabled = true;
      const bw = R.back.width, bh = R.back.height;
      const k = Math.max(bw / R.view.width, bh / R.view.height);
      const dw = R.view.width * k, dh = R.view.height * k;
      b.drawImage(R.view, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
    }
    R.dirty = false;
  },

  // Draw a command list. With prev and alpha < 1, the camera and the tagged
  // sprites move between the two ticks.
  drawList(ctx, list, prev, alpha) {
    const lerp = (a, b) => a + (b - a) * alpha;
    let camX = list.camX, camY = list.camY;
    if (prev && Math.abs(list.camX - prev.camX) < 40 && Math.abs(list.camY - prev.camY) < 40) {
      camX = lerp(prev.camX, list.camX);
      camY = lerp(prev.camY, list.camY);
    }
    // Where each tagged sprite was in the previous tick
    let before = null;
    if (prev && alpha < 1) {
      before = new Map();
      const n = new Map();
      for (const c of prev.cmds) {
        if (!c.tag) continue;
        const k = c.tag + '#' + (n.get(c.tag) || 0);
        n.set(c.tag, (n.get(c.tag) || 0) + 1);
        before.set(k, c);
      }
    }
    const env = { camX, camY, alpha };
    const bands = new Set();
    const count = new Map();
    ctx.setTransform(R.S, 0, 0, R.S, 0, 0);
    for (const c of list.cmds) {
      let lx = c.lx, ly = c.ly;
      if (c.tag) {
        const i = count.get(c.tag) || 0;
        count.set(c.tag, i + 1);
        const p = before && before.get(c.tag + '#' + i);
        if (p && Math.abs(p.lx - c.lx) < 24 && Math.abs(p.ly - c.ly) < 24) {
          lx = lerp(p.lx, c.lx);
          ly = lerp(p.ly, c.ly);
        }
      }
      R.exec(ctx, c, env, bands, lx, ly);
    }
  },

  // Run one command. env = null: draw as recorded (no smoothing).
  exec(ctx, c, env, bands, lx = c.lx, ly = c.ly) {
    let tx = c.tx, ty = c.ty;
    let camX = c.camX, camY = c.camY;
    if (env) {
      camX = env.camX; camY = env.camY;
      if (c.space === 'world') { tx = -env.camX; ty = -env.camY; }
    }
    const [cx, cy, cw, ch] = c.clip;
    if (cw <= 0 || ch <= 0) return;
    const clipped = cx > 0 || cy > 0 || cx + cw < R.W || cy + ch < R.H;
    if (clipped) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cw, ch);
      ctx.clip();
    }
    switch (c.op) {
      case 'rect':
        ctx.fillStyle = R.hex(c.rgb);
        ctx.fillRect(lx + tx, ly + ty, c.w, c.h);
        break;
      case 'sky':
        R.fillSky(ctx, lx + tx, ly + ty, c.w, c.h, c.layer === 'world' ? camY : 0);
        break;
      case 'img':
        ctx.drawImage(c.img.src, lx + tx, ly + ty);
        break;
      case 'ground':
      case 'skyband': {
        // The game draws each strip several times side by side; the layered
        // version covers the whole width at once.
        const key = c.op + ':' + ly;
        if (bands.has(key)) break;
        bands.add(key);
        R.drawBand(ctx, c.op, ly + ty, -tx, -ty);
        break;
      }
      case 'backdrop': {
        const img = c.img;
        const k = Math.max(R.W / img.w, R.H / img.h) * 1.15;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.filter = `blur(${Math.round(R.S * 2.5)}px) brightness(0.6) saturate(1.2)`;
        ctx.drawImage(img.src, (R.W - img.w * k) / 2, (R.H - img.h * k) / 2, img.w * k, img.h * k);
        ctx.restore();
        break;
      }
      case 'text':
        ctx.fillStyle = R.hex(c.rgb);
        ctx.font = '10px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(c.str, lx + tx, ly + ty);
        break;
    }
    if (clipped) ctx.restore();
  },

  hex(rgb) { return '#' + rgb.toString(16).padStart(6, '0'); },

  // Sky gradient, fixed to the arena (world y 0 at the top, 208 at the bottom)
  fillSky(ctx, x, y, w, h, camY) {
    const top = -camY;
    const gr = ctx.createLinearGradient(0, top, 0, top + 208);
    // The top strip (world y 0-41) is the original art; the gradient starts
    // at its colours and gets lighter towards the horizon.
    gr.addColorStop(0, '#0099e8');
    gr.addColorStop(0.2, '#00cbff');
    gr.addColorStop(0.6, '#1ad1ff');
    gr.addColorStop(0.84, '#52ddf5');
    gr.addColorStop(1, '#8deaf6');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
  },

  // A background strip as parallax layers, across the whole screen width.
  // y = screen y of the strip top, camX/camY = camera position.
  drawBand(ctx, kind, y, camX, camY) {
    const L = R.layers;
    const tile = (img, f) => {
      let x0 = -((camX * f) % 128);
      if (x0 > 0) x0 -= 128;
      for (let x = x0; x < R.W; x += 128) ctx.drawImage(img, x, y);
    };
    if (kind === 'skyband') {
      tile(L.skyTop, 0.25);
      return;
    }
    R.fillSky(ctx, 0, y, R.W, 84, camY);
    tile(L.clouds, 0.35);
    tile(L.trees, 0.65);
    tile(L.ground, 1);
  },
};
