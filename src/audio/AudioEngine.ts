import { AudioItem, EqualizerBand } from '../types';
import { DEFAULT_EQ_BANDS, BUILTIN_PRESETS } from './EqualizerPresets';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private secondaryAudioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private secondarySourceNode: MediaElementAudioSourceNode | null = null;
  private sourceGain: GainNode | null = null;
  private secondarySourceGain: GainNode | null = null;

  private crossfadeDurationMs = 2000;
  private crossfadeTimer: ReturnType<typeof setInterval> | null = null;
  private crossfadeInProgress = false;
  private crossfadeTargetUri: string | null = null;

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
  private onErrorListeners: Array<(error: string) => void> = [];
  private onCrossfadeCompleteListeners: Array<() => void> = [];

  constructor() {
    this.audioElement = new Audio();
    this.secondaryAudioElement = new Audio();

    for (const element of [this.audioElement, this.secondaryAudioElement]) {
      element.preload = 'auto';
      element.crossOrigin = 'anonymous';
      element.volume = 1;
    }

    const bindElementEvents = (element: HTMLAudioElement) => {
      element.addEventListener('timeupdate', () => {
        if (element !== this.audioElement) return;
        const cur = element.currentTime * 1000;
        const dur = (element.duration || 0) * 1000;
        this.onTimeUpdateListeners.forEach((fn) => fn(cur, dur));
      });

      element.addEventListener('play', () => {
        if (element !== this.audioElement) return;
        this.onStateChangeListeners.forEach((fn) => fn(true));
      });

      element.addEventListener('pause', () => {
        if (element !== this.audioElement) return;
        this.onStateChangeListeners.forEach((fn) => fn(false));
      });

      element.addEventListener('ended', () => {
        if (element !== this.audioElement || this.crossfadeInProgress) return;
        this.onEndedListeners.forEach((fn) => fn());
      });

      element.addEventListener('error', () => {
        const mediaError = element.error;
        const message = mediaError?.message || `Audio media error (code ${mediaError?.code ?? 'unknown'})`;
        if (element === this.audioElement) {
          this.onErrorListeners.forEach((fn) => fn(message));
        }
      });
    };

    bindElementEvents(this.audioElement);
    bindElementEvents(this.secondaryAudioElement);
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
      this.secondarySourceNode = ctx.createMediaElementSource(this.secondaryAudioElement);

      this.sourceGain = ctx.createGain();
      this.secondarySourceGain = ctx.createGain();
      this.sourceGain.gain.value = 1;
      this.secondarySourceGain.gain.value = 0;

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
      if (this.sourceNode && this.sourceGain && this.secondarySourceNode && this.secondarySourceGain && this.preampGain) {
        this.sourceNode.connect(this.sourceGain);
        this.secondarySourceNode.connect(this.secondarySourceGain);
        this.sourceGain.connect(this.preampGain);
        this.secondarySourceGain.connect(this.preampGain);
      }

      let current: AudioNode = this.preampGain;

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
    this.cancelCrossfade();

    this.audioElement.pause();
    this.secondaryAudioElement.pause();
    this.secondaryAudioElement.removeAttribute('src');
    this.secondaryAudioElement.load();

    this.audioElement.src = item.uri;
    this.audioElement.playbackRate = 1;
    this.audioElement.load();

    if (this.sourceGain && this.secondarySourceGain && this.ctx) {
      this.sourceGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.secondarySourceGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  async play(): Promise<void> {
    const ctx = this.ensureAudioContext();
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (this.audioElement.readyState < HTMLMediaElement.HAVE_METADATA && this.audioElement.src) {
        this.audioElement.load();
      }
      await this.audioElement.play();
    } catch (err) {
      this.onErrorListeners.forEach((fn) => fn(err instanceof Error ? err.message : String(err)));
    }
  }

  pause(): void {
    this.cancelCrossfade();
    this.audioElement.pause();
    this.secondaryAudioElement.pause();
  }

  seekTo(positionMs: number): void {
    if (!Number.isNaN(positionMs) && positionMs >= 0) {
      this.cancelCrossfade();
      this.audioElement.currentTime = positionMs / 1000;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = 1;
    this.secondaryAudioElement.volume = 1;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
  }

  setPlaybackRate(rate: number): void {
    const safeRate = Math.max(0.25, Math.min(2, rate));
    this.audioElement.playbackRate = safeRate;
    this.secondaryAudioElement.playbackRate = safeRate;
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

  get isCrossfading(): boolean {
    return this.crossfadeInProgress;
  }

  setCrossfadeDuration(durationMs: number): void {
    this.crossfadeDurationMs = Math.max(0, Math.min(15000, durationMs));
  }

  getCrossfadeDuration(): number {
    return this.crossfadeDurationMs;
  }

  async crossfadeTo(item: AudioItem, durationMs = this.crossfadeDurationMs): Promise<void> {
    if (this.crossfadeInProgress) return;
    if (!this.audioElement.src || !this.isPlaying) {
      await this.loadTrack(item);
      await this.play();
      return;
    }

    const duration = Math.max(250, durationMs);
    const next = this.secondaryAudioElement;
    const source = this.audioElement;

    this.ensureAudioContext();
    this.crossfadeInProgress = true;
    this.crossfadeTargetUri = item.uri;

    try {
      next.pause();
      next.src = item.uri;
      next.playbackRate = source.playbackRate;
      next.currentTime = 0;
      next.load();

      if (this.sourceGain && this.secondarySourceGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.sourceGain.gain.cancelScheduledValues(now);
        this.secondarySourceGain.gain.cancelScheduledValues(now);
        this.sourceGain.gain.setValueAtTime(1, now);
        this.secondarySourceGain.gain.setValueAtTime(0, now);
      }

      await next.play();

      const tickMs = 40;
      this.crossfadeTimer = setInterval(() => {
        if (!this.crossfadeInProgress) return;

        const remaining = Math.max(0, ((source.duration || 0) - source.currentTime) * 1000);
        const progress = Math.min(1, Math.max(0, (duration - remaining) / duration));

        if (this.sourceGain && this.secondarySourceGain && this.ctx) {
          const now = this.ctx.currentTime;
          this.sourceGain.gain.setTargetAtTime(1 - progress, now, 0.025);
          this.secondarySourceGain.gain.setTargetAtTime(progress, now, 0.025);
        }

        if (remaining <= 35 || source.ended || next.ended) {
          this.finishCrossfade();
        }
      }, tickMs);
    } catch (err) {
      this.cancelCrossfade();
      this.onErrorListeners.forEach((fn) => fn(err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  private finishCrossfade(): void {
    if (!this.crossfadeInProgress) return;
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }

    const oldActive = this.audioElement;
    const oldSecondary = this.secondaryAudioElement;
    const oldSourceNode = this.sourceNode;
    const oldSecondarySourceNode = this.secondarySourceNode;
    const oldSourceGain = this.sourceGain;
    const oldSecondaryGain = this.secondarySourceGain;

    oldSecondary.volume = 1;
    oldActive.pause();

    if (this.ctx && oldSourceGain && oldSecondaryGain) {
      const now = this.ctx.currentTime;
      oldSourceGain.gain.setValueAtTime(0, now);
      oldSecondaryGain.gain.setValueAtTime(1, now);
    }

    this.audioElement = oldSecondary;
    this.secondaryAudioElement = oldActive;
    this.sourceNode = oldSecondarySourceNode;
    this.secondarySourceNode = oldSourceNode;
    this.sourceGain = oldSecondaryGain;
    this.secondarySourceGain = oldSourceGain;

    this.crossfadeInProgress = false;
    this.crossfadeTargetUri = null;

    if (this.sourceGain && this.secondarySourceGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.sourceGain.gain.setValueAtTime(1, now);
      this.secondarySourceGain.gain.setValueAtTime(0, now);
    }

    this.onStateChangeListeners.forEach((fn) => fn(true));
    this.onCrossfadeCompleteListeners.forEach((fn) => fn());
  }

  private cancelCrossfade(): void {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.crossfadeInProgress) {
      this.secondaryAudioElement.pause();
      this.secondaryAudioElement.removeAttribute('src');
      this.secondaryAudioElement.load();
    }
    this.crossfadeInProgress = false;
    this.crossfadeTargetUri = null;

    if (this.sourceGain && this.secondarySourceGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.sourceGain.gain.cancelScheduledValues(now);
      this.secondarySourceGain.gain.cancelScheduledValues(now);
      this.sourceGain.gain.setValueAtTime(1, now);
      this.secondarySourceGain.gain.setValueAtTime(0, now);
    }
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

  onError(fn: (error: string) => void): () => void {
    this.onErrorListeners.push(fn);
    return () => {
      this.onErrorListeners = this.onErrorListeners.filter((l) => l !== fn);
    };
  }

  onCrossfadeComplete(fn: () => void): () => void {
    this.onCrossfadeCompleteListeners.push(fn);
    return () => {
      this.onCrossfadeCompleteListeners = this.onCrossfadeCompleteListeners.filter((l) => l !== fn);
    };
  }
}

export const mainAudioEngine = new AudioEngine();
