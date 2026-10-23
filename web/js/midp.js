// Small MIDP / CLDC runtime for the port: Graphics, Image, data streams,
// java.util.Random, RecordStore. Each part copies the Java behaviour that the
// game code depends on.
'use strict';

// Graphics anchor constants (javax.microedition.lcdui.Graphics)
const HCENTER = 1, VCENTER = 2, LEFT = 4, RIGHT = 8, TOP = 16, BOTTOM = 32, BASELINE = 64;

// Java int helpers
const idiv = (a, b) => (a / b) | 0;              // Java int division
const toByte = (x) => (x << 24) >> 24;           // (byte) cast
const toInt = (x) => x | 0;

// ---------------------------------------------------------------- Image
class MImage {
  constructor(src, w, h, mutable) {
    this.src = src;       // canvas or ImageBitmap
    this.w = w;
    this.h = h;
    this.mutable = mutable;
    this._g = null;
  }
  getWidth() { return this.w; }
  getHeight() { return this.h; }
  getGraphics() {
    if (!this.mutable) throw new Error('IllegalStateException');
    return new Graphics(this.src);
  }

  // Image.createImage(int w, int h): a mutable image, all pixels white.
  static createMutable(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    return new MImage(cv, w, h, true);
  }

  // Image.createImage(byte[], off, len): decode a PNG. Decoding in the
  // browser is async, so the loader awaits this call.
  static async fromBytes(bytes, off = 0, len = bytes.length) {
    const data = bytes.slice(off, off + len);
    const bmp = await createImageBitmap(new Blob([data], { type: 'image/png' }));
    return new MImage(bmp, bmp.width, bmp.height, false);
  }

  // Image.createImage(String): resources are loaded before start.
  static fromResource(name) {
    const img = MImage.resources[name];
    if (!img) throw new Error('IOException ' + name);
    return img;
  }
}
MImage.resources = {};

// ---------------------------------------------------------------- Graphics
class Graphics {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.reset();
  }

  // A new Graphics for paint(): no translation, full clip, black colour.
  reset() {
    this.tx = 0; this.ty = 0;
    this.cx = 0; this.cy = 0;
    this.cw = this.canvas.width; this.ch = this.canvas.height;
    this.rgb = 0;
    this.ctx.fillStyle = '#000000';
  }

  translate(x, y) { this.tx += x; this.ty += y; }
  getTranslateX() { return this.tx; }
  getTranslateY() { return this.ty; }

  setColor(r, g, b) {
    if (g === undefined) this.rgb = r & 0xffffff;
    else this.rgb = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
    this.ctx.fillStyle = '#' + this.rgb.toString(16).padStart(6, '0');
  }
  getColor() { return this.rgb; }

  // The clip is kept in device coordinates.
  setClip(x, y, w, h) {
    this.cx = x + this.tx; this.cy = y + this.ty; this.cw = w; this.ch = h;
  }
  clipRect(x, y, w, h) {
    const x1 = Math.max(this.cx, x + this.tx);
    const y1 = Math.max(this.cy, y + this.ty);
    const x2 = Math.min(this.cx + this.cw, x + this.tx + w);
    const y2 = Math.min(this.cy + this.ch, y + this.ty + h);
    this.cx = x1; this.cy = y1;
    this.cw = Math.max(0, x2 - x1); this.ch = Math.max(0, y2 - y1);
  }
  getClipX() { return this.cx - this.tx; }
  getClipY() { return this.cy - this.ty; }
  getClipWidth() { return this.cw; }
  getClipHeight() { return this.ch; }

  _fill(x, y, w, h) {
    // Device-space rectangle cut to the clip.
    const x1 = Math.max(x, this.cx), y1 = Math.max(y, this.cy);
    const x2 = Math.min(x + w, this.cx + this.cw), y2 = Math.min(y + h, this.cy + this.ch);
    if (x2 > x1 && y2 > y1) this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }

  fillRect(x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    this._fill(x + this.tx, y + this.ty, w, h);
  }

  // drawRect covers (w + 1) x (h + 1) pixels.
  drawRect(x, y, w, h) {
    if (w < 0 || h < 0) return;
    x += this.tx; y += this.ty;
    this._fill(x, y, w + 1, 1);
    this._fill(x, y + h, w + 1, 1);
    this._fill(x, y, 1, h + 1);
    this._fill(x + w, y, 1, h + 1);
  }

  // drawLine includes both end points.
  drawLine(x1, y1, x2, y2) {
    x1 += this.tx; y1 += this.ty; x2 += this.tx; y2 += this.ty;
    if (y1 === y2) { this._fill(Math.min(x1, x2), y1, Math.abs(x2 - x1) + 1, 1); return; }
    if (x1 === x2) { this._fill(x1, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1); return; }
    let dx = Math.abs(x2 - x1), sx = x1 < x2 ? 1 : -1;
    let dy = -Math.abs(y2 - y1), sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this._fill(x1, y1, 1, 1);
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x1 += sx; }
      if (e2 <= dx) { err += dx; y1 += sy; }
    }
  }

  drawImage(img, x, y, anchor) {
    if (!img) throw new Error('NullPointerException');
    if (anchor === 0) anchor = TOP | LEFT;
    if (anchor & HCENTER) x -= img.w >> 1;
    else if (anchor & RIGHT) x -= img.w;
    if (anchor & VCENTER) y -= img.h >> 1;
    else if (anchor & BOTTOM) y -= img.h;
    x += this.tx; y += this.ty;
    if (this.cw <= 0 || this.ch <= 0) return;
    if (x >= this.cx + this.cw || y >= this.cy + this.ch || x + img.w <= this.cx || y + img.h <= this.cy) return;
    const ctx = this.ctx;
    const full = x >= this.cx && y >= this.cy && x + img.w <= this.cx + this.cw && y + img.h <= this.cy + this.ch;
    if (full) {
      ctx.drawImage(img.src, x, y);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.cx, this.cy, this.cw, this.ch);
      ctx.clip();
      ctx.drawImage(img.src, x, y);
      ctx.restore();
    }
  }

  // System font text. Only the unused engine tuning overlay draws with it.
  drawString(str, x, y, anchor) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.cx, this.cy, this.cw, this.ch);
    ctx.clip();
    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'top';
    let w = ctx.measureText(str).width;
    if (anchor & HCENTER) x -= w / 2; else if (anchor & RIGHT) x -= w;
    ctx.fillText(str, x + this.tx, y + this.ty);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- streams
