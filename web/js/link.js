// Port of class j (and its helpers l, m): the Bluetooth link.
// A browser has no Bluetooth serial port, so the link runs over a
// BroadcastChannel between two tabs (or frames) of the same site. The rest is
// as in the original: the host waits for a client ("acceptAndOpen"), the
// client searches for a "BIPLANES" service and connects, and then both read
// a stream of ints and bytes. The client (j.d == true) is the master.
'use strict';

const LINK_CHANNEL = 'bt-biplanes';
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

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
    if (!this.link.peer) throw new Error('IOException: not connected');
    this.link.post({ t: 'data', to: this.link.peer, bytes: this.buf });
    this.buf = [];
  }
  close() {}
}

class J {
  constructor() {
    this.b = null;   // DataInputStream
    this.c = null;   // DataOutputStream
    this.e = 0;      // thread state: 1 connect, 2 read, 4 end
    this.g = null;   // StreamConnection (here: true when open)
    this.id = Math.random().toString(36).slice(2);
    this.peer = null;
    this.accepting = false;
    this.found = [];
    this.connectWait = null;
    this.ch = new BroadcastChannel(LINK_CHANNEL);
    this.ch.onmessage = (ev) => this.onMessage(ev.data);
  }

  post(msg) { msg.from = this.id; this.ch.postMessage(msg); }

  onMessage(m) {
    if (m.to && m.to !== this.id) return;
    switch (m.t) {
      case 'inquiry':
        // A host that waits answers a service search.
        if (this.accepting) this.post({ t: 'service', to: m.from, name: 'BIPLANES' });
        break;
      case 'service':
        if (m.name === 'BIPLANES' && !this.found.includes(m.from)) this.found.push(m.from);
        break;
      case 'open':
        if (this.accepting && B.bq === this) {
          this.accepting = false;
          this.peer = m.from;
          this._openStreams();
          this.post({ t: 'opened', to: m.from });
          if (this.connectWait) { const w = this.connectWait; this.connectWait = null; w(true); }
        }
        break;
      case 'opened':
        if (this.connectWait) {
          this.peer = m.from;
          this._openStreams();
          const w = this.connectWait; this.connectWait = null; w(true);
        }
        break;
      case 'data':
        if (this.b && m.from === this.peer) this.b.push(m.bytes);
        break;
      case 'close':
        if (m.from === this.peer && this.b) this.b.close();
        break;
    }
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
  quit() { this.send(-254, new Uint8Array(0)); }

  // b(): read one message
  async step() {
    const n2 = await this.b.readInt();
    switch (n2) {
      case -254:
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
    if (this.peer) this.post({ t: 'close', to: this.peer });
    if (this.b) this.b.close();
    this.b = null;
    this.c = null;
    this.g = null;
    this.accepting = false;
  }

  // The menu made a new link object; this one must stop.
  dispose() {
    this.e = 4;
    this.accepting = false;
    if (this.b) this.b.close();
    if (this.connectWait) { const w = this.connectWait; this.connectWait = null; w(false); }
  }

  // c(): connect. Returns false when no game is found.
  async connect() {
    if (!J.d) {
      B.setStatus(B.bk[40]);
      this.accepting = true;
      await new Promise((res) => { this.connectWait = res; });
      if (this.e === 4) return false;
      B.setStatus(B.bk[41]);
    } else {
      B.setStatus(B.bk[42]);
      this.found = [];
      this.post({ t: 'inquiry' });
      await sleep(3000);
      if (this.found.length === 0) return false;
      this.post({ t: 'open', to: this.found[0] });
      const ok = await Promise.race([
        new Promise((res) => { this.connectWait = res; }),
        sleep(5000).then(() => false),
      ]);
      this.connectWait = null;
      if (!ok) {
        B.setStatus(B.bk[43]);
        return false;
      }
      B.setStatus(B.bk[41]);
    }
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
J.d = false;

window.addEventListener('pagehide', () => { if (B.bq && B.bq.peer) B.bq.close(); });
