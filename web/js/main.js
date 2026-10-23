// Start-up: the part of the MIDlet (class BluetoothBiplanes) and of the phone.
// It loads the JAR resources, makes the screen, turns keyboard and touch
// input into the phone key codes that the game reads, and runs the game
// thread loop.
'use strict';

const RES_FILES = ['r', 'f', 'fzr', 'fzb', 'tg', 'tt', 'tm'];
const AD_FILES = ['ad0.png', 'ad1.png', 'ad2.png'];

// Phone key codes
const K_UP = -1, K_DOWN = -2, K_LEFT = -3, K_RIGHT = -4, K_FIRE = -5, K_SOFT_L = -6, K_SOFT_R = -7, K_STAR = 42;

// KeyboardEvent.code -> phone key code (by key position, so WASD works on
// all keyboard layouts)
const KEYMAP = {
  KeyW: K_UP, ArrowUp: K_UP,
  KeyS: K_DOWN, ArrowDown: K_DOWN,
  KeyA: K_LEFT, ArrowLeft: K_LEFT,
  KeyD: K_RIGHT, ArrowRight: K_RIGHT,
  Space: K_FIRE,
  Enter: K_SOFT_L, NumpadEnter: K_SOFT_L,
  KeyE: K_STAR, KeyX: K_STAR,
  Escape: K_SOFT_R, Backspace: K_SOFT_R, KeyP: K_SOFT_R,
};
for (let d = 0; d <= 9; d++) KEYMAP['Digit' + d] = 48 + d;

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || params.has('touch');
if (isTouch) document.body.classList.add('touch');

// Layout: the game uses the whole window, inside the safe areas. On touch
// screens the controls show over the game only while flying (body.playing),
// so they never cover the menus or the soft key labels. --panel is the height
// of the control area at the bottom in portrait.
R.insets = (vw, vh) => {
  if (!isTouch) return { l: 0, t: 0, r: 0, b: 0 };
  const safe = getComputedStyle(document.getElementById('safe'));
  const portrait = vh > vw;
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('landscape', !portrait);
  if (portrait) document.body.style.setProperty('--panel', Math.round(Math.max(200, vh * 0.28)) + 'px');
  return {
    l: parseFloat(safe.paddingLeft) || 0, t: parseFloat(safe.paddingTop) || 0,
    r: parseFloat(safe.paddingRight) || 0, b: parseFloat(safe.paddingBottom) || 0,
  };
};

async function fetchBytes(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('cannot load ' + path);
  return new Uint8Array(await res.arrayBuffer());
}

async function boot() {
  R.init(document.getElementById('screen'), document.getElementById('backdrop'));

  const [files, ads, wav] = await Promise.all([
    Promise.all(RES_FILES.map((n) => fetchBytes('res/' + n))),
    Promise.all(AD_FILES.map((n) => fetchBytes('res/' + n).then((b) => MImage.fromBytes(b)))),
    fetchBytes('res/music.wav'),
  ]);
  RES_FILES.forEach((n, i) => { Res.files[n] = files[i]; });
  AD_FILES.forEach((n, i) => { MImage.resources['/' + n] = ads[i]; });

  // new BluetoothBiplanes() -> new b(this)
  await B.init(R.g, R.W, R.H);
  R.buildLayers();

  // Browsers only allow sound after a key press or a tap.
  const overlay = document.getElementById('start');
  overlay.textContent = isTouch ? 'Tap to start' : 'Press any key to start';
  overlay.classList.add('ready');
  const go = async (ev) => {
    if (ev) ev.preventDefault();
    window.removeEventListener('keydown', go, true);
    window.removeEventListener('pointerdown', go, true);
    overlay.remove();
    // Phones go full screen on the first tap (it must be in the tap handler).
    if (isTouch) enterFullscreen();
    await H.unlock(wav);
    startApp();
  };
  window.addEventListener('keydown', go, true);
  window.addEventListener('pointerdown', go, true);
}

// startApp(): show the canvas and start the thread
function startApp() {
  B.onExit = () => {
    const g = B.screen;
    g.reset();
    g.setColor(0);
    g.fillRect(0, 0, B.r, B.s);
    document.getElementById('closed').hidden = false;
  };
  installInput();
  // Display.setCurrent(canvas) calls showNotify() before the first paint.
  B.showNotify();
  B.paintNow();
  runThread();
}

// run(): keep each pass at B.x ms, as the original thread does.
async function runThread() {
  B.c = false;
  B.ah = 0;
  while (!B.c) {
    const l2 = Date.now() - B.ah;
    const l3 = B.x - l2;
    await sleep(l3 > B.y ? l3 : 0);
    let goOn = true;
    try {
      goOn = B.tick();
    } catch (exception) {
      console.error(exception);
    }
    if (B.pending) B.paintNow();
    updateControls();
    if (!goOn) break;
  }
}

