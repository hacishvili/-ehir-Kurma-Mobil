// Ses efektleri ve arka plan müziği. Dosya kullanmaz: sesleri tarayıcının ses motoru (Web Audio) üretir.
// Tarayıcılar sesi ancak oyuncu ekrana dokunduktan sonra açar; unlock() ilk dokunuşta çağrılır.

let ctx = null;
let master = null, sfxBus = null, musicBus = null;
let sfxOn = true, musicOn = true;
let musicTimer = 0;
let nextBeat = 0, beat = 0;

const NOTE = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI numarası → Hz

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
  } catch (e) {
    return false;
  }
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxOn ? 0.55 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  // müziği yumuşatan filtre
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  musicBus.connect(lp);
  lp.connect(master);
  return true;
}

// İlk dokunuşta çağrılır
export function unlock() {
  if (!init()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (musicOn) startMusic();
}

export function setSfx(on) {
  sfxOn = on;
  if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0;
}

export function setMusic(on) {
  musicOn = on;
  if (!ctx) return;
  if (on) startMusic();
  else stopMusic();
}

export function settings() {
  return { sfx: sfxOn, music: musicOn };
}

// Sekme arka plana geçince sustur, dönünce devam
export function pause(paused) {
  if (!ctx) return;
  if (paused) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
}

// ---------- Efekt yapı taşları ----------

function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.005, bus = sfxBus, slideTo = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(bus);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start, dur, { vol = 0.2, freq = 800 } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(start);
}

// ---------- Efektler ----------

const SFX = {
  // para: iki parlak nota
  coin(t) {
    tone(NOTE(88), t, 0.12, { type: 'square', vol: 0.12 });
    tone(NOTE(93), t + 0.07, 0.22, { type: 'square', vol: 0.12 });
    tone(NOTE(100), t + 0.07, 0.2, { type: 'sine', vol: 0.08 });
  },
  // inşaat: tok bir vuruş ve tıkırtı
  build(t) {
    tone(140, t, 0.18, { type: 'sine', vol: 0.45, slideTo: 60 });
    noise(t, 0.08, { vol: 0.25, freq: 1800 });
    noise(t + 0.09, 0.06, { vol: 0.15, freq: 2600 });
  },
  // kontrat: yükselen kısa bip
  sign(t) {
    tone(NOTE(76), t, 0.08, { type: 'triangle', vol: 0.2 });
    tone(NOTE(83), t + 0.06, 0.14, { type: 'triangle', vol: 0.2 });
  },
  // seviye: küçük bir zafer arpeji
  levelUp(t) {
    [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), t + i * 0.09, 0.3, { type: 'triangle', vol: 0.22 }));
    tone(NOTE(88), t + 0.36, 0.6, { type: 'sine', vol: 0.18 });
  },
  // hikaye / ödül: çan
  chime(t) {
    [84, 91, 96].forEach((n, i) => tone(NOTE(n), t + i * 0.06, 0.9, { type: 'sine', vol: 0.14 }));
  },
  // haber
  news(t) {
    tone(NOTE(79), t, 0.1, { type: 'square', vol: 0.08 });
    tone(NOTE(79), t + 0.12, 0.1, { type: 'square', vol: 0.08 });
  },
  // hata: alçak vızıltı
  error(t) {
    tone(150, t, 0.16, { type: 'sawtooth', vol: 0.08, slideTo: 110 });
  },
  // dokunma: minik tık
  tap(t) {
    tone(NOTE(96), t, 0.03, { type: 'sine', vol: 0.06 });
  },
};

const last = {};
export function play(name) {
  if (!ctx || !sfxOn || ctx.state !== 'running' || !SFX[name]) return;
  // aynı ses üst üste binmesin (sürükleyerek toplamada çok para sesi)
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < 0.06) return;
  last[name] = now;
  SFX[name](now + 0.01);
}

// ---------- Müzik ----------
// Sakin, döngüsel bir şehir müziği: C – Am – F – G akorları, yumuşak tınılar ve pentatonik melodi.

const BPM = 84;
const CHORDS = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]];
const MELODY = [72, 74, 76, 79, 81, 84];

function startMusic() {
  if (!ctx || musicTimer) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
  nextBeat = ctx.currentTime + 0.1;
  musicTimer = setInterval(schedule, 120);
}

function stopMusic() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  clearInterval(musicTimer);
  musicTimer = 0;
}

let melodyNote = 2;
function schedule() {
  const spb = 60 / BPM;
  while (nextBeat < ctx.currentTime + 0.4) {
    const bar = Math.floor(beat / 4) % CHORDS.length;
    const inBar = beat % 4;
    const chord = CHORDS[bar];
    if (inBar === 0) {
      // akor: yumuşak, uzun
      chord.forEach((n, i) => tone(NOTE(n), nextBeat, spb * 4.1, { type: i ? 'sine' : 'triangle', vol: i ? 0.05 : 0.08, attack: 0.25, bus: musicBus }));
    }
    // hafif ritim: her vuruşta yumuşak bas
    if (inBar === 0 || inBar === 2) tone(NOTE(chord[0] - 12), nextBeat, spb * 0.9, { type: 'sine', vol: 0.09, attack: 0.02, bus: musicBus });
    // melodi: komşu notalara rastgele yürüyüş, bazen sus
    if (Math.random() < 0.55) {
      melodyNote = Math.max(0, Math.min(MELODY.length - 1, melodyNote + (Math.floor(Math.random() * 3) - 1)));
      tone(NOTE(MELODY[melodyNote]), nextBeat + (Math.random() < 0.3 ? spb / 2 : 0), spb * 1.4, { type: 'triangle', vol: 0.035, attack: 0.03, bus: musicBus });
    }
    nextBeat += spb;
    beat++;
  }
}
