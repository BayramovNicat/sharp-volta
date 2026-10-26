let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
}

export const playTone = (freq: number, startTime: number, duration: number, gainValue = 0.15) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
};

export const playMessageChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const play = () => {
    const now = ctx.currentTime;
    playTone(587.33, now, 0.08, 0.12);
    playTone(880.0, now + 0.06, 0.22, 0.14);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(play);
  } else {
    play();
  }
};

export const playMentionChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const play = () => {
    const now = ctx.currentTime;
    playTone(523.25, now, 0.07, 0.12);
    playTone(659.25, now + 0.05, 0.07, 0.14);
    playTone(783.99, now + 0.1, 0.28, 0.16);
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(play);
  } else {
    play();
  }
};
