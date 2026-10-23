// Port of class h: sound. The game keeps one MIDI file (inside /r) and plays
// time ranges of it. A browser cannot play MIDI, so res/music.wav is that
// same MIDI file rendered to audio. A Player object copies the MMAPI calls
// the game uses: getState, setMediaTime, start, stop.
'use strict';

class Player {
  constructor(buffer) { this.buffer = buffer; this.state = 300; this.mediaTime = 0; this.node = null; }
  getState() { return this.state; }                // 400 = STARTED, 300 = PREFETCHED
  setMediaTime(us) { this.mediaTime = us; }
  start() {
    this.state = 400;
    const ctx = H.ctx;
    if (!ctx || !this.buffer) return;
    const node = ctx.createBufferSource();
    node.buffer = this.buffer;
    node.connect(ctx.destination);
    node.start(0, this.mediaTime / 1e6);
    this.node = node;
  }
  stop() {
    this.state = 300;
    if (this.node) { try { this.node.stop(); } catch (e) {} this.node = null; }
  }
}

const H = {
  a: null,   // byte[]: player type of each sound
  b: null,   // int[]: start / end media time (microseconds) of each sound
  c: 0,      // sound count
  d: 0,      // last sound started
  e: null,   // MIDI player
  g: null,   // WAV player (not in this game's data)
  i: null,   // Nokia Sound objects (not in this game's data)
  ctx: null,
  buffer: null,

  // a(DataInputStream): read the sound block at the end of /r
  load(dis) {
    let n2 = dis.readByte();
    let n3 = n2;
    while (--n3 >= 0) {
      const by = dis.readByte();
      switch (by) {
        case 0:
        case 1: {
          const n4 = dis.readInt();
          const byArray = new Uint8Array(n4);
          dis.readFully(byArray);
          if (by === 0) H.e = new Player(null);
          else H.g = new Player(null);
          break;
        }
        case 2: {
          const n5 = dis.readByte();
          H.i = [];
          for (let n6 = 0; n6 < n5; n6++) {
            const n4 = dis.readInt();
            dis.readFully(new Uint8Array(n4));
            H.i[n6] = null;
          }
          continue;
        }
      }
    }
    H.c = dis.readShort();
    H.a = new Int8Array(H.c);
    dis.readFully(H.a);
    H.b = new Int32Array(H.c << 1);
    for (let n7 = 0; n7 < H.c; n7++) {
      H.b[n7 << 1] = dis.readInt();
      H.b[(n7 << 1) + 1] = dis.readInt();
    }
  },

  // Web Audio needs a user gesture before it can start.
  async unlock(wavBytes) {
    if (H.ctx) return;
    H.ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      H.buffer = await H.ctx.decodeAudioData(wavBytes.buffer.slice(0));
      if (H.e) H.e.buffer = H.buffer;
    } catch (e) { console.warn('audio decode failed', e); }
  },

  // a(int, int): play sound n2. A new sound is dropped while one plays.
  play(n2, n3) {
    const by = H.a[n2];
    if (by === -1) return;
    if (by === 2) return; // Nokia Sound: not used by this game's data
    let player = H.e;
    if (by === 1) player = H.g;
    if (!player) return;
    if (player.getState() === 400) {
      if (H.d === 1 && n2 !== 1) player.stop();
      else return;
    }
    H.d = n2;
    player.setMediaTime(H.b[n2 << 1]);
    const n4 = H.b[n2 << 1];
    const n5 = H.b[(n2 << 1) + 1];
    setTimeout(() => player.stop(), idiv(n5 - n4, 1000));
    player.start();
  },
};
