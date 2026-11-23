// Şehri canlı gösteren, kodla çizilen hareketler: arabalar, yürüyen insanlar, ağaçlar,
// duman, su parıltısı ve kira toplanınca saçılan paralar. Oyun kurallarını etkilemez.
// Hepsi gerçek zamanla akar (oyun hız ayarından etkilenmez).
import { CONFIG, BUILDINGS, TERRAIN } from './data.js';
import * as G from './game.js';

const CAR_COLORS = ['#e5534b', '#2f7de1', '#f2b134', '#ffffff', '#3a3f4b', '#2fbf71', '#a259d9'];
const CLOTHES = ['#e5534b', '#2f7de1', '#f2b134', '#2fbf71', '#a259d9', '#ff8fb1', '#3a3f4b'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAX_PARTICLES = 220;

// Aynı karede hep aynı sonucu veren basit karıştırıcı (ağaçların yeri için)
function hash(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function createAmbient(R) {
  const { ctx } = R;
  const cars = [];
  const people = [];
  const particles = [];
  let version = -1;
  let roads = [];
  let emitClock = 0;
  let enabled = true;

  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  const isRoad = (s, x, y) => G.inBounds(x, y) && G.isRoadConnected(s, x, y);
  const onEdge = (x, y) => x === 0 || y === 0 || x === CONFIG.gridSize - 1 || y === CONFIG.gridSize - 1;

  // Kare içindeki kesirli bir noktanın ekran konumu; h: yerden yükseklik (piksel, yakınlaştırma 1'de)
  function scr(fx, fy, h = 0) {
    const [sx, sy] = R.toScreen(fx, fy);
    return [sx, sy - h * R.cam.z];
  }

  // ---------- Yollardaki hareketliler ----------

  function spawnWalker(s, list, extra) {
    if (!roads.length) return;
    const [x, y] = rnd(roads);
    const next = DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => isRoad(s, nx, ny));
    const [nx, ny] = next.length ? rnd(next) : [x, y];
    list.push({ x, y, nx, ny, p: Math.random(), ...extra });
  }

  function sync(s) {
    if (version === s.version) return;
    version = s.version;
    roads = [];
    for (let y = 0; y < CONFIG.gridSize; y++) {
      for (let x = 0; x < CONFIG.gridSize; x++) if (isRoad(s, x, y)) roads.push([x, y]);
    }
    // artık yol olmayan yerdeki hareketlileri kaldır
    for (const list of [cars, people]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i];
        if (!isRoad(s, a.x, a.y) || !isRoad(s, a.nx, a.ny)) list.splice(i, 1);
      }
    }
  }

  function targetCounts(s) {
    const playerRoads = roads.length - CONFIG.gridSize;
    const rented = Object.values(s.buildings).filter(b => G.isHouse(b) && b.contract).length;
    const shops = Object.values(s.buildings).filter(b => G.hasIncome(b) && G.isConnected(s, b)).length;
    return {
      cars: Math.min(14, 3 + Math.floor(playerRoads / 5) + Math.floor(shops / 2)),
      people: Math.min(18, 2 + rented * 2 + shops),
    };
  }

  function step(s, a, dist, isCar) {
    a.p += dist;
    while (a.p >= 1) {
      a.p -= 1;
      const px = a.x, py = a.y;
      a.x = a.nx; a.y = a.ny;
      let opts = DIRS.map(([dx, dy]) => [a.x + dx, a.y + dy])
        .filter(([nx, ny]) => isRoad(s, nx, ny) && !(nx === px && ny === py));
      if (!opts.length) {
        if (isCar && onEdge(a.x, a.y)) {
          // haritanın kenarından çıkan araba başka bir kenardan girer
          const edges = roads.filter(([x, y]) => onEdge(x, y));
          const [ex, ey] = rnd(edges.length ? edges : roads);
          a.x = ex; a.y = ey;
          opts = DIRS.map(([dx, dy]) => [ex + dx, ey + dy]).filter(([nx, ny]) => isRoad(s, nx, ny));
          if (!opts.length) opts = [[ex, ey]];
        } else {
          opts = [[px, py]]; // çıkmaz: geri dön
        }
      }
      // insanlar arada bir geri döner
      if (!isCar && Math.random() < 0.12 && isRoad(s, px, py)) opts = [[px, py]];
      [a.nx, a.ny] = rnd(opts);
    }
  }

  function pose(a, lane) {
    const fx = a.x + (a.nx - a.x) * a.p + 0.5;
    const fy = a.y + (a.ny - a.y) * a.p + 0.5;
    let dx = a.nx - a.x, dy = a.ny - a.y;
    if (!dx && !dy) dx = 1;
    // sağ şerit: gidiş yönüne dik kaydır
    return { fx: fx - dy * lane, fy: fy + dx * lane, dx, dy };
  }

  function drawCar(a) {
    const { fx, fy, dx, dy } = pose(a, 0.17);
    const L = 0.17, W = 0.09, H = 5;
    const px = -dy, py = dx;
    const corners = [
      [fx + dx * L + px * W, fy + dy * L + py * W],
      [fx + dx * L - px * W, fy + dy * L - py * W],
      [fx - dx * L - px * W, fy - dy * L - py * W],
      [fx - dx * L + px * W, fy - dy * L + py * W],
    ];
    const g = corners.map(([x, y]) => scr(x, y, 0));
    const t = corners.map(([x, y]) => scr(x, y, H));
    R.poly(corners.map(([x, y]) => scr(x + 0.03, y + 0.03, 0)), 'rgba(20,30,20,0.25)');
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      R.poly([g[i], g[j], t[j], t[i]], shade(a.color, -0.28));
    }
    R.poly(t, a.color);
    // ön cam
    const wf = [0.55, 0.15].map(k => [fx + dx * L * k, fy + dy * L * k]);
    const wpts = [
      scr(wf[0][0] + px * W * 0.8, wf[0][1] + py * W * 0.8, H + 0.1),
      scr(wf[0][0] - px * W * 0.8, wf[0][1] - py * W * 0.8, H + 0.1),
      scr(wf[1][0] - px * W * 0.8, wf[1][1] - py * W * 0.8, H + 0.1),
      scr(wf[1][0] + px * W * 0.8, wf[1][1] + py * W * 0.8, H + 0.1),
    ];
    R.poly(wpts, 'rgba(40,70,100,0.75)');
  }

  function drawPerson(a, t) {
    const { fx, fy } = pose(a, 0.4);
    const [x, y] = scr(fx, fy, 0);
    const z = Math.max(0.7, R.cam.z);
    const bob = Math.abs(Math.sin(t / 140 + a.phase)) * 1.2 * z;
    ctx.fillStyle = 'rgba(20,30,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.4 * z, 1.2 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = a.color;
    ctx.fillRect(x - 1.6 * z, y - 7 * z - bob, 3.2 * z, 5 * z);
    ctx.fillStyle = '#f1c9a5';
    ctx.beginPath();
    ctx.arc(x, y - 8.6 * z - bob, 1.7 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- Parçacıklar: duman, parıltı, para ----------

  function emit(p) {
    if (particles.length < MAX_PARTICLES) particles.push(p);
  }

  function emitters(s, dt) {
    emitClock += dt;
    // denizde parıltı
    if (emitClock % 0.2 < dt && Math.random() < 0.8) {
      const x = Math.floor(Math.random() * CONFIG.gridSize), y = Math.floor(Math.random() * CONFIG.gridSize);
      if (G.terrainAt(x, y) === 'deniz') {
        emit({ kind: 'spark', fx: x + Math.random(), fy: y + Math.random(), h: 0, vx: 0, vy: 0, vh: 0, life: 0, max: 0.8 });
      }
    }
    const smokeTick = emitClock % 0.35 < dt;
    const sparkTick = emitClock % 0.25 < dt;
    for (const b of Object.values(s.buildings)) {
      const d = BUILDINGS[b.type];
      const n = G.sizeOf(b.type);
      if (d.smoke && smokeTick && G.isConnected(s, b)) {
        for (const sm of [].concat(d.smoke)) {
          emit({
            kind: 'smoke', fx: b.x + n / 2 + sm.x, fy: b.y + n / 2 + sm.y, h: sm.h ?? (d.height || 0) + 14,
            vx: 0.05, vy: -0.04, vh: 11, life: 0, max: 3.2, r: 2.5 + Math.random(),
          });
        }
      }
      if (d.sparkle && sparkTick && Math.random() < 0.7) {
        const sp = d.sparkle.spread;
        emit({
          kind: 'spark', fx: b.x + n / 2 + (d.sparkle.x || 0) + (Math.random() - 0.5) * sp * 2, fy: b.y + n / 2 + (d.sparkle.y || 0) + (Math.random() - 0.5) * sp * 2,
          h: d.sparkle.h + Math.random() * 3, vx: 0, vy: 0, vh: 0, life: 0, max: 0.7,
        });
      }
    }
  }

  function burst(x, y, amount) {
    if (!enabled) return;
    const n = Math.min(14, 4 + Math.floor(amount / 60));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.4 + Math.random() * 0.6;
      emit({
        kind: 'coin', fx: x + 0.5, fy: y + 0.5, h: 18 + Math.random() * 6,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: 70 + Math.random() * 50,
        life: 0, max: 1.1 + Math.random() * 0.3, spin: Math.random() * 6,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.fx += p.vx * dt;
      p.fy += p.vy * dt;
      p.h += p.vh * dt;
      if (p.kind === 'coin') {
        p.vh -= 260 * dt;
        if (p.h < 0) { p.h = 0; p.vh *= -0.35; p.vx *= 0.5; p.vy *= 0.5; }
      }
      if (p.kind === 'smoke') { p.r += 3.2 * dt; p.vh *= 0.995; }
    }
  }

  function drawParticle(p, t) {
    const z = R.cam.z;
    const k = p.life / p.max;
    const [x, y] = scr(p.fx, p.fy, p.h);
    if (p.kind === 'smoke') {
      ctx.globalAlpha = 0.45 * (1 - k) * Math.min(1, p.life * 4);
      ctx.fillStyle = '#e9ecef';
      ctx.beginPath(); ctx.arc(x, y, p.r * z, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'spark') {
      const s = Math.sin(k * Math.PI) * 3.2 * z;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.25, y - s * 0.25); ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * 0.25, y + s * 0.25); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.25, y + s * 0.25);
      ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.25, y - s * 0.25); ctx.closePath(); ctx.fill();
    } else if (p.kind === 'coin') {
      const w = Math.abs(Math.cos(t / 90 + p.spin)) * 3.4 * z + 0.6;
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.fillStyle = '#c98a00';
      ctx.beginPath(); ctx.ellipse(x, y, w, 3.6 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.ellipse(x - 0.4 * z, y - 0.4 * z, Math.max(0.3, w - 0.9 * z), 2.8 * z, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Dışa açılanlar ----------

  let lastT = 0;
  function update(s, t) {
    const dt = Math.min(0.1, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    if (!enabled) { cars.length = 0; people.length = 0; particles.length = 0; return; }
    sync(s);
    const want = targetCounts(s);
    while (cars.length < want.cars && roads.length) spawnWalker(s, cars, { color: rnd(CAR_COLORS), speed: 0.9 + Math.random() * 0.6 });
    while (people.length < want.people && roads.length) spawnWalker(s, people, { color: rnd(CLOTHES), speed: 0.22 + Math.random() * 0.12, phase: Math.random() * 6 });
    cars.length = Math.min(cars.length, want.cars);
    people.length = Math.min(people.length, want.people);
    for (const c of cars) step(s, c, c.speed * dt, true);
    for (const p of people) step(s, p, p.speed * dt, false);
    emitters(s, dt);
    updateParticles(dt);
  }

  function drawables(s, t) {
    if (!enabled) return [];
    const out = [];
    for (const c of cars) {
      const { fx, fy } = pose(c, 0.17);
      out.push({ key: fx + fy, kx: fx, draw: () => drawCar(c) });
    }
    for (const p of people) {
      const { fx, fy } = pose(p, 0.4);
      out.push({ key: fx + fy, kx: fx, draw: () => drawPerson(p, t) });
    }
    return out;
  }

  function drawOverlay(t) {
    for (const p of particles) drawParticle(p, t);
  }

  // mahalle değişince arabaları, insanları ve parçacıkları temizle
  function reset() {
    cars.length = 0; people.length = 0; particles.length = 0; version = -1;
  }

  return {
    update, drawables, drawOverlay, burst, reset,
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    get counts() { return { cars: cars.length, people: people.length, particles: particles.length }; },
  };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
