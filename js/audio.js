/*
 * Shared River — sound, made in code with the Web Audio API
 * (no sound files, so nothing to license): a soft river loop, a click
 * for choices, a rising tone for good years and a low tone for shortages.
 */
(function (root) {
  let ctx = null;
  let master = null;
  let river = null;
  let enabled = true;
  try { enabled = localStorage.getItem('sharedRiver.sound') !== 'off'; } catch (e) { /* storage blocked */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, start, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function startRiver() {
    if (!ensure() || river) return;
    // Brown noise through a low-pass filter, gently swelling like water.
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(lp).connect(g).connect(master);
    src.start();
    lfo.start();
    river = { src, g };
  }

  const Sound = {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startRiver();
    },
    click() { tone(660, 0, 0.07, 'triangle', 0.06); },
    select() { tone(520, 0, 0.06, 'sine', 0.06); tone(780, 0.04, 0.08, 'sine', 0.05); },
    good() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 'sine', 0.08)); },
    bad() { tone(196, 0, 0.6, 'sawtooth', 0.05, 110); tone(147, 0.05, 0.7, 'sine', 0.08, 98); },
    signed() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, i * 0.08, 0.5, 'triangle', 0.06)); },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('sharedRiver.sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (ensure()) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.05);
      if (enabled) Sound.unlock();
      return enabled;
    },
  };

  root.Sound = Sound;
})(window);
