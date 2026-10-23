// Ports of class d (debris), class f (bullet) and class e (plane).
'use strict';

// ---------------------------------------------------------------- class d
// Debris particle. a,b = position (<<5), c,d = speed, e = frame, f = timer.
class D {
  constructor() { this.a = -1; this.b = 0; this.c = 0; this.d = 0; this.e = 0; this.f = 0; }

  // a(Graphics)
  update(graphics) {
    if (this.f > 0) {
      --this.f;
      if (this.f === 0) { this.a = -1; return; }
    }
    if ((this.f === 0 || this.f > 16) && this.f === 0) {
      const n2 = this.a >> 5;
      const n3 = this.b >> 5;
      graphics.drawImage(B.a8[this.e], n2, n3, 33);
      this.a += this.c;
      this.b += this.d;
      this.d += 25;
      if (this.d > 200) this.d = 200;
      let bl = false;
      if (n3 > 186) bl = true;
      else if (n3 > 166 && n2 > 111 && n2 < 143) bl = true;
      if (bl && this.d > 0) {
        this.d >>= 2;
        if (this.d < 5) this.a = -1;
        this.d = toByte(-this.d);
      }
      ++this.e;
      if (this.e > 56) this.e = 53;
    }
  }

  // a(int, int, int, int)
  init(n2, n3, n4, n5) {
    this.a = n2 << 5;
    this.b = n3 << 5;
    this.c = n4;
    this.d = n5;
    this.e = 53;
    this.f = 0;
  }
}

// ---------------------------------------------------------------- class f
// Bullet. a,b = position (b == 255: not in use), c = angle, d = age.
class F {
  constructor(e2) { this.a = 0; this.b = 255; this.c = 0; this.d = 0; this.e = e2; }

  // a(int, int, int): fire from (n2, n3) (<<6) at angle n4
  fire(n2, n3, n4) {
    this.a = n2 >> 6;
    this.b = n3 >> 6;
    this.c = n4;
    this.d = 0;
  }

  // a(boolean): remove; bl = it hit something
  kill(bl) {
    this.b = 255;
    this.e.recordShot(bl);
  }

  // a(Graphics, boolean)
  update(graphics, bl) {
    if (this.b === 255) return;
    if (bl) {
      ++this.d;
      if (this.d > 20) { this.kill(false); return; }
      this.a += (B.sin(this.c) * 10) >> 7;
      this.b -= (B.cos(this.c) * 10) >> 7;
    }
    if (this.b > 189 || (this.b > 168 && this.a > 109 && this.a < 145)) {
      this.e.r = this.a + 1;
      this.kill(false);
    }
    graphics.setColor(0xFF6600);
    graphics.fillRect(this.a, this.b, 3, 3);
    graphics.setColor(0xFFFF00);
    graphics.fillRect(this.a + 1, this.b + 1, 1, 1);
  }
}

