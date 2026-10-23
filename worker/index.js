// Online play for the web port.
//
//   /api/lobby          WebSocket to the airfield (one Lobby Durable Object)
//   /api/match/<room>   WebSocket to a private match (one Match Durable Object
//                       per fight). It passes the game's own link packets
//                       between the two players.
//
// All other paths are the static game files.

import { DurableObject } from 'cloudflare:workers';

const ROOM_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lobby') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
      return env.LOBBY.get(env.LOBBY.idFromName('global')).fetch(request);
    }
    if (url.pathname.startsWith('/api/match/')) {
      const room = url.pathname.slice('/api/match/'.length);
      if (!ROOM_RE.test(room)) return new Response('Bad room', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
      return env.MATCH.get(env.MATCH.idFromName(room)).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------- lobby
// The airfield: who is online, where they stand, and the fight invites.
// Each socket keeps its player in its attachment, so the object can sleep
// (WebSocket hibernation) between messages.

const WORLD_W = 384;           // airfield width in game pixels (same as the client)
const COLORS = 10;             // number of player colours (the client has the list)
const COLOR_ORDER = [0, 6, 3, 8, 1, 5, 9, 2, 7, 4];
const PILOTS = 8;              // the 8 pilots of the game
const INVITE_MS = 20000;       // an invite is open for this long (client shows 15 s)
const NAME_MAX = 12;

function cleanName(s) {
  // Only the characters the game font has (names are drawn with it).
  s = String(s || '').replace(/[^ !"#%'()*,\-.0-9<?A-Za-z]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return s || 'Pilot';
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const publicInfo = (p) => ({ id: p.id, name: p.name, pilot: p.pilot, color: p.color, x: p.x, dir: p.dir, walk: p.walk, busy: p.busy });

export class Lobby extends DurableObject {
  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), ready: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  players() {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      const p = ws.deserializeAttachment();
      if (p && p.ready) out.push({ ws, p });
    }
    return out;
  }

  find(id) { return this.players().find((e) => e.p.id === id) || null; }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) {} }

  broadcast(msg, exceptId) {
    const s = JSON.stringify(msg);
    for (const { ws, p } of this.players()) {
      if (p.id === exceptId) continue;
      try { ws.send(s); } catch (e) {}
    }
  }

  save(ws, p) { ws.serializeAttachment(p); }

  // The least used colour, a free one when there is one. The colours are
  // tried in an order that keeps the first players' colours far apart.
  pickColor(exceptId, after = -1) {
    const used = new Array(COLORS).fill(0);
    for (const { p } of this.players()) if (p.id !== exceptId) used[p.color]++;
    const start = after < 0 ? 0 : (COLOR_ORDER.indexOf(after) + 1) % COLORS;
    let best = -1;
    for (let k = 0; k < COLORS; k++) {
      const c = COLOR_ORDER[(start + k) % COLORS];
      if (best < 0 || used[c] < used[best]) best = c;
    }
    return best;
  }

  // The player who has an open invite to this player, if any.
  inviterOf(id) {
    const now = Date.now();
    return this.players().find((e) => e.p.inviting === id && now - e.p.inviteAt < INVITE_MS) || null;
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > 512) return;
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    const p = ws.deserializeAttachment();
    if (!p) return;

    if (m.t === 'hello') {
      if (p.ready) return;
      p.ready = true;
      p.name = cleanName(m.name);
      p.pilot = clamp(m.pilot | 0, 0, PILOTS - 1);
      p.color = Number.isInteger(m.color) && m.color >= 0 && m.color < COLORS ? this.pickColorPref(m.color, p.id) : this.pickColor(p.id);
      p.x = clamp(m.x | 0 || 40 + Math.floor(Math.random() * (WORLD_W - 80)), 8, WORLD_W - 8);
      p.dir = 1; p.walk = false; p.busy = false;
      p.inviting = null; p.inviteAt = 0; p.sayAt = 0;
      this.save(ws, p);
      const others = this.players().filter((e) => e.p.id !== p.id).map((e) => publicInfo(e.p));
      this.send(ws, { t: 'welcome', you: publicInfo(p), players: others });
      this.broadcast({ t: 'join', p: publicInfo(p) }, p.id);
      return;
    }
    if (!p.ready) return;

    switch (m.t) {
      case 'move':
        p.x = clamp(Number(m.x) || 0, 8, WORLD_W - 8);
        p.dir = m.dir < 0 ? -1 : 1;
        p.walk = !!m.walk;
        this.save(ws, p);
        this.broadcast({ t: 'move', id: p.id, x: p.x, dir: p.dir, walk: p.walk }, p.id);
        break;
      case 'say': {
        const now = Date.now();
        if (now - p.sayAt < 1500) break;
        p.sayAt = now;
        this.save(ws, p);
        this.broadcast({ t: 'say', id: p.id, i: clamp(m.i | 0, 0, 3) });
        break;
      }
      case 'color':
        p.color = this.pickColor(p.id, p.color);
        this.save(ws, p);
        this.broadcast({ t: 'color', id: p.id, color: p.color });
        break;
      case 'invite': {
        const t = this.find(m.to);
        const reject = (reason) => this.send(ws, { t: 'declined', by: m.to, reason });
        if (!t || t.p.id === p.id) { reject('gone'); break; }
        if (p.busy || t.p.busy) { reject('busy'); break; }
        const other = this.inviterOf(t.p.id);
        if (other && other.p.id !== p.id) { reject('busy'); break; }
        // An invite from them to me that is still open: this is a yes.
        if (t.p.inviting === p.id && Date.now() - t.p.inviteAt < INVITE_MS) {
          this.startMatch(t, { ws, p });
          break;
        }
        p.inviting = t.p.id;
        p.inviteAt = Date.now();
        this.save(ws, p);
        this.send(t.ws, { t: 'invited', from: p.id });
        break;
      }
      case 'cancel':
        if (p.inviting) {
          const t = this.find(p.inviting);
          if (t) this.send(t.ws, { t: 'uninvited', from: p.id });
          p.inviting = null;
          this.save(ws, p);
        }
        break;
      case 'reply': {
        const f = this.find(m.from);
        if (!f || f.p.inviting !== p.id || Date.now() - f.p.inviteAt >= INVITE_MS) {
          this.send(ws, { t: 'uninvited', from: m.from });
          break;
        }
        if (m.ok && !p.busy && !f.p.busy) {
          this.startMatch(f, { ws, p });
        } else {
          f.p.inviting = null;
          this.save(f.ws, f.p);
          this.send(f.ws, { t: 'declined', by: p.id, reason: 'no' });
        }
        break;
      }
      case 'free':
        if (p.busy) {
          p.busy = false;
          this.save(ws, p);
          this.broadcast({ t: 'busy', id: p.id, busy: false });
        }
        break;
    }
  }

  pickColorPref(c, id) {
    // Keep the colour the player had before (after a reconnect) if it is free.
    for (const { p } of this.players()) if (p.id !== id && p.color === c) return this.pickColor(id);
    return c;
  }

  // host = the player who asked, join = the player who said yes.
  startMatch(host, join) {
    const room = crypto.randomUUID();
    for (const e of [host, join]) {
      e.p.busy = true;
      e.p.inviting = null;
      this.save(e.ws, e.p);
    }
    this.send(host.ws, { t: 'match', room, role: 'host', opp: publicInfo(join.p) });
    this.send(join.ws, { t: 'match', room, role: 'join', opp: publicInfo(host.p) });
    this.broadcast({ t: 'busy', id: host.p.id, busy: true });
    this.broadcast({ t: 'busy', id: join.p.id, busy: true });
  }

  leave(ws) {
    const p = ws.deserializeAttachment();
    if (!p || !p.ready) return;
    p.ready = false;
    ws.serializeAttachment(p);
    if (p.inviting) {
      const t = this.find(p.inviting);
      if (t) this.send(t.ws, { t: 'uninvited', from: p.id });
    }
    const f = this.inviterOf(p.id);
    if (f) {
      f.p.inviting = null;
      this.save(f.ws, f.p);
      this.send(f.ws, { t: 'declined', by: p.id, reason: 'gone' });
    }
    this.broadcast({ t: 'leave', id: p.id }, p.id);
  }

  async webSocketClose(ws, code) {
    this.leave(ws);
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {}
  }

  async webSocketError(ws) {
    this.leave(ws);
  }
}

