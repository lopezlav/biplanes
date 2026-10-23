// Port of class j (and its helpers l, m): the Bluetooth link.
// A browser has no Bluetooth, so the link goes over the internet. Both
// players connect to a private match room on the server (/api/match/<room>,
// a Durable Object). Then they try a direct WebRTC data channel, which is
// faster; if it does not open, the packets go through the room. The rest is
// as in the original: both read a stream of ints and bytes, and the player
// who joined (j.d == true) is the master.
'use strict';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const ICE_SERVERS = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
const P2P_WAIT_MS = 4000;     // time to get a direct link before using the relay
const OPEN_WAIT_MS = 20000;   // time to wait for the other player in the room

// The receive side of the stream: bytes in a queue, reads wait for data.
class LinkInputStream {
  constructor() { this.q = []; this.waiter = null; this.closed = false; }
  push(bytes) { for (const b of bytes) this.q.push(b); this._wake(); }
  close() { this.closed = true; this._wake(); }
  _wake() { if (this.waiter) { const w = this.waiter; this.waiter = null; w(); } }
  async need(n) {
    while (this.q.length < n) {
      if (this.closed) throw new Error('IOException: closed');
      await new Promise((res) => { this.waiter = res; });
    }
  }
  async readInt() {
    await this.need(4);
    const q = this.q;
    const v = (q[0] << 24) | (q[1] << 16) | (q[2] << 8) | q[3];
    q.splice(0, 4);
    return v;
  }
  // Used by B.recvPacket after need(18): a normal synchronous readFully.
  readFully(arr) {
    if (this.q.length < arr.length) throw new Error('EOFException');
    for (let i = 0; i < arr.length; i++) arr[i] = this.q.shift();
  }
}

// The send side: bytes collect until flush().
class LinkOutputStream {
  constructor(link) { this.link = link; this.buf = []; }
  writeInt(v) { this.buf.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  write(arr) { for (let i = 0; i < arr.length; i++) this.buf.push(arr[i] & 255); }
  flush() {
    this.link.sendBytes(Uint8Array.from(this.buf));
    this.buf = [];
  }
  close() {}
}

class J {
  constructor(room, role) {
    this.b = null;   // DataInputStream
    this.c = null;   // DataOutputStream
    this.e = 0;      // thread state: 1 connect, 2 read, 4 end
    this.g = null;   // StreamConnection (here: true when open)
    this.room = room;
    this.role = role;            // 'host' (asked for the fight) or 'join'
    this.ws = null;              // socket to the match room
    this.pc = null;              // WebRTC connection
    this.dc = null;              // WebRTC data channel
    this.via = 'relay';          // where the game packets go: 'relay' or 'p2p'
    this.ending = false;         // true after a normal close
    this.waits = new Map();      // control message type -> resolve
    this.inbox = [];             // early control messages
  }

  // ------------------------------------------------------------ transport
  sendBytes(bytes) {
    if (!this.g) throw new Error('IOException: not connected');
    if (this.via === 'p2p' && this.dc && this.dc.readyState === 'open') this.dc.send(bytes);
    else if (this.ws && this.ws.readyState === 1) this.ws.send(bytes);
    else throw new Error('IOException: closed');
  }

  ctl(msg, overDc = false) {
    const s = JSON.stringify(msg);
    if (overDc && this.dc && this.dc.readyState === 'open') this.dc.send(s);
    else if (this.ws && this.ws.readyState === 1) this.ws.send(s);
  }

  // Wait for a control message of type t (or null after ms).
  waitFor(t, ms) {
    const i = this.inbox.findIndex((m) => m.t === t);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((res) => {
      const timer = setTimeout(() => { this.waits.delete(t); res(null); }, ms);
      this.waits.set(t, (m) => { clearTimeout(timer); res(m); });
    });
  }

  onData(data, fromDc) {
    if (typeof data !== 'string') {
      if (this.b) this.b.push(new Uint8Array(data));
      return;
    }
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    switch (m.t) {
      // The offer can come before the host is ready: make the connection now.
      case 'sdp': this.startP2P(); this.onSdp(m.sdp); return;
      case 'ice': this.startP2P(); if (this.pc && m.c) this.pc.addIceCandidate(m.c).catch(() => {}); return;
      case 'ping': this.ctl({ t: 'pong', n: m.n }, fromDc); return;
      case 'bye': this.lost(); return;
    }
    const w = this.waits.get(m.t);
    if (w) { this.waits.delete(m.t); w(m); } else this.inbox.push(m);
  }

  // The other player left, or the network failed.
  lost() {
    if (this.e === 4 || this.ending) return;
    this.dispose();
    if (B.bq === this) B.linkLost();
  }