// The soft key labels of the last paint (left = Select / Next / Help,
// right = Back / Close). The menu buttons show the same labels.
let softLabels = { l: null, r: null };
let paintLabels = softLabels;
const gamePaint = B.paint, gameSoftKey = B.drawSoftKey;
B.paint = function (graphics) {
  paintLabels = { l: null, r: null };
  try { return gamePaint.call(B, graphics); } finally { softLabels = paintLabels; }
};
B.drawSoftKey = function (graphics, string, left) {
  if (left) paintLabels.l = string; else paintLabels.r = string;
  return gameSoftKey.call(B, graphics, string, left);
};

// The touch gamepad (FIRE, EJECT, pause) shows only while a pilot flies (no
// menu, no message). At other times the OK and Back buttons show instead.
let playing = false;
let shownLabels = '';
function updateControls() {
  const now = B.a === 1 && B.cy < 0;
  if (now !== playing) {
    playing = now;
    document.body.classList.toggle('playing', now);
    // Let go of the buttons that hide (and of the stick when the flight ends).
    for (const [code, set] of held) {
      for (const src of [...set]) if (src.startsWith('b:') || (src === 'stick' && !now)) release(src, code);
    }
    for (const b of document.querySelectorAll('#touch .down')) b.classList.remove('down');
  }
  if (now || !isTouch) return;
  const { l, r } = softLabels;
  const key = l + '|' + r;
  if (key === shownLabels) return;
  shownLabels = key;
  // OK is the left soft key. With no labels at all (score board) it is FIRE,
  // which goes on there.
  const ok = document.getElementById('ok'), back = document.getElementById('back');
  ok.textContent = l || 'OK';
  ok.dataset.key = l ? K_SOFT_L : K_FIRE;
  ok.classList.toggle('off', !l && r != null);
  back.textContent = r || 'Back';
  back.classList.toggle('off', r == null);
}

// ---------------------------------------------------------------- input
// Each source (a key, a touch button, the stick) holds the phone keys it
// presses, so two sources on the same phone key do not release each other.
const held = new Map();
function press(src, code) {
  const set = held.get(code) || new Set();
  if (set.size === 0) B.keyPressed(code);
  set.add(src);
  held.set(code, set);
}
function release(src, code) {
  const set = held.get(code);
  if (!set || !set.has(src)) return;
  set.delete(src);
  if (set.size === 0) B.keyReleased(code);
}
function releaseAll() {
  for (const [code, set] of held) if (set.size) { set.clear(); B.keyReleased(code); }
}

function installInput() {
  window.addEventListener('keydown', (ev) => {
    const code = KEYMAP[ev.code];
    if (code === undefined || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    ev.preventDefault();
    if (ev.repeat) return;
    press('k:' + ev.code, code);
  });
  window.addEventListener('keyup', (ev) => {
    const code = KEYMAP[ev.code];
    if (code === undefined) return;
    ev.preventDefault();
    release('k:' + ev.code, code);
  });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') B.showNotify();
    else releaseAll();
  });

  // Touch and mouse on the game screen (the original has only keys):
  // - the soft key labels in the bottom corners press those keys;
  // - in a menu, a tap on an item chooses it (the mouse also highlights it);
  // - a tap on a message, a help page, a result page or the score board goes on.
  const canvas = document.getElementById('screen');
  const toGame = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return [(ev.clientX - rect.left) * R.W / rect.width, (ev.clientY - rect.top) * R.H / rect.height];
  };
  canvas.addEventListener('pointerdown', (ev) => {
    if (!B.a6) return;
    const [x, y] = toGame(ev);
    let code = null;
    if (B.cy >= 0) {
      code = K_SOFT_R;                                   // message: Next / Close
    } else if (y >= R.H - 22 && !(isTouch && playing)) {
      code = x < R.W / 2 ? K_SOFT_L : K_SOFT_R;          // soft key labels
    } else if (B.a === 2) {
      const row = menuRowAt(x, y);
      if (row >= 0) { G.c = row; G.h = 2; code = K_FIRE; }
    } else if (B.a === 5) {
      code = K_FIRE;                                     // score board: any key
    } else if (B.a >= 8 && B.a <= 10) {
      code = K_SOFT_R;                                   // result pages: Close
    } else if (B.a === 12) {
      code = K_SOFT_L;                                   // help pages: Next
    }
    if (code === null) return;
    ev.preventDefault();
    press('c', code);
    const up = () => { release('c', code); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || !B.a6) return;
    const [x, y] = toGame(ev);
    const row = B.a === 2 && B.cy < 0 ? menuRowAt(x, y) : -1;
    canvas.style.cursor = row >= 0 || y >= R.H - 22 ? 'pointer' : '';
    if (row >= 0 && row !== G.c) { G.c = row; G.h = 2; }
  });

  // Touch buttons
  for (const btn of document.querySelectorAll('#touch [data-key]')) {
    // The menu OK button changes its key, so read it on each press.
    let code = 0;
    const src = 'b:' + btn.id;
    const up = (ev) => { ev.preventDefault(); btn.classList.remove('down'); release(src, code); };
    btn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
      btn.classList.add('down');
      code = parseInt(btn.dataset.key, 10);
      press(src, code);
    });
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  installStick();
  installFullscreenButton();
}