// ---------------------------------------------------------------- match
// A private room for two players: 'host' (asked for the fight) and 'join'
// (said yes). When both are in, each gets {"t":"open"}. Then every message
// goes to the other player unchanged. When one leaves, the other gets
// {"t":"bye"}.

export class Match extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    if (role !== 'host' && role !== 'join') return new Response('Bad role', { status: 400 });
    if (this.ctx.getWebSockets(role).length > 0) return new Response('Taken', { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [role]);
    // Test only: ?lag=ms delays what this player sends (to try slow links).
    // It only makes the game slower for the player who asks for it.
    const lag = clamp(parseInt(url.searchParams.get('lag'), 10) || 0, 0, 1000);
    server.serializeAttachment({ role, lag });
    if (this.ctx.getWebSockets('host').length && this.ctx.getWebSockets('join').length) {
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send('{"t":"open"}'); } catch (e) {}
      }
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  other(ws) {
    const a = ws.deserializeAttachment();
    return this.ctx.getWebSockets(a.role === 'host' ? 'join' : 'host')[0] || null;
  }

  async webSocketMessage(ws, data) {
    const o = this.other(ws);
    if (!o) return;
    const { lag } = ws.deserializeAttachment();
    if (lag) setTimeout(() => { try { o.send(data); } catch (e) {} }, lag);
    else o.send(data);
  }

  async webSocketClose(ws, code) {
    const o = this.other(ws);
    if (o) {
      try { o.send('{"t":"bye"}'); o.close(1000, 'bye'); } catch (e) {}
    }
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {}
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011);
  }
}