  openSocket() {
    return new Promise((res) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/api/match/${this.room}?role=${this.role}`);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => res(true);
      ws.onerror = () => res(false);
      ws.onclose = () => { res(false); this.lost(); };
      ws.onmessage = (ev) => this.onData(ev.data, false);
      this.ws = ws;
    });
  }

  // Try a direct link. The joiner makes the offer.
  startP2P() {
    if (this.pc || this.e === 4 || typeof RTCPeerConnection === 'undefined') return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.onicecandidate = (ev) => { if (ev.candidate) this.ctl({ t: 'ice', c: ev.candidate }); };
    const useDc = (dc) => {
      dc.binaryType = 'arraybuffer';
      dc.onmessage = (ev) => this.onData(ev.data, true);
      dc.onclose = () => { if (this.via === 'p2p') this.lost(); };
      this.dc = dc;
    };
    if (this.role === 'join') {
      useDc(pc.createDataChannel('game', { ordered: true }));
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => this.ctl({ t: 'sdp', sdp: pc.localDescription }))
        .catch(() => {});
    } else {
      pc.ondatachannel = (ev) => useDc(ev.channel);
    }
  }

  onSdp(sdp) {
    const pc = this.pc;
    if (!pc || !sdp) return;
    pc.setRemoteDescription(sdp)
      .then(() => {
        if (sdp.type !== 'offer') return null;
        return pc.createAnswer()
          .then((a) => pc.setLocalDescription(a))
          .then(() => this.ctl({ t: 'sdp', sdp: pc.localDescription }));
      })
      .catch(() => {});
  }

  _openStreams() {
    this.g = true;
    this.b = new LinkInputStream();
    this.c = new LinkOutputStream(this);
  }

  // a(boolean): start the link thread (bl = search and connect as master)
  start(bl) {
    J.d = bl;
    this.e = 1;
    this.run();
  }

  // a(int, byte[]): send a control code
  send(n2, byArray) {
    try {
      this.c.writeInt(n2);
      this.c.writeInt(byArray.length);
      this.c.write(byArray);
      this.c.flush();
    } catch (exception) {}
  }

  // a(): ask the other phone to close the link
  quit() {
    this.ending = true;
    this.send(-254, new Uint8Array(0));
  }

  // b(): read one message
  async step() {
    const n2 = await this.b.readInt();
    switch (n2) {
      case -254:
        this.ending = true;
        this.send(-255, new Uint8Array(0));
        await sleep(2000);
        this.close();
        B.linkClosed(true);
        this.e = 4;
        break;
      case -255:
        this.close();
        B.linkClosed(false);
        this.e = 4;
        break;
      default:
        await this.b.need(18);
        B.recvPacket(n2, this.b);
    }
  }

  // d(): close the streams
  close() {
    this.ending = true;
    if (this.b) this.b.close();
    this.b = null;
    this.c = null;
    this.g = null;
    for (const x of [this.dc, this.pc, this.ws]) { try { if (x) x.close(); } catch (e) {} }
  }

  // The game left the match; this link must stop.
  dispose() {
    this.e = 4;
    this.close();
    for (const w of this.waits.values()) w(null);
    this.waits.clear();
  }

  // c(): connect. Returns false when the other player does not come.
  async connect() {
    B.setStatus(B.bk[40]);
    if (!(await this.openSocket()) || this.e === 4) return false;
    if (!(await this.waitFor('open', OPEN_WAIT_MS)) || this.e === 4) return false;
    this.startP2P();
    if (this.role === 'join') {
      // The master chooses the way and measures the delay, then tells the host.
      const t0 = Date.now();
      while (Date.now() - t0 < P2P_WAIT_MS && !(this.dc && this.dc.readyState === 'open') && this.e !== 4) await sleep(50);
      this.via = this.dc && this.dc.readyState === 'open' ? 'p2p' : 'relay';
      const rtt = [];
      for (let n = 0; n < 4 && this.e !== 4; n++) {
        const t = performance.now();
        this.ctl({ t: 'ping', n }, this.via === 'p2p');
        if (!(await this.waitFor('pong', 3000))) return false;
        rtt.push(performance.now() - t);
      }
      if (this.e === 4) return false;
      rtt.sort((a, b) => a - b);
      const w = J.windowFor(rtt[rtt.length >> 1]);
      this._openStreams();
      this.ctl({ t: 'go', via: this.via, w });
      B.linkWindow = w;
    } else {
      const m = await this.waitFor('go', P2P_WAIT_MS + 15000);
      if (!m || this.e === 4) return false;
      this.via = m.via === 'p2p' ? 'p2p' : 'relay';
      this._openStreams();
      B.linkWindow = m.w | 0 || 2;
    }
    B.linkVia = this.via;
    B.setStatus(B.bk[41]);
    return true;
  }

  // run(): the link thread
  async run() {
    try {
      while (this.e !== 4) {
        switch (this.e) {
          case 0:
            await sleep(0);
            break;
          case 1: {
            const ok = await this.connect();
            if (B.bq !== this) { this.e = 4; break; }
            this.e = B.connected(ok) ? 2 : 4;
            if (!ok) this.lost();
            await sleep(B.z);
            break;
          }
          case 2:
            await this.step();
            await sleep(B.z);
        }
      }
    } catch (exception) {
      this.e = 4;
    }
  }
}

// Web: the game waits when it is this many packets ahead of the other
// player (2 in the original, for Bluetooth). On a slow internet link a
// larger number keeps the game going; 50 ms = one packet.
J.windowFor = (rttMs) => Math.max(2, Math.ceil((rttMs / 2 + 30) / 50) + 1);
J.d = false;

window.addEventListener('pagehide', () => { if (B.bq) B.bq.close(); });