class DataInputStream {
  constructor(bytes) { this.buf = bytes; this.pos = 0; }
  _need(n) { if (this.pos + n > this.buf.length) throw new Error('EOFException'); }
  readByte() { this._need(1); return toByte(this.buf[this.pos++]); }
  readUnsignedByte() { this._need(1); return this.buf[this.pos++]; }
  readBoolean() { return this.readByte() !== 0; }
  readShort() { this._need(2); const v = (this.buf[this.pos] << 8) | this.buf[this.pos + 1]; this.pos += 2; return (v << 16) >> 16; }
  readUnsignedShort() { return this.readShort() & 0xffff; }
  readInt() {
    this._need(4);
    const b = this.buf, p = this.pos;
    this.pos += 4;
    return (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
  }
  // readFully into a byte[] (Int8Array keeps Java signed bytes).
  readFully(arr) {
    this._need(arr.length);
    for (let i = 0; i < arr.length; i++) arr[i] = this.buf[this.pos++];
  }
  // Modified UTF-8, as written by DataOutputStream.writeUTF.
  readUTF() {
    const len = this.readUnsignedShort();
    this._need(len);
    const end = this.pos + len;
    let s = '';
    while (this.pos < end) {
      const a = this.buf[this.pos++];
      if (a < 0x80) s += String.fromCharCode(a);
      else if ((a & 0xe0) === 0xc0) { const b = this.buf[this.pos++]; s += String.fromCharCode(((a & 0x1f) << 6) | (b & 0x3f)); }
      else { const b = this.buf[this.pos++], c = this.buf[this.pos++]; s += String.fromCharCode(((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f)); }
    }
    return s;
  }
  close() {}
}

class DataOutputStream {
  constructor() { this.bytes = []; }
  writeByte(v) { this.bytes.push(v & 255); }
  writeBoolean(v) { this.bytes.push(v ? 1 : 0); }
  writeInt(v) { this.bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  write(arr) { for (let i = 0; i < arr.length; i++) this.bytes.push(arr[i] & 255); }
  toByteArray() { return Uint8Array.from(this.bytes); }
  close() {}
}

// ---------------------------------------------------------------- java.util.Random
class JRandom {
  constructor(seed) {
    if (seed === undefined) seed = Date.now() + Math.floor(Math.random() * 1e9);
    this.seed = (BigInt(seed) ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n);
  }
  next(bits) {
    this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextInt() { return this.next(32); }
}

// ---------------------------------------------------------------- RecordStore
// One record store in localStorage. Records are 1-based, like RMS.
class RecordStore {
  constructor(name) { this.key = 'btbiplanes.rms.' + name; this.recs = JSON.parse(localStorage.getItem(this.key) || '[]'); }
  static openRecordStore(name) { return new RecordStore(name); }
  getSizeAvailable() { return 64 * 1024; }
  getNumRecords() { return this.recs.length; }
  getRecord(id) { return Uint8Array.from(this.recs[id - 1]); }
  addRecord(data, off, len) { this.recs.push(Array.from(data.slice(off, off + len))); this._save(); return this.recs.length; }
  setRecord(id, data, off, len) {
    if (id < 1 || id > this.recs.length) throw new Error('InvalidRecordIDException');
    this.recs[id - 1] = Array.from(data.slice(off, off + len)); this._save();
  }
  _save() { localStorage.setItem(this.key, JSON.stringify(this.recs)); }
  closeRecordStore() {}
}

// Resource files from the JAR (fetched before start).
const Res = {
  files: {},
  get(name) {
    const f = Res.files[name.replace(/^\//, '')];
    if (!f) throw new Error('missing resource ' + name);
    return new DataInputStream(f);
  },
};