// Which menu item is at game position (x, y), or -1. Same layout as
// G.draw() (menu.js), as the game calls it from paint() in state 2.
function menuRowAt(x, y) {
  if (B.a !== 2 || B.cy >= 0 || G.b === 0) return -1;
  const f = B.bm;
  const rowH = G.a === 14 || G.a === 60 || G.a === 92 || G.a === 82 ? 16 : f.a + 4;
  let w = G.d != null ? f.width(G.d) : 0;
  for (let i = 0; i < G.b; i++) w = Math.max(w, f.width(G.g[G.e[i]]));
  const rows = G.b + (G.d != null ? 1 : 0);
  const boxW = Math.max(w + 8, B.r);
  const boxX = (B.r - boxW) >> 1;
  const boxY = (B.s - rows * rowH) >> 1;
  const top = boxY + 4 + (G.d != null ? rowH - (rowH >> 1) : 0);
  if (x < boxX || x >= boxX + boxW || y < top) return -1;
  const i = Math.floor((y - top) / rowH);
  return i < G.b ? i : -1;
}

// Touch joystick (nipplejs). It appears where the thumb touches the left
// half of the screen; its direction holds the up / down / left / right keys.
function installStick() {
  const zone = document.getElementById('stickzone');
  const hint = document.getElementById('stickhint');
  let dirs = new Set();
  const setDirs = (next) => {
    for (const c of dirs) if (!next.has(c)) release('stick', c);
    for (const c of next) if (!dirs.has(c)) press('stick', c);
    dirs = next;
  };
  const manager = nipplejs.create({
    zone,
    mode: 'dynamic',
    size: 120,
    threshold: 0.1,
    color: { front: 'rgba(255,255,255,0.55)', back: 'rgba(255,255,255,0.18)' },
    multitouch: false,
  });
  manager.on('start', () => hint.classList.add('hide'));
  manager.on('move', (evt) => {
    const data = evt.data;
    const next = new Set();
    if (data.force > 0.3) {
      // 8 directions: a key is held when the stick points within 67.5
      // degrees of its direction (angle 90 = up).
      const nx = Math.cos(data.angle.radian), ny = Math.sin(data.angle.radian);
      if (ny > 0.38) next.add(K_UP);
      if (ny < -0.38) next.add(K_DOWN);
      if (nx < -0.38) next.add(K_LEFT);
      if (nx > 0.38) next.add(K_RIGHT);
    }
    setDirs(next);
  });
  manager.on('end', () => {
    setDirs(new Set());
    hint.classList.remove('hide');
  });
}

// ---------------------------------------------------------------- full screen
const fsElement = document.documentElement;
const canFullscreen = !!(fsElement.requestFullscreen || fsElement.webkitRequestFullscreen);
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

function enterFullscreen() {
  try {
    const req = fsElement.requestFullscreen || fsElement.webkitRequestFullscreen;
    const p = req && req.call(fsElement, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
function toggleFullscreen() {
  if (!isFullscreen()) { enterFullscreen(); return; }
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}

function installFullscreenButton() {
  if (!canFullscreen) return;
  document.body.classList.add('can-fs');
  const btn = document.getElementById('fs');
  btn.hidden = false;
  btn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); toggleFullscreen(); });
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyF' && !ev.repeat && !ev.metaKey && !ev.ctrlKey) toggleFullscreen();
  });
  const sync = () => { btn.textContent = isFullscreen() ? '✕' : '⛶'; };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}


document.getElementById('closed').addEventListener('click', () => location.reload());

// Stop the browser's own touch and zoom actions. iOS Safari ignores
// user-scalable=no, so pinch zoom, double-tap zoom, text selection and the
// long-press menu are stopped here.
(function blockBrowserGestures() {
  const stop = (ev) => { if (ev.cancelable) ev.preventDefault(); };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'selectstart', 'contextmenu', 'dragstart', 'dblclick']) {
    document.addEventListener(type, stop, { passive: false });
  }
  // Pinch (two fingers) and double tap
  document.addEventListener('touchstart', (ev) => { if (ev.touches.length > 1) stop(ev); }, { passive: false });
  document.addEventListener('touchmove', stop, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (ev) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350) stop(ev);
    lastTouchEnd = now;
  }, { passive: false });
  // Desktop: ctrl + wheel (also trackpad pinch) and ctrl + / - / 0
  window.addEventListener('wheel', (ev) => { if (ev.ctrlKey) stop(ev); }, { passive: false });
  window.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(ev.code)) stop(ev);
  });
})();
// The key help on desktop fades out after a while.
setTimeout(() => document.getElementById('hint').classList.add('gone'), 12000);
boot().catch((err) => {
  console.error(err);
  document.getElementById('start').textContent = 'Error: ' + err.message;
});
