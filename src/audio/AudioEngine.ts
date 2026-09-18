import { AudioItem, EqualizerBand } from '../types';
import { DEFAULT_EQ_BANDS, BUILTIN_PRESETS } from './EqualizerPresets';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Processing chain nodes
  private preampGain: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassBoostFilter: BiquadFilterNode | null = null;
  private trebleBoostFilter: BiquadFilterNode | null = null;
  private virtualizerPanner: StereoPannerNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // State
  private isInitialized = false;
  private isEqEnabled = true;
  private bands: EqualizerBand[] = JSON.parse(JSON.stringify(DEFAULT_EQ_BANDS));
  private selectedPreset = 'Flat';
  private bassBoost = 0; // 0 to 1
  private trebleBoost = 0; // 0 to 1
  private preampDb = 0; // 0 to 12
  private virtualizer3D = false;

  // Listeners
  private onTimeUpdateListeners: Array<(currentTime: number, duration: number) => void> = [];
  private onStateChangeListeners: Array<(isPlaying: boolean) => void> = [];
  private onEndedListeners: Array<() => void> = [];

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.crossOrigin = 'anonymous';

    this.audioElement.addEventListener('timeupdate', () => {
      const cur = this.audioElement.currentTime * 1000;
      const dur = (this.audioElement.duration || 0) * 1000;
      this.onTimeUpdateListeners.forEach((fn) => fn(cur, dur));
    });

    this.audioElement.addEventListener('play', () => {
      this.onStateChangeListeners.forEach((fn) => fn(true));
    });

    this.audioElement.addEventListener('pause', () => {
      this.onStateChangeListeners.forEach((fn) => fn(false));
    });

    this.audioElement.addEventListener('ended', () => {
      this.onEndedListeners.forEach((fn) => fn());
    });
  }

  private ensureAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.isInitialized && this.ctx) {
      this.setupAudioGraph(this.ctx);
      this.isInitialized = true;
    }
    return this.ctx;
  }

  private setupAudioGraph(ctx: AudioContext) {
    try {
      this.sourceNode = ctx.createMediaElementSource(this.audioElement);
      this.preampGain = ctx.createGain();
      this.preampGain.gain.value = Math.pow(10, this.preampDb / 20);

      // 10-band peaking filters
      this.eqFilters = this.bands.map((band) => {
        const filter = ctx.createBiquadFilter();
        if (band.frequencyHz <= 31) {
          filter.type = 'lowshelf';
        } else if (band.frequencyHz >= 16000) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = band.frequencyHz;
        filter.gain.value = this.isEqEnabled ? band.currentLevelDb : 0;
        return filter;
      });

      // Bass Boost (lowshelf at 80Hz)
      this.bassBoostFilter = ctx.createBiquadFilter();
      this.bassBoostFilter.type = 'lowshelf';
      this.bassBoostFilter.frequency.value = 80;
      this.bassBoostFilter.gain.value = this.isEqEnabled ? this.bassBoost * 12 : 0;

      // Treble Boost (highshelf at 10kHz)
      this.trebleBoostFilter = ctx.createBiquadFilter();
      this.trebleBoostFilter.type = 'highshelf';
      this.trebleBoostFilter.frequency.value = 10000;
      this.trebleBoostFilter.gain.value = this.isEqEnabled ? this.trebleBoost * 12 : 0;

      // Stereo Virtualizer
      if (ctx.createStereoPanner) {
        this.virtualizerPanner = ctx.createStereoPanner();
        this.virtualizerPanner.pan.value = 0;
      }

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1.0;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect graph:
      // source -> preamp -> eqFilters[0..9] -> bassBoost -> trebleBoost -> [panner] -> masterGain -> analyser -> destination
      let current: AudioNode = this.sourceNode;
      current.connect(this.preampGain);
      current = this.preampGain;

      for (const f of this.eqFilters) {
        current.connect(f);
        current = f;
      }

      current.connect(this.bassBoostFilter);
      current = this.bassBoostFilter;

      current.connect(this.trebleBoostFilter);
      current = this.trebleBoostFilter;

      if (this.virtualizerPanner) {
        current.connect(this.virtualizerPanner);
        current = this.virtualizerPanner;
      }

      current.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);
    } catch (e) {
      console.warn('Web Audio Graph initialization note:', e);
    }
  }

  // --- PLAYBACK ---
  async loadTrack(item: AudioItem): Promise<void> {
    this.ensureAudioContext();
    this.audioElement.src = item.uri;
    this.audioElement.load();
  }

  async play(): Promise<void> {
    this.ensureAudioContext();
    try {
      await this.audioElement.play();
    } catch (err) {
      console.warn('Audio playback waiting for interaction:', err);
    }
  }

  pause(): void {
    this.audioElement.pause();
  }

  seekTo(positionMs: number): void {
    if (!Number.isNaN(positionMs) && positionMs >= 0) {
      this.audioElement.currentTime = positionMs / 1000;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
  }

  setPlaybackRate(rate: number): void {
    this.audioElement.playbackRate = Math.max(0.25, Math.min(2.0, rate));
  }

  get isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  get currentTimeMs(): number {
    return (this.audioElement.currentTime || 0) * 1000;
  }

  get durationMs(): number {
    return (this.audioElement.duration || 0) * 1000;
  }

  // --- EQUALIZER & EFFECTS ---
  get eqEnabled(): boolean {
    return this.isEqEnabled;
  }

  setEqEnabled(enabled: boolean): void {
    this.isEqEnabled = enabled;
    this.applyAllFilters();
  }

  getBands(): EqualizerBand[] {
    return this.bands;
  }

  setBandLevel(bandId: number, levelDb: number): void {
    const band = this.bands.find((b) => b.id === bandId);
    if (!band) return;
    band.currentLevelDb = Math.max(band.minLevelDb, Math.min(band.maxLevelDb, levelDb));
    this.selectedPreset = 'Custom';

    if (this.eqFilters[bandId] && this.ctx) {
      const target = this.isEqEnabled ? band.currentLevelDb : 0;
      this.eqFilters[bandId].gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  get currentPreset(): string {
    return this.selectedPreset;
  }

  applyPreset(presetName: string): void {
    const presetValues = BUILTIN_PRESETS[presetName];
    if (!presetValues) return;

    this.selectedPreset = presetName;
    presetValues.forEach((val, i) => {
      if (this.bands[i]) {
        this.bands[i].currentLevelDb = val;
        if (this.eqFilters[i] && this.ctx) {
          const target = this.isEqEnabled ? val : 0;
          this.eqFilters[i].gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
        }
      }
    });
  }

  applyCustomBands(values: number[]): void {
    this.selectedPreset = 'Custom';
    values.forEach((val, i) => {
      if (this.bands[i]) {
        this.bands[i].currentLevelDb = val;
        if (this.eqFilters[i] && this.ctx) {
          const target = this.isEqEnabled ? val : 0;
          this.eqFilters[i].gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
        }
      }
    });
  }

  get bassBoostLevel(): number {
    return this.bassBoost;
  }

  setBassBoostLevel(val: number): void {
    this.bassBoost = Math.max(0, Math.min(1, val));
    if (this.bassBoostFilter && this.ctx) {
      const target = this.isEqEnabled ? this.bassBoost * 12 : 0;
      this.bassBoostFilter.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  get trebleBoostLevel(): number {
    return this.trebleBoost;
  }

  setTrebleBoostLevel(val: number): void {
    this.trebleBoost = Math.max(0, Math.min(1, val));
    if (this.trebleBoostFilter && this.ctx) {
      const target = this.isEqEnabled ? this.trebleBoost * 12 : 0;
      this.trebleBoostFilter.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  get currentPreampDb(): number {
    return this.preampDb;
  }

  setPreampDb(val: number): void {
    this.preampDb = Math.max(0, Math.min(12, val));
    if (this.preampGain && this.ctx) {
      const gainMultiplier = this.isEqEnabled ? Math.pow(10, this.preampDb / 20) : 1;
      this.preampGain.gain.setTargetAtTime(gainMultiplier, this.ctx.currentTime, 0.05);
    }
  }

  private applyAllFilters(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.bands.forEach((b, i) => {
      if (this.eqFilters[i]) {
        const target = this.isEqEnabled ? b.currentLevelDb : 0;
        this.eqFilters[i].gain.setTargetAtTime(target, now, 0.05);
      }
    });
    if (this.bassBoostFilter) {
      this.bassBoostFilter.gain.setTargetAtTime(
        this.isEqEnabled ? this.bassBoost * 12 : 0,
        now,
        0.05
      );
    }
    if (this.trebleBoostFilter) {
      this.trebleBoostFilter.gain.setTargetAtTime(
        this.isEqEnabled ? this.trebleBoost * 12 : 0,
        now,
        0.05
      );
    }
    if (this.preampGain) {
      const gainMultiplier = this.isEqEnabled ? Math.pow(10, this.preampDb / 20) : 1;
      this.preampGain.gain.setTargetAtTime(gainMultiplier, now, 0.05);
    }
  }

  getVisualizerData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(64);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  // --- LISTENERS ---
  onTimeUpdate(fn: (currentTime: number, duration: number) => void): () => void {
    this.onTimeUpdateListeners.push(fn);
    return () => {
      this.onTimeUpdateListeners = this.onTimeUpdateListeners.filter((l) => l !== fn);
    };
  }

  onStateChange(fn: (isPlaying: boolean) => void): () => void {
    this.onStateChangeListeners.push(fn);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== fn);
    };
  }

  onEnded(fn: () => void): () => void {
    this.onEndedListeners.push(fn);
    return () => {
      this.onEndedListeners = this.onEndedListeners.filter((l) => l !== fn);
    };
  }
}

export const mainAudioEngine = new AudioEngine();
