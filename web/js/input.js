// Port of class i: key state and a 20-slot ring buffer of key events.
// Action codes: 0-9 digits, 10 up, 11 down, 12 left, 13 right, 14 fire,
// 15 left soft key, 16 right soft key, 17 '*', 18 '#', 19-21 text editing.
'use strict';

const I = {
  a: false,
  b: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, -10, -11, -13, -12, -20, -21, -1, -2, -3, -4, -6, -7, -5, 42, 35],
  c: [[0], [1], [2, 10], [3], [4, 12], [5, 14], [6, 13], [7], [8, 11], [9], [10, 20], [11, 21], [12, 19], [13], [15], [16], [10, 20], [11, 21], [12, 19], [13], [15], [16], [14], [17], [18, 14]],
  d: new Array(22).fill(false),
  e: 0,
  f: 0,
  g: new Int32Array(20),

  _map(n2) {
    for (let n3 = 0; n3 < I.b.length; n3++) if (n2 === I.b[n3]) return I.c[n3];
    return null;
  },

  // a(int): keyPressed
  pressed(n2) {
    const nArray = I._map(n2);
    if (nArray != null) {
      for (const n4 of nArray) {
        I._push(n4);
        I.d[n4] = true;
      }
    }
    I.a = true;
  },

  _push(n2) {
    I.g[I.f++] = n2;
    if (I.f >= 20) I.f = 0;
    if (I.f === I.e && ++I.e >= 20) I.e = 0;
  },

  // b(int): keyReleased
  released(n2) {
    I.a = false;
    const nArray = I._map(n2);
    if (nArray == null) return;
    for (const n4 of nArray) if (I.d[n4]) I.d[n4] = false;
  },

  // c(int): is the action held
  held(n2) { return I.d[n2]; },

  // a(): next queued action, or -66
  next() {
    if (I.e === I.f) return -66;
    const n2 = I.g[I.e++];
    if (I.e >= 20) I.e = 0;
    return n2;
  },

  // b(): release all
  clear() {
    for (let n2 = 21; n2 >= 0; n2--) I.d[n2] = false;
    I.a = false;
  },
};
