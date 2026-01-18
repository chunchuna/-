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
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3; // Default volume
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.3, this.ctx!.currentTime, 0.1);
    }
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }

  // --- SYNTHESIS HELPERS ---

  private createOscillator(type: OscillatorType, freq: number, duration: number, startTime: number) {
    if (!this.ctx || !this.masterGain) return;
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
  }

  private createNoise(duration: number) {
    if (!this.ctx || !this.masterGain) return;
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
  }

  // --- SFX ---

  public playLaser() {
    if (!this.ctx || this.isMuted) return;
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
  }

  public playExplosion() {
    if (!this.ctx || this.isMuted) return;
    // Low rumble
    this.createOscillator('square', 50, 0.3, this.ctx.currentTime);
    // White noise blast
    this.createNoise(0.3);
  }

  public playHit() {
    if (!this.ctx || this.isMuted) return;
    this.createOscillator('square', 150, 0.1, this.ctx.currentTime);
  }

  public playMiss() {
    if (!this.ctx || this.isMuted) return;
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
  }

  public playPowerup() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    [440, 554, 659, 880].forEach((freq, i) => {
      this.createOscillator('sine', freq, 0.3, t + i * 0.05);
    });
  }

  public playBaseAlarm() {
    if (!this.ctx || this.isMuted) return;
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