// ---------------------------------------------------------------- class e
// Plane and pilot. Main fields (original names):
//   a  plane state: 0 on ground, 1 flying, 2 exploding, 3 dead
//   b,c position (<<6)    d,e position in pixels
//   f  direction frame 0-15     g speed     h angle (degrees)
//   i  side: 2 = faces left (red), 3 = faces right (blue)
//   j  turn delay   k fire delay   l respawn timer   m score
//   n  shots   o hits   p damage (smoke)   q smoke frame
//   r,s ground hit spark (x, frame)   t AI pilot steer
//   u  AI level   v pilot state: 0 in plane, 1 falling, 2 parachute,
//      3 dead, 4 walking, 5 falling with burst parachute
//   w,x pilot position (<<6)   y,z pilot speed   aa,ab,ac,ad pilot anim
//   ae portrait   af accuracy   ag..am AI parameters   an accuracy text
//   ao enemy   ap visible   aq local player   ar AI wants to eject
//   as accelerating   at no hit taken   au (unused)
//   av bullets   aw,ax,ay smoke puffs
class E {
  constructor(bl) {
    for (const k of ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','aa','ab','ac','ad','ae','af','ag','ah','ai','aj','ak','al','am']) this[k] = 0;
    this.an = '';
    this.ao = null;
    this.ar = this.as = this.at = this.au = false;
    this.av = [new F(this), new F(this)];
    this.aw = new Int32Array(6).fill(-1);
    this.ax = new Int32Array(6);
    this.ay = new Int32Array(6);
    this.ap = false;
    this.aq = bl;
  }

  // a(): fire
  fire() {
    if (this.k > 0 || this.v !== 0) return;
    if (this.a === 1) {
      let n2 = 2;
      while (--n2 >= 0) {
        if (this.av[n2].b !== 255) continue;
        this.av[n2].fire(this.b, this.c, this.h);
        this.k = 10;
        return;
      }
    }
  }

  // a(int): accuracy from the network
  setAccuracy(n2) {
    this.af = n2;
    this.an = n2 + '%';
  }

  // a(boolean): count one shot
  recordShot(bl) {
    ++this.n;
    if (bl) ++this.o;
    this.af = idiv(this.o * 100, this.n);
    this.an = this.af + '%';
  }

  // b(): eject, or open the parachute
  eject() {
    if (this.a === 2) return;
    if (this.a !== 1 || this.v !== 0) {
      if (this.v === 1) {
        this.z += -60;
        if (this.z < 20) this.z = 20;
        this.v = 2;
        this.ac = 1;
      }
      return;
    }
    B.playSound(5, 1);
    this.w = this.b;
    this.x = this.c;
    this.v = 1;
    const n2 = this.i === 2 ? B.normAngle(this.h + 90) : B.normAngle(this.h - 90);
    this.y = (B.sin(n2) * 300) >> 7;
    this.z = (-(B.cos(n2) * 300)) >> 7;
  }

  // a(int, int, int, int): new round
  init(n2, n3, n4, n5) {
    this.i = n5;
    if (n5 === 3) B.bw = this;
    else B.bx = this;
    this.m = 0;
    this.n = 0;
    this.o = 0;
    this.af = 0;
    this.an = '000%';
    B.updateScoreBox(this);
    this.at = true;
    let n6 = this.u * 7;
    this.ag = B.bs[n6++];
    this.ah = B.bs[n6++];
    this.ai = B.bs[n6++];
    this.aj = B.bs[n6++];
    this.ak = B.bs[n6++];
    this.al = B.bs[n6++];
    this.am = B.bs[n6++];
    this.reset(n2, n3, n4, n5);
    this.d = n3;
    this.e = n4;
  }

  // b(int, int, int, int): put the plane on the ground
  reset(n2, n3, n4, n5) {
    this.a = n2;
    this.b = n3 << 6;
    this.c = n4 << 6;
    this.g = 0;
    this.p = 0;
    this.r = 255;
    this.s = 0;
    switch (n2) {
      case 0:
        this.f = 1;
        this.h = n5 === 2 ? 270 : 90;
    }
    this.au = false;
    this.ap = true;
    this.ar = false;
    this.as = false;
    this.v = 0;
    for (let n6 = 5; n6 >= 0; n6--) this.aw[n6] = -1;
    for (let n7 = 1; n7 >= 0; n7--) this.av[n7].b = 255;
  }

  // b(int): turn (2 = left key, 3 = right key)
  turn(n2) {
    if (this.j > 0 || this.v !== 0) {
      switch (this.v) {
        case 2:
          if (n2 === 2) {
            this.y -= 10;
            if (this.y < -45) this.y = -45;
            this.ac = 0;
            break;
          }
          this.y += 10;
          if (this.y > 45) this.y = 45;
          this.ac = 2;
          break;
        case 4: {
          if (n2 === 2) {
            this.w -= 100;
            this.aa = this.aa === 2 ? 3 : 2;
          } else {
            this.w += 100;
            this.aa = this.aa === 4 ? 5 : 4;
          }
          const n3 = this.w >> 6;
          if (n3 <= 109 || n3 >= 145) break;
          B.respawn(this);
        }
      }
      return;
    }
    if (this.a === 0) return;
    if ((this.i === 2 && n2 === 2) || (this.i === 3 && n2 === 3)) {
      --this.f;
      if (this.f < 0) this.f = 15;
    } else {
      ++this.f;
      if (this.f === 16) this.f = 0;
    }
    this.h = this.i === 2 ? E.az[this.f] : E.az[this.f + 16];
    this.j = 2;
  }

  // c(): accelerate
  accelerate() {
    if (this.v !== 0) return;
    this.as = true;
    switch (this.a) {
      case 0:
        this.g += 16;
        if (this.f === 1 && this.g > 125) {
          this.c -= 128;
          this.f = 0;
        }
        if (this.g <= 250) break;
        this.c -= 64;
        this.g = 250;
        this.a = 1;
        this.as = false;
        break;
      case 1:
        if (this.g > 250) return;
        this.g += (Math.abs(B.sin(this.h)) * 8) >> 7;
        if (this.g <= 250) break;
        this.g = 250;
    }
  }

  // d(): slow down
  decelerate() {
    if (this.v !== 0) return;
    this.as = false;
    switch (this.a) {
      case 1:
        this.g -= 8;
        if (this.g >= 0) break;
        this.g = 0;
    }
  }

  // e(): computer pilot
  think() {
    switch (this.a) {
      case 0:
        this.accelerate();
        if (this.g < 250 || this.f >= 2) break;
        this.turn(3);
        break;
      case 1: {
        let n2;
        if (this.g < 250) this.accelerate();
        let bl = false;
        if ((this.e > 182 - this.ah || (this.d > 109 - this.ah && this.d < 145 + this.ah && this.e > 168 - this.ah)) && (this.am === 0 || B.rnd(this.am) === 0)) {
          if (this.f < 4) this.turn(3);
          else if (this.f > 4 && this.f < 12) this.turn(2);
          else if (this.f > 11) this.turn(3);
          bl = true;
        }
        if (this.e < this.al) {
          if (this.f < 5) this.turn(2);
          else if (this.f > 4 && this.f < 9) this.turn(3);
          bl = true;
        }
        if (!(bl || (this.ag !== 0 && B.rnd(this.ag) !== 0))) {
          const n3 = this.ao.v === 0 ? B.angleTo(this.b, this.c, this.ao.b, this.ao.c) : B.angleTo(this.b, this.c, this.ao.w, this.ao.x);
          n2 = B.turnDir(this.h, n3);
          if (n2 >= 2) this.turn(n2);
          else this.fire();
        }
        if (this.v === 0 && this.p === 2) {
          let n4 = 2;
          while (--n4 >= 0) {
            const f2 = this.ao.av[n4];
            if (f2.b === 255 || !this.ao.ap) continue;
            n2 = Math.abs(f2.a - this.d);
            const n5 = Math.abs(f2.b - this.e);
            const n6 = n2 * n2 + n5 * n5;
            if (n6 >= 80 + this.ai) continue;
            this.ar = true;
          }
        }
        if (!this.ar || (this.f <= 12 && this.f >= 4)) break;
        this.eject();
      }
    }
    switch (this.v) {
      case 4:
        if (this.w >> 6 < 127) { this.turn(3); break; }
        this.turn(2);
        break;
      case 1:
        if (B.rnd(this.aj) !== 0) break;
        this.eject();
        break;
      case 2:
        if (this.t >= 2) this.turn(this.t);
        if (B.rnd(this.ak) !== 0) break;
        this.t = B.rnd(4);
    }
  }

  // f(): the plane explodes
  explode() {
    B.playSound(3, 1);
    this.a = 2;
    this.f = 0;
    this.at = false;
    this.au = false;
    this.p = 0;
    const n2 = B.sin(this.h) >> 1;
    B.spawnDebris(25, this.d, this.e, n2 - 100, n2 + 100, -270, -50);
  }

  // a(Graphics, boolean): move (if bl) and draw
  update(graphics, bl) {
    let n2, n3, n4, n5;
    if (bl && !this.au) {
      if (this.as) this.accelerate();
      switch (this.a) {
        case 3:
          ++this.l;
          if (this.l <= 50) break;
          this.l = 0;
          if (this.v !== 0) break;
          B.respawn(this);
          break;
        case 0:
          if (this.i === 2) { this.b -= this.g; break; }
          this.b += this.g;
          break;
        case 1: {
          this.b += (B.sin(this.h) * this.g) >> 7;
          let n6 = 0;
          n5 = (B.cos(this.h) * this.g) >> 7;
          this.c -= n5;
          if (this.f > 1 && this.f < 7) {
            this.g -= B.cos(this.h) >> 5;
            if (this.g < 0) this.g = 0;
          } else if (this.f > 9 && this.f < 15) {
            this.g -= B.cos(this.h) >> 5;
            if (this.g > 350) this.g = 350;
          }
          if (this.g < 230) {
            n6 = idiv(250 * (230 - this.g), 230);
            this.c += n6;
          }
          if (n6 <= n5) break;
          this.as = false;
        }
      }
      switch (this.v) {
        case 1:
        case 5:
          this.w += this.y;
          this.x += this.z;
          this.z += 10;
          if (this.y > 8) this.y -= 8;
          else if (this.y < -8) this.y += 8;
          if (this.aa === 0) { this.aa = 1; break; }
          this.aa = 0;
          break;
        case 2:
          this.w += this.y;
          this.x += this.z;
          ++this.ad;
          if (this.ad > 1) {
            this.ad = 0;
            this.z += -15;
            if (this.z < 70) this.z = 70;
          }
          if (this.y > 8) this.y -= 8;
          else if (this.y < -8) this.y += 8;
          else this.ac = 1;
          ++this.ab;
          if (this.ab <= 3) break;
          this.ab = 0;
          if (this.aa === 0) { this.aa = 1; break; }
          this.aa = 0;
          break;
        case 3:
          this.x -= 30;
          if (this.aa !== 3) {
            ++this.ab;
            if (this.ab > 1) {
              this.ab = 0;
              ++this.aa;
              if (this.aa === 3) this.aa = 0;
            }
            ++this.ad;
            if (this.ad !== 40) break;
            this.ad = 0;
            this.aa = 3;
            break;
          }
          ++this.ad;
          if (this.ad <= 3) break;
          this.ad = 0;
          B.respawn(this);
      }
      if (this.j > 0) --this.j;
      if (this.k > 0) --this.k;
      this.d = this.b >> 6;
      this.e = this.c >> 6;
      n4 = this.w >> 6;
      n3 = this.x >> 6;
      if (this.a < 2 && (this.e > 182 || (this.e > 164 && this.d > 104 && this.d < 150))) {
        this.explode();
        B.bt = toByte(B.bt + 2);
        if (this.v === 0) {
          B.bt = toByte(B.bt + 1);
          --this.m;
          if (this.m < 0) this.m = 0;
          B.updateScoreBox(this);
        }
      }
      if ((this.v === 1 || this.v === 2 || this.v === 5) && n3 > 185) {
        this.x = 11840;
        if (this.z > 160) {
          B.bt = toByte(B.bt + 4);
          this.v = 3;
          --this.m;
          if (this.m < 0) this.m = 0;
          B.taunt(this.ao);
          B.updateScoreBox(this);
        } else {
          this.v = 4;
          if (n4 > 109 && n4 < 145) B.respawn(this);
        }
      }
      if (this.v !== 0 && this.j === 0) {
        if (this.f < 5 || this.f > 12) {
          --this.f;
          if (this.f === -1) this.f = 15;
        } else if (this.f > 4 && this.f < 12) {
          ++this.f;
        }
        this.h = this.i === 2 ? E.az[this.f] : E.az[this.f + 16];
        this.j = 5;
      }
      if (this.d < 0) {
        this.d = 255;
        this.b = this.d << 6;
      } else if (this.d > 255) {
        this.d = 0;
        this.b = this.d << 6;
      }
      if (n4 < 0) {
        n4 = 255;
        this.w = n4 << 6;
      } else if (n4 > 255) {
        n4 = 0;
        this.w = n4 << 6;
      }
      if (this.e < 0) {
        this.e = 0;
        this.c = this.e << 6;
        this.g -= 10;
      } else if (this.e > 208) {
        this.e = 0;
        this.c = this.e << 6;
      }
    }
    if (this.r !== 255) {
      graphics.drawImage(B.a8[30 + this.s], this.r, 189, 33);
      ++this.s;
      if (this.s === 5) {
        this.r = 255;
        this.s = 0;
      }
    }
    n5 = this.ao.b >> 6;
    n4 = this.ao.c >> 6;
    n3 = 0;
    const n7 = this.ao.w >> 6;
    const n8 = this.ao.x >> 6;
    // web: tags let the display layer move these sprites smoothly
    const idx = this === B.a6[0] ? 0 : 1;
    let n9 = 2;
    while (--n9 >= 0) {
      let n10;
      const f2 = this.av[n9];
      graphics.tag = 'b' + idx + n9;
      f2.update(graphics, bl);
      graphics.tag = null;
      if (((B.as !== 1 || !this.aq) && B.as !== 0) || f2.b === 255 || !this.ao.ap) continue;
      if (this.ao.a < 2 && (n2 = (n3 = Math.abs(f2.a - n5)) * n3 + (n10 = Math.abs(f2.b - n4)) * n10) < 80) {
        ++this.ao.p;
        this.ao.at = false;
        if (this.ao.p > 2) {
          this.ao.explode();
          if (this.ao.v === 0) {
            if (B.as === 0) {
              ++this.m;
              B.updateScoreBox(this);
            } else {
              B.bt = toByte(B.bt + 32);
            }
          }
        } else {
          B.playSound(2, 1);
        }
        f2.kill(true);
      }
      if (this.ao.v > 0 && this.ao.v !== 3 && (n2 = (n3 = Math.abs(f2.a - n7)) * n3 + (n10 = Math.abs(f2.b - n8)) * n10) < 30) {
        B.bt = toByte(B.bt + 8);
        this.ao.v = 3;
        this.ao.aa = 0;
        f2.kill(true);
        B.taunt(this);
        this.m += 2;
        B.updateScoreBox(this);
      }
      if (this.ao.v !== 2) continue;
      n10 = Math.abs(f2.b - (n8 - 10));
      if (n3 >= 10 || n10 >= 5) continue;
      this.ao.v = 5;
      B.bt = toByte(B.bt + 16);
    }
    graphics.tag = 'p' + idx;
    switch (this.a) {
      case 0:
      case 1:
        n2 = this.f;
        if (this.i === 3 && this.aq) n2 += 16;
        graphics.drawImage(B.a7[n2], this.d, this.e, 3);
        break;
      case 2:
        if (this.f < 7) {
          graphics.drawImage(B.a8[this.f + 2], this.d, this.e, 3);
          ++this.f;
          break;
        }
        this.a = 3;
        if (this.v !== 0) break;
        B.taunt(this.ao);
    }
    graphics.tag = 'pi' + idx;
    switch (this.v) {
      case 2:
        graphics.drawImage(B.a8[27 + this.ac], this.w >> 6, (this.x >> 6) - 10, 3);
      // fall through
      case 1:
      case 4:
      case 5:
        graphics.drawImage(B.a8[21 + this.aa], this.w >> 6, this.x >> 6, 3);
        break;
      case 3:
        graphics.drawImage(B.a8[17 + this.aa], this.w >> 6, this.x >> 6, 3);
    }
    graphics.tag = null;
    if (this.a < 2 && this.p > 0) {
      if (this.p === 2) {
        graphics.tag = 'ps' + idx;
        graphics.drawImage(B.a8[14 + this.q], this.d, this.e, 3);
        graphics.tag = null;
        ++this.q;
        if (this.q > 2) this.q = 0;
      }
      let n11 = 6;
      while (--n11 >= 0) {
        if (this.aw[n11] === -1) {
          if (B.rnd(12) >= this.p * 2) continue;
          this.aw[n11] = this.b >> 6;
          this.ax[n11] = this.c >> 6;
          this.ay[n11] = 0;
          return;
        }
        graphics.drawImage(B.a8[this.ay[n11] + 9], this.aw[n11], this.ax[n11], 3);
        this.ay[n11] = this.ay[n11] + 1;
        if (this.ay[n11] <= 4) continue;
        this.aw[n11] = -1;
      }
    }
  }
}

// static e.az: angle of each of the 16 direction frames, for both sides
E.az = new Int32Array(32);
E.a0 = 22;
(function () {
  const az = E.az;
  let n2 = 16;
  while (--n2 >= 0) {
    let n3 = n2 - 12;
    if (n3 < 0) n3 = 16 + n3;
    az[n3] = idiv(360 * n2, 16);
  }
  const m = [8, 7, 6, 5, 4, 3, 2, 1, 0, 15, 14, 13, 12, 11, 10, 9];
  for (let k = 0; k < 16; k++) az[16 + k] = az[m[k]];
})();
