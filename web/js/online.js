// Online play (a web addition, not in the original game).
//
// Main menu "Online" -> your name -> choose a pilot and a colour -> the
// airfield, where every online player is a little pilot on the ground.
// Walk up to someone and ask for a fight; when they say yes, both go to a
// private match, which is the original two-player game. After it, both are
// back on the airfield.
//
// The server side is worker/index.js. This file draws with the game's own
// Graphics, font and sprites, and uses the game's soft keys, so the touch
// buttons and the keys work as in the menus.
'use strict';

const O = {
  STATE: 20,              // B.a while an online screen shows
  WORLD_W: 384,           // airfield width: 3 ground tiles (same as the server)
  WALK_Y: 185,            // ground line of a pilot (as in the game)
  BARN_X: 175,            // left edge of the barn, in the middle of the field
  SPEED: 2,               // walking speed, pixels per tick
  NEAR: 22,               // how close you must be to ask for a fight
  INVITE_MS: 15000,       // an invite waits this long for an answer
  NAME_MAX: 12,
  // Player colours (hue in degrees); the server gives each player one.
  HUES: [0, 28, 52, 95, 135, 172, 198, 225, 268, 312],
  // The 8 pilots: /tm strings of the names, /a8 index of the portraits.
  PILOT_NAMES: [3, 4, 5, 6, 37, 38, 39, 40],

  mode: 'off',            // 'name' | 'pick' | 'connecting' | 'field' | 'match'
  name: '',
  pilot: 0,
  color: 0,
  ws: null,               // lobby socket
  me: null,               // my player (as the server knows it)
  players: new Map(),     // other players by id
  target: null,           // the player near enough to ask
  out: null,              // my open invite {id, until}
  inc: null,              // an invite to me {id, until}
  status: null,           // short message at the top {text, until}
  opp: null,              // the other player in the match
  wasConnected: false,
  leaveAfterMessage: false,
  walkTo: null,           // x to walk to (after a tap)
  sendAt: 0,
  sentX: -1,
  sentWalk: false,
  ticks: 0,
  clouds: [{ x: 40, y: 30 }, { x: 250, y: 70 }],
  skins: new Map(),       // colour -> recoloured sprites
  names: [],              // pilot names
  earth: 0x6b3d1f,        // colour under the ground strip

  // ------------------------------------------------------------ setup
  init() {
    const tm = B.readStrings('/tm');
    O.names = O.PILOT_NAMES.map((i) => tm[i]);
    // The colour of the lowest ground row, to fill below the arena.
    const img = B.ba;
    const c = document.createElement('canvas');
    c.width = img.w; c.height = img.h;
    const x = c.getContext('2d');
    x.drawImage(img.src, 0, 0);
    const d = x.getImageData(2, img.h - 1, 1, 1).data;
    O.earth = (d[0] << 16) | (d[1] << 8) | d[2];
    try {
      const saved = JSON.parse(localStorage.getItem('btbiplanes.online') || '{}');
      O.name = O.cleanName(saved.name || '');
      O.pilot = Math.min(7, Math.max(0, saved.pilot | 0));
      O.color = Number.isInteger(saved.color) ? saved.color % O.HUES.length : Math.floor(Math.random() * O.HUES.length);
    } catch (e) {}
    const form = document.getElementById('online-name');
    const input = document.getElementById('pilot-name');
    input.maxLength = O.NAME_MAX;
    input.addEventListener('input', () => {
      const v = O.cleanName(input.value, true);
      if (v !== input.value) input.value = v;
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = O.cleanName(input.value);
      if (!v) { input.focus(); return; }
      O.name = v;
      O.save();
      O.hideName();
      O.mode = 'pick';
    });
    document.getElementById('name-back').addEventListener('click', () => { O.hideName(); O.exit(); });
  },

  save() {
    try {
      localStorage.setItem('btbiplanes.online', JSON.stringify({ name: O.name, pilot: O.pilot, color: O.color }));
    } catch (e) {}
  },

  // Only characters the game font can draw.
  cleanName(s, keepEnd) {
    let out = '';
    for (const ch of String(s)) {
      if (ch === ' ' || (ch.charCodeAt(0) < 127 && B.bm.index(ch.charCodeAt(0)) >= 0)) out += ch;
    }
    out = out.replace(/\s+/g, ' ').slice(0, O.NAME_MAX);
    return keepEnd ? out.replace(/^\s+/, '') : out.trim();
  },

  showName() {
    const form = document.getElementById('online-name');
    const input = document.getElementById('pilot-name');
    form.hidden = false;
    document.body.classList.add('naming');
    input.value = O.name;
    setTimeout(() => { input.focus(); input.select(); }, 50);
  },

  hideName() {
    document.getElementById('online-name').hidden = true;
    document.body.classList.remove('naming');
    const input = document.getElementById('pilot-name');
    input.blur();
  },

  // ------------------------------------------------------------ enter / leave
  // From the main menu.
  start() {
    B.a = O.STATE;
    O.mode = 'name';
    O.status = null;
    I.clear();
    O.showName();
  },

  // Back to the main menu.
  exit() {
    O.closeLobby();
    O.hideName();
    O.mode = 'off';
    O.players.clear();
    O.me = null;
    O.inc = O.out = O.target = null;
    B.a = 2;
    G.open(0);
    B.h = false;
    I.clear();
    B.repaint();
  },

  // ------------------------------------------------------------ lobby socket
  connectLobby() {
    O.closeLobby();
    O.mode = 'connecting';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/lobby`);
    O.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', name: O.name, pilot: O.pilot, color: O.color, x: O.me ? Math.round(O.me.x) : 0 }));
    };
    ws.onmessage = (ev) => {
      if (O.ws !== ws) return;
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      O.onLobby(m);
    };
    ws.onclose = () => {
      if (O.ws !== ws) return;
      O.ws = null;
      if (O.mode === 'field' || O.mode === 'connecting') {
        O.mode = 'lost';
        B.showMessage(B.bk[44], 0);   // "Connection failed."
      }
    };
  },

  closeLobby() {
    const ws = O.ws;
    O.ws = null;
    if (ws) { try { ws.close(); } catch (e) {} }
  },

  sendLobby(msg) {
    if (O.ws && O.ws.readyState === 1) O.ws.send(JSON.stringify(msg));
  },

  addPlayer(p) {
    p.tx = p.x;
    p.frame = 0;
    p.say = null;
    O.players.set(p.id, p);
  },

  onLobby(m) {
    const now = Date.now();
    switch (m.t) {
      case 'welcome':
        O.me = m.you;
        O.me.frame = 0;
        O.me.say = null;
        O.color = m.you.color;
        O.save();
        O.players.clear();
        for (const p of m.players) O.addPlayer(p);
        O.mode = O.mode === 'match' ? 'match' : 'field';
        O.sentX = O.me.x;
        break;
      case 'join':
        O.addPlayer(m.p);
        break;
      case 'leave':
        O.players.delete(m.id);
        if (O.inc && O.inc.id === m.id) O.inc = null;
        break;
      case 'move': {
        const p = O.players.get(m.id);
        if (p) { p.tx = m.x; p.dir = m.dir; p.walk = m.walk; }
        break;
      }
      case 'say': {
        const p = m.id === (O.me && O.me.id) ? O.me : O.players.get(m.id);
        if (p) O.say(p, m.i);
        break;
      }
      case 'color': {
        const p = m.id === (O.me && O.me.id) ? O.me : O.players.get(m.id);
        if (p) { p.color = m.color; p.tag = null; }
        if (p === O.me) { O.color = m.color; O.save(); }
        break;
      }
      case 'busy': {
        const p = O.players.get(m.id);
        if (p) {
          p.busy = m.busy;
          // Back from a match: show them where they stand now.
          if (!m.busy) p.x = p.tx;
        }
        break;
      }
      case 'invited':
        O.inc = { id: m.from, until: now + O.INVITE_MS };
        B.playSound(1, 0);
        break;
      case 'uninvited':
        if (O.inc && O.inc.id === m.from) O.inc = null;
        break;
      case 'declined': {
        if (!O.out || O.out.id !== m.by) break;
        const p = O.players.get(m.by);
        const who = p ? p.name : '';
        O.out = null;
        O.setStatus(m.reason === 'busy' ? who + ' is busy.' : m.reason === 'gone' ? who + ' left.' : who + ' said no.');
        break;
      }
      case 'match':
        O.startMatch(m);
        break;
    }
  },

  setStatus(text) { O.status = { text, until: Date.now() + 3500 }; },

  // A taunt of the player's pilot, in a speech bubble for a few seconds.
  say(p, i) {
    const text = B.bl[p.pilot * 4 + (i & 3)];
    p.say = { img: O.bubbleImage(text), until: Date.now() + 3500 };
  },

  // ------------------------------------------------------------ per tick
  tick() {
    O.ticks++;
    let key;
    while ((key = I.next()) !== -66) O.key(key);
    if (O.mode === 'field') O.tickField();
    for (const c of O.clouds) {
      c.x += 0.2;
      if (c.x > O.WORLD_W + 32) { c.x = -32; c.y = 20 + Math.floor(Math.random() * 70); }
    }
  },

  // Called after each game tick (main.js), also during a match.
  watch() {
    if (O.mode === 'match') {
      if (B.d) O.wasConnected = true;
      if (O.leaveAfterMessage) {
        if (B.cy < 0) O.backToField();
        return;
      }
      // The match is over when the game is back in its main menu (after the
      // result pages, or after "Bail Out!" in the pause menu).
      if (B.a === 2 && G.d !== G.g[30]) O.backToField();
    } else if (O.mode === 'lost' && B.cy < 0) {
      O.exit();
    }
  },

  key(k) {
    switch (O.mode) {
      case 'name':
        if (k === 16) { O.hideName(); O.exit(); }
        else document.getElementById('pilot-name').focus();
        break;
      case 'pick':
        if (k === 12) O.pilot = (O.pilot + 7) % 8;
        else if (k === 13) O.pilot = (O.pilot + 1) % 8;
        else if (k === 10) O.color = (O.color + O.HUES.length - 1) % O.HUES.length;
        else if (k === 11) O.color = (O.color + 1) % O.HUES.length;
        else if (k === 14 || k === 15) { O.save(); O.connectLobby(); }
        else if (k === 16) { O.mode = 'name'; O.showName(); }
        break;
      case 'connecting':
        if (k === 16) O.exit();
        break;
      case 'field':
        if (k === 14 || k === 15) O.action();
        else if (k === 16) {
          if (O.inc) O.answer(false);
          else O.exit();
        } else if (k === 17) O.sendLobby({ t: 'say', i: Math.floor(Math.random() * 4) });
        break;
    }
  },

  // Fire / left soft key on the airfield: answer, stop asking, or ask.
  action() {
    if (O.inc) { O.answer(true); return; }
    if (O.out) {
      O.sendLobby({ t: 'cancel' });
      O.out = null;
      return;
    }
    if (O.target) {
      O.out = { id: O.target.id, until: Date.now() + O.INVITE_MS };
      O.sendLobby({ t: 'invite', to: O.target.id });
    }
  },

  answer(ok) {
    if (!O.inc) return;
    O.sendLobby({ t: 'reply', from: O.inc.id, ok });
    O.inc = null;
  },

  // A tap on the screen (game coordinates).
  tap(x, y) {
    if (O.mode === 'pick') {
      const L = O.pickLayout();
      for (let c = 0; c < O.HUES.length; c++) {
        const sx = L.swX + c * L.swStep;
        if (x >= sx - 1 && x < sx + L.swStep && y >= L.swY - 2 && y < L.swY + 8) { O.color = c; return; }
      }
      if (x < B.r / 3) O.key(12);
      else if (x > (B.r * 2) / 3) O.key(13);
      return;
    }
    if (O.mode !== 'field' || !O.me) return;
    const wx = x + B.ai, wy = y + B.aj;
    if (Math.abs(wx - O.me.x) < 10 && Math.abs(wy - O.WALK_Y) < 16) {
      O.sendLobby({ t: 'say', i: Math.floor(Math.random() * 4) });
      return;
    }
    O.walkTo = Math.max(8, Math.min(O.WORLD_W - 8, Math.round(wx)));
  },

  tickField() {
    const me = O.me;
    if (!me) return;
    const now = Date.now();
    // Walking: held keys or the stick; a tap walks to a place.
    let dx = 0;
    if (I.held(12)) dx -= 1;
    if (I.held(13)) dx += 1;
    if (dx !== 0) O.walkTo = null;
    else if (O.walkTo !== null) {
      const d = O.walkTo - me.x;
      if (Math.abs(d) <= O.SPEED) { me.x = O.walkTo; O.walkTo = null; }
      else dx = Math.sign(d);
    }
    if (dx !== 0) {
      me.x = Math.max(8, Math.min(O.WORLD_W - 8, me.x + dx * O.SPEED));
      me.dir = dx;
    }
    me.walk = dx !== 0;
    if (me.walk && O.ticks % 3 === 0) me.frame ^= 1;
    if (!me.walk) me.frame = 0;
    if ((me.x !== O.sentX && now - O.sendAt >= 100) || me.walk !== O.sentWalk) {
      O.sendLobby({ t: 'move', x: me.x, dir: me.dir, walk: me.walk });
      O.sendAt = now;
      O.sentX = me.x;
      O.sentWalk = me.walk;
    }
    // Other players walk to where the server says they are.
    for (const p of O.players.values()) {
      const d = p.tx - p.x;
      if (Math.abs(d) > 60) p.x = p.tx;
      else if (Math.abs(d) <= O.SPEED + 0.5) p.x = p.tx;
      else { p.x += Math.sign(d) * (O.SPEED + 0.5); p.dir = Math.sign(d); }
      const moving = p.walk || Math.abs(p.tx - p.x) > 0;
      if (moving && O.ticks % 3 === 0) p.frame ^= 1;
      if (!moving) p.frame = 0;
    }
    // The nearest free player in reach
    let best = null;
    for (const p of O.players.values()) {
      if (p.busy) continue;
      const d = Math.abs(p.x - me.x);
      if (d <= O.NEAR && (!best || d < Math.abs(best.x - me.x))) best = p;
    }
    O.target = best;
    if (O.out && now > O.out.until) {
      O.sendLobby({ t: 'cancel' });
      const p = O.players.get(O.out.id);
      O.out = null;
      O.setStatus((p ? p.name : '') + ' did not answer.');
    }
    if (O.out && !O.players.has(O.out.id)) O.out = null;
    if (O.inc && (now > O.inc.until || !O.players.has(O.inc.id))) O.answer(false);
  },

  // ------------------------------------------------------------ the match
  startMatch(m) {
    O.inc = O.out = null;
    O.opp = m.opp;
    O.lastOpp = m.opp.id;
    O.mode = 'match';
    O.wasConnected = false;
    O.leaveAfterMessage = false;
    if (B.bq) B.bq.dispose();
    B.bq = new J(m.room, m.role);
    const ae = 35 + O.pilot;
    // The same set-up as menu commands 24 ("Start Bluetooth Game") and 28
    // ("Join Bluetooth Game") in the original; the pilot can be any of 8.
    if (m.role === 'host') {
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
      B.a6[0].ae = ae;
    } else {
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
      B.a6[0].ae = ae;
    }
    B.a = 1;
    B.au = 30;
    G.open(0);
    // Each plane and pilot in the colour of its player
    if (m.opp.color !== O.color) {
      B.a6[0].skin = O.skin(O.color).planes;
      B.a6[0].pskin = O.skin(O.color).pilot;
      B.a6[1].skin = O.skin(m.opp.color).planes;
      B.a6[1].pskin = O.skin(m.opp.color).pilot;
    }
    I.clear();
    B.repaint();
  },

  // The link closed. During play this means the other player left.
  onLinkClosed() {
    if (O.mode !== 'match' || O.leaveAfterMessage) return;
    const inPlay = B.a === 1 || (B.a === 2 && G.d === G.g[30]);
    if (!inPlay) return;   // normal end: the score board is on its way
    B.d = false;
    B.bp = '';
    O.leaveAfterMessage = true;
    const who = O.opp ? O.opp.name : '';
    if (B.cy >= 0) {
      // Another message is open: close it and draw the game again first.
      B.cy = -1;
      B.paintNow();
    }
    B.showMessage(O.wasConnected ? who + ' left the game.' : B.bk[44], 0);
  },

  backToField() {
    O.leaveAfterMessage = false;
    if (B.bq) { B.bq.dispose(); B.bq = null; }
    B.d = false;
    B.as = 0;
    B.o = 0;
    B.bp = '';
    B.linkWindow = 2;
    for (const e of B.a6) { e.skin = null; e.pskin = null; }
    B.a = O.STATE;
    I.clear();
    if (O.ws && O.ws.readyState === 1) {
      O.mode = 'field';
      O.sendLobby({ t: 'free' });
    } else {
      O.connectLobby();
    }
    B.repaint();
  },

  // ------------------------------------------------------------ colours
  hsl(c) { return O.HUES[c % O.HUES.length]; },
  rgbOf(c) {
    const [r, g, b] = O.hslToRgb(O.hsl(c) / 360, 0.85, 0.55);
    return (r << 16) | (g << 8) | b;
  },

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn;
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h / 6, s, l];
  },

  hslToRgb(h, s, l) {
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  },

  // A copy of img with the colours near hue `from` (within `half` degrees,
  // saturation at least minS) turned to the player's hue. The shading stays.
  recolor(img, from, half, minS, toHue, flip = false) {
    const c = document.createElement('canvas');
    c.width = img.w; c.height = img.h;
    const x = c.getContext('2d');
    if (flip) { x.translate(img.w, 0); x.scale(-1, 1); }
    x.drawImage(img.src, 0, 0);
    const data = x.getImageData(0, 0, img.w, img.h);
    const d = data.data;
    const shift = (toHue - from + 360) % 360;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const [h, s, l] = O.rgbToHsl(d[i], d[i + 1], d[i + 2]);
      const hd = Math.abs(((h * 360 - from + 540) % 360) - 180);
      if (s < minS || hd > half) continue;
      const [r, g, b] = O.hslToRgb(((h * 360 + shift) % 360) / 360, s, l);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.putImageData(data, 0, 0);
    return new MImage(c, img.w, img.h, false);
  },

  // Sprites in colour c: the 32 plane frames, the pilot frames for a match
  // (a copy of /a8 with the pilot replaced) and the little pilot for the
  // airfield, looking right (r) and left (l).
  skin(c) {
    let s = O.skins.get(c);
    if (s) return s;
    const hue = O.hsl(c);
    // Plane frames 0-15 are red / orange (around 20 degrees), 16-31 are
    // cyan / blue (around 198 degrees). The main colour of each set is
    // pure red (0) and cyan (181).
    const planes = B.a7.map((img, i) => (i < 16
      ? O.recolor(img, 20, 25, 0.45, (hue + 20) % 360)
      : O.recolor(img, 198, 20, 0.45, (hue + 17) % 360)));
    const pilot = B.a8.slice();
    // The pilot's suit is red (around 2 degrees).
    for (let i = 21; i <= 26; i++) pilot[i] = O.recolor(B.a8[i], 2, 12, 0.6, (hue + 2) % 360);
    const guy = {
      r: [pilot[21], pilot[22]],
      l: [O.recolor(B.a8[21], 2, 12, 0.6, (hue + 2) % 360, true), O.recolor(B.a8[22], 2, 12, 0.6, (hue + 2) % 360, true)],
    };
    s = { planes, pilot, guy };
    O.skins.set(c, s);
    return s;
  },

  // ------------------------------------------------------------ small images
  // Text in the game font on a transparent image.
  textImage(lines, bg, border, pad = 2) {
    const f = B.bm;
    let w = 0;
    for (const l of lines) w = Math.max(w, f.width(l));
    const W = w + pad * 2, H = lines.length * f.a + pad * 2;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = new Graphics(c);
    if (bg != null) {
      g.setColor(bg);
      g.fillRect(1, 0, W - 2, H);
      g.fillRect(0, 1, W, H - 2);
    }
    if (border != null) {
      g.setColor(border);
      g.fillRect(1, H - 1, W - 2, 1);
    }
    f.drawLines(g, lines, pad, pad, 20);
    return new MImage(c, W, H, false);
  },

  nameImage(p) {
    const key = p.name + '|' + p.color;
    if (p.tag && p.tagKey === key) return p.tag;
    p.tag = O.textImage([p.name], 0xFFFFFF, O.rgbOf(p.color), 1);
    p.tagKey = key;
    return p.tag;
  },

  bubbleImage(text) {
    const lines = B.bm.wrap(text, 90);
    const img = O.textImage(lines, 0xFFFFFF, null, 3);
    // a small tail under the bubble
    const c = document.createElement('canvas');
    c.width = img.w; c.height = img.h + 3;
    const x = c.getContext('2d');
    x.drawImage(img.src, 0, 0);
    x.fillStyle = '#ffffff';
    x.fillRect((img.w >> 1) - 2, img.h, 4, 1);
    x.fillRect((img.w >> 1) - 1, img.h + 1, 2, 1);
    x.fillRect((img.w >> 1), img.h + 2, 1, 1);
    return new MImage(c, c.width, c.height, false);
  },

  // ------------------------------------------------------------ drawing
  paint(g) {
    const W = B.r, H = B.s;
    let camX;
    if (O.me && (O.mode === 'field' || O.mode === 'match')) camX = O.me.x - (W >> 1);
    else camX = O.BARN_X + 17 - (W >> 1);
    camX = Math.max(0, Math.min(O.WORLD_W - W, Math.round(camX)));
    // In portrait on a touch screen the gamepad covers the bottom of the
    // screen, so the ground line is higher up there.
    const walkY = isTouch && H > W ? Math.round(H * 0.6) : H - 24;
    const camY = O.WALK_Y - walkY;
    O.drawScene(g, camX, camY);
    switch (O.mode) {
      case 'pick':
        O.drawPick(g);
        break;
      case 'connecting':
        O.drawBox(g, 'Connecting...');
        B.drawSoftKey(g, B.bk[1], false);
        break;
      case 'field':
        O.drawHud(g);
        break;
    }
  },

  // The airfield: sky, ground strip, barn, clouds and the players.
  drawScene(g, camX, camY) {
    const W = B.r, H = B.s;
    B.ai = camX;
    B.aj = camY;
    g.layer = 'world';
    g.setColor(52479);
    g.fillRect(0, 0, W, H);
    g.translate(-camX, -camY);
    g.space = 'world';
    for (let x = 0; x < O.WORLD_W; x += 128) {
      g.drawImage(B.ba, x, 124, 20);
      g.drawImage(B.bb, x, 0, 20);
    }
    g.setColor(O.earth);
    g.fillRect(0, 208, O.WORLD_W, 240);
    O.clouds.forEach((c, i) => {
      g.tag = 'oc' + i;
      g.drawImage(B.a9[0], Math.round(c.x), c.y, 3);
    });
    g.tag = null;
    g.drawImage(B.a8[1], O.BARN_X, 168, 20);
    if (O.mode === 'field' && O.me) {
      const shown = [...O.players.values()].filter((p) => !p.busy);
      O.stackTags([O.me, ...shown]);
      for (const p of shown) O.drawPlayer(g, p, false);
      O.drawPlayer(g, O.me, true);
    }
    g.translate(camX, camY);
    g.space = null;
    g.layer = null;
  },

  // Name tags of players who stand close go one above the other. Your own
  // tag stays on the lowest row.
  stackTags(list) {
    const rows = [];   // the [left, right] spans used in each row
    const order = [list[0], ...list.slice(1).sort((a, b) => a.x - b.x)];
    for (const p of order) {
      const w = O.nameImage(p).w;
      const left = Math.round(p.x) - (w >> 1), right = left + w;
      let r = 0;
      while (rows[r] && rows[r].some(([l, rr]) => left <= rr + 1 && right >= l - 1)) r++;
      (rows[r] = rows[r] || []).push([left, right]);
      p.row = r;
    }
  },

  drawPlayer(g, p, isMe) {
    const s = O.skin(p.color).guy;
    const x = Math.round(p.x);
    const y = O.WALK_Y;
    g.tag = 'g' + p.id;
    g.drawImage((p.dir < 0 ? s.l : s.r)[p.frame & 1], x, y, 3);
    const tag = O.nameImage(p);
    const ty = y - 5 - (p.row || 0) * (tag.h + 1);
    g.tag = 'n' + p.id;
    g.drawImage(tag, x, ty, 33);
    let top = ty - tag.h;
    // The player you can ask: a bouncing arrow over the name
    if (!isMe && O.target === p) {
      const b = (O.ticks >> 2) & 1;
      g.tag = 'm' + p.id;
      g.setColor(0xFFFF00);
      g.fillRect(x - 3, top - 5 - b, 7, 1);
      g.fillRect(x - 2, top - 4 - b, 5, 1);
      g.fillRect(x - 1, top - 3 - b, 3, 1);
      g.fillRect(x, top - 2 - b, 1, 1);
      top -= 6;
    }
    if (p.say && Date.now() < p.say.until) {
      g.tag = 's' + p.id;
      g.drawImage(p.say.img, x, top - 1, 33);
    } else {
      p.say = null;
    }
    g.tag = null;
  },

  // A panel in the style of the game's menus.
  panel(g, x, y, w, h, title) {
    g.setColor(6488245);
    g.fillRect(x, y, w, h);
    g.setColor(16671843);
    g.fillRect(x + 2, y + 2, w - 4, h - 4);
    if (title) {
      g.setColor(0x6699CC);
      g.fillRect(x + 2, y + 2, w - 4, B.bm.a + 3);
      B.bm.drawString(g, title, x + (w >> 1), y + 4, 17);
    }
  },

  drawBox(g, text) {
    const lines = B.bm.wrap(text, B.r - 24);
    const w = Math.min(B.r - 8, Math.max(...lines.map((l) => B.bm.width(l))) + 12);
    const h = lines.length * B.bm.a + 10;
    const x = (B.r - w) >> 1, y = Math.max(4, (B.s >> 1) - h - 10);
    O.panel(g, x, y, w, h, null);
    B.bm.drawLines(g, lines, B.r >> 1, y + 5, 17);
  },

  // Top of the airfield: how many are online, the last news, an invite.
  drawHud(g) {
    const now = Date.now();
    let free = 0, fighting = 0;
    for (const p of O.players.values()) (p.busy ? fighting++ : free++);
    let top = (free + fighting + 1) + ' online';
    if (fighting) top += ', ' + fighting + ' in a fight';
    let text = top;
    if (O.out) {
      const p = O.players.get(O.out.id);
      text = 'Waiting for ' + (p ? p.name : '') + '... ' + Math.ceil((O.out.until - now) / 1000);
    } else if (O.status && now < O.status.until) {
      text = O.status.text;
    }
    const tw = B.bm.width(text) + 6;
    g.setColor(0xFFFFFF);
    g.fillRect(2, 2, tw, B.bm.a + 4);
    B.bm.drawString(g, text, 5, 4, 20);

    if (O.inc) {
      const p = O.players.get(O.inc.id);
      const name = p ? p.name : '';
      const w = Math.min(B.r - 8, 120);
      const x = (B.r - w) >> 1, y = B.bm.a + 12;
      const h = 32 + 10 + B.bm.a * 2;
      O.panel(g, x, y, w, h, 'FIGHT!');
      if (p) g.drawImage(B.a8[35 + p.pilot], x + 6, y + B.bm.a + 8, 20);
      const lines = B.bm.wrap(name + ' wants to fight you!', w - 48);
      B.bm.drawLines(g, lines, x + 42, y + B.bm.a + 9, 20);
      // time left
      const left = Math.max(0, (O.inc.until - now) / O.INVITE_MS);
      g.setColor(0xFFFF00);
      g.fillRect(x + 4, y + h - 6, Math.round((w - 8) * left), 2);
      B.drawSoftKey(g, 'Accept', true);
      B.drawSoftKey(g, 'Decline', false);
      return;
    }
    if (O.out) B.drawSoftKey(g, 'Cancel', true);
    else if (O.target) B.drawSoftKey(g, (O.target.id === O.lastOpp ? 'Rematch ' : 'Fight ') + O.target.name, true);
    B.drawSoftKey(g, B.bk[1], false);
  },

  // Where the parts of the pilot screen go (also used for taps).
  pickLayout() {
    const W = B.r, H = B.s;
    const f = B.bm.a;
    const w = Math.min(W - 6, 150);
    const x = (W - w) >> 1;
    const swStep = Math.min(10, Math.floor((w - 12) / O.HUES.length));
    const swX = x + ((w - swStep * O.HUES.length) >> 1) + 1;
    // portrait, name, plane + pilot, colours, taunt
    const need = f + 5 + 34 + f + 2 + 30 + 10 + f * 2 + 6;
    const showTaunt = need <= H - f - 10;
    const h = showTaunt ? need : need - f * 2 - 2;
    const y = Math.max(2, ((H - f - 6 - h) >> 1));
    return { x, y, w, h, f, swStep, swX, swY: y + f + 5 + 34 + f + 2 + 30, showTaunt };
  },

  drawPick(g) {
    const L = O.pickLayout();
    const { x, y, w, f } = L;
    const cx = x + (w >> 1);
    O.panel(g, x, y, w, L.h, 'CHOOSE PILOT');
    let yy = y + f + 5;
    g.drawImage(B.a8[35 + O.pilot], cx, yy, 17);
    // arrows to the sides of the portrait
    g.setColor(6488245);
    for (let i = 0; i < 4; i++) {
      g.fillRect(cx - 28 + i, yy + 16 - i, 1, i * 2 + 1);
      g.fillRect(cx + 27 - i, yy + 16 - i, 1, i * 2 + 1);
    }
    yy += 34;
    B.bm.drawString(g, O.names[O.pilot], cx, yy, 17);
    yy += f + 2;
    // your plane and your little pilot, in your colour
    const s = O.skin(O.color);
    g.setColor(0xFFF2C0);
    g.fillRect(x + 6, yy, w - 12, 28);
    g.drawImage(s.planes[8], cx - 10, yy + 14, 3);
    g.drawImage(s.guy.r[(O.ticks >> 2) & 1], cx + 16, yy + 22, 3);
    yy += 30;
    // colours
    for (let c = 0; c < O.HUES.length; c++) {
      const sx = L.swX + c * L.swStep;
      if (c === O.color) {
        g.setColor(0x000000);
        g.fillRect(sx - 1, yy - 1, L.swStep, 8);
      }
      g.setColor(O.rgbOf(c));
      g.fillRect(sx, yy, L.swStep - 2, 6);
    }
    yy += 10;
    if (L.showTaunt) {
      const lines = B.bm.wrap('"' + B.bl[O.pilot * 4] + '"', w - 10);
      B.bm.drawLines(g, lines.slice(0, 2), cx, yy, 17);
    }
    B.drawSoftKey(g, B.bk[39], true);
    B.drawSoftKey(g, B.bk[1], false);
  },
};
