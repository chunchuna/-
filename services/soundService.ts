class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private bgmInterval: number | null = null;
  private bgmNoteIndex: number = 0;

  constructor() {
    // Lazy init handled in init()
  }

  public init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // Default volume
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.error('AudioContext init failed', e);
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime, 0.1);
      } catch (e) { console.error(e); }
    }
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }

  // --- SYNTHESIS HELPERS ---

  private createOscillator(type: OscillatorType, freq: number, duration: number, startTime: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch(e) { console.error(e); }
  }

  private createNoise(duration: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(1, this.ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      noise.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      
      noise.start();
    } catch(e) { console.error(e); }
  }

  // --- SFX ---

  public playLaser() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
      
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch(e) { console.error(e); }
  }

  public playCombo(combo: number) {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      
      // Pentatonic scale (C, D, E, G, A) relative to C4 (261.63)
      const scale = [261.63, 293.66, 329.63, 392.00, 440.00]; 
      // Safe combo ensures index is always valid >= 0
      const safeCombo = Math.max(1, Math.floor(combo));
      
      const scaleIndex = (safeCombo - 1) % scale.length;
      // Increase octave every full scale cycle, cap at 2 octaves up
      const octave = Math.floor((safeCombo - 1) / scale.length);
      const multiplier = Math.pow(2, Math.min(octave, 2));
      
      // Scale index should be safe now (0 to 4), but verify result
      const baseFreq = scale[scaleIndex];
      if (typeof baseFreq !== 'number') return;
      
      const freq = baseFreq * multiplier;
      
      if (!Number.isFinite(freq)) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine'; // Pure tone for combo
      osc.frequency.setValueAtTime(freq, t);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3); // Short pluck
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start(t);
      osc.stop(t + 0.3);
    } catch(e) { 
      // Prevent game crash if audio fails
      console.error('playCombo error', e); 
    }
  }

  public playExplosion() {
    if (!this.ctx || this.isMuted) return;
    try {
      // Low rumble
      this.createOscillator('square', 50, 0.3, this.ctx.currentTime);
      // White noise blast
      this.createNoise(0.3);
    } catch(e) { console.error(e); }
  }

  public playBombExplosion() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      
      // Sub-bass impact
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.8);

      // Loud Noise blast
      this.createNoise(0.6);
    } catch(e) { console.error(e); }
  }

  public playHit() {
    if (!this.ctx || this.isMuted) return;
    this.createOscillator('square', 150, 0.1, this.ctx.currentTime);
  }

  public playMiss() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(150, t + 0.2);
      
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch(e) { console.error(e); }
  }

  public playPowerup() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      [440, 554, 659, 880].forEach((freq, i) => {
        this.createOscillator('sine', freq, 0.3, t + i * 0.05);
      });
    } catch(e) { console.error(e); }
  }

  public playHeal() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      // Magical chime up
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major
      freqs.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        gain.gain.setValueAtTime(0.4, t + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.6);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.6);
      });
    } catch(e) { console.error(e); }
  }

  public playSlow() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Pitch down effect
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 1.0);
      
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 1.0);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 1.0);
    } catch(e) { console.error(e); }
  }

  public playBaseAlarm() {
    if (!this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.5);
      
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.5);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.5);
    } catch(e) { console.error(e); }
  }

  public playUIHover() {
    if (!this.ctx || this.isMuted) return;
    this.createOscillator('sine', 800, 0.03, this.ctx.currentTime);
  }

  public playUIConfirm() {
    if (!this.ctx || this.isMuted) return;
    this.createOscillator('square', 1200, 0.1, this.ctx.currentTime);
  }

  // --- BGM ---

  public startBGM() {
    this.init();
    if (this.bgmInterval) return;
    
    const bassLine = [55, 55, 55, 65, 55, 55, 49, 49]; // A1, A1, A1, C2...
    const tempo = 200; // ms per 16th note

    this.bgmInterval = window.setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      
      try {
        const t = this.ctx.currentTime;
        const freq = bassLine[this.bgmNoteIndex % bassLine.length];
        
        // Bass Synth
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(50, t + 0.15);
        filter.Q.value = 5;

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        
        osc.start(t);
        osc.stop(t + 0.2);

        // Hi-hat (White noise tick)
        if (this.bgmNoteIndex % 2 === 0) {
          const hOsc = this.ctx.createOscillator(); // Using square for gritty digital hat
          const hGain = this.ctx.createGain();
          const hFilter = this.ctx.createBiquadFilter();

          hOsc.type = 'square';
          hOsc.frequency.value = 8000;
          
          hFilter.type = 'highpass';
          hFilter.frequency.value = 6000;

          hGain.gain.setValueAtTime(0.05, t);
          hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

          hOsc.connect(hFilter);
          hFilter.connect(hGain);
          hGain.connect(this.masterGain!);
          hOsc.start(t);
          hOsc.stop(t + 0.05);
        }

        this.bgmNoteIndex++;
      } catch (e) {
        console.error('BGM error', e);
        if (this.bgmInterval) {
           clearInterval(this.bgmInterval);
           this.bgmInterval = null;
        }
      }
    }, tempo);
  }

  public stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const soundService = new SoundService();