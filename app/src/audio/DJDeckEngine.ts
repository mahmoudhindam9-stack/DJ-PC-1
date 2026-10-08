import { AudioItem } from '../types';

export type DJEffectType =
  | 'none'
  | 'fx_filter'
  | 'fx_delay'
  | 'fx_reverb'
  | 'fx_flanger'
  | 'fx_phaser'
  | 'fx_bitcrush'
  | 'fx_distortion'
  | 'fx_compressor'
  | 'voice_woman'
  | 'voice_kid'
  | 'voice_chipmunk'
  | 'voice_monster'
  | 'voice_demon'
  | 'voice_giant';

export class DJDeckEngine {
  public readonly deckName: string;
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Audio nodes
  private deckGain: GainNode | null = null;
  private crossfadeGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private waveshaperNode: WaveShaperNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Deck state
  public currentTrack: AudioItem | null = null;
  public pitch = 1.0;
  public cuePositionMs = 0;
  public activeEffect: DJEffectType = 'none';
  public fxAmount = 0.5; // 0 to 1
  public isPlaying = false;
  public volume = 1.0;

  // Callbacks
  private onUpdateCallbacks: Array<() => void> = [];

  constructor(name: string) {
    this.deckName = name;
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.crossOrigin = 'anonymous';

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.notify();
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.notify();
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.notify();
    });

    this.audioElement.addEventListener('timeupdate', () => {
      this.notify();
    });
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.sourceNode && this.ctx) {
      this.setupNodes(this.ctx);
    }
    return this.ctx;
  }

  private setupNodes(ctx: AudioContext) {
    try {
      this.sourceNode = ctx.createMediaElementSource(this.audioElement);

      this.filterNode = ctx.createBiquadFilter();
      this.filterNode.type = 'allpass';

      this.delayNode = ctx.createDelay(2.0);
      this.delayNode.delayTime.value = 0.25;

      this.delayFeedback = ctx.createGain();
      this.delayFeedback.gain.value = 0.3;
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);

      this.waveshaperNode = ctx.createWaveShaper();
      this.waveshaperNode.curve = this.makeDistortionCurve(0) as any;

      this.compressorNode = ctx.createDynamicsCompressor();

      this.deckGain = ctx.createGain();
      this.deckGain.gain.value = 1.0;

      this.crossfadeGain = ctx.createGain();
      this.crossfadeGain.gain.value = 1.0;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;

      // Graph:
      // source -> filter -> compressor -> deckGain -> crossfadeGain -> analyser -> destination
      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.compressorNode);
      this.compressorNode.connect(this.deckGain);
      this.deckGain.connect(this.crossfadeGain);
      this.crossfadeGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);
    } catch (e) {
      console.warn('DJDeckEngine setupNodes note:', e);
    }
  }

  loadTrack(track: AudioItem) {
    this.ensureContext();
    this.currentTrack = track;
    this.audioElement.src = track.uri;
    this.audioElement.load();
    this.seekTo(0);
    this.notify();
  }

  async play() {
    this.ensureContext();
    try {
      await this.audioElement.play();
    } catch (err) {
      console.warn('Deck play wait:', err);
    }
  }

  pause() {
    this.audioElement.pause();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  cue() {
    this.seekTo(this.cuePositionMs);
    if (this.isPlaying) {
      this.pause();
    }
  }

  setCue() {
    this.cuePositionMs = this.currentTimeMs;
    this.notify();
  }

  seekTo(positionMs: number) {
    if (!Number.isNaN(positionMs) && positionMs >= 0) {
      this.audioElement.currentTime = positionMs / 1000;
      this.notify();
    }
  }

  setPitch(pitchValue: number) {
    // Snap within 0.04 of 1.0
    if (Math.abs(pitchValue - 1.0) <= 0.04) {
      this.pitch = 1.0;
    } else {
      this.pitch = Math.max(0.5, Math.min(1.5, pitchValue));
    }
    this.applyPitchAndEffect();
    this.notify();
  }

  setCrossfadeVolume(gain: number) {
    const clamped = Math.max(0, Math.min(1, gain));
    if (this.crossfadeGain && this.ctx) {
      this.crossfadeGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    }
  }

  setDeckVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.deckGain && this.ctx) {
      this.deckGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  setEffect(fx: DJEffectType) {
    this.activeEffect = fx;
    this.applyPitchAndEffect();
    this.notify();
  }

  setFxAmount(amount: number) {
    this.fxAmount = Math.max(0, Math.min(1, amount));
    this.applyPitchAndEffect();
    this.notify();
  }

  private applyPitchAndEffect() {
    let effectiveRate = this.pitch;

    // Handle voice morphing semitones
    switch (this.activeEffect) {
      case 'voice_woman':
        // +4 semitones approx 1.26
        effectiveRate *= 1.26;
        break;
      case 'voice_kid':
        // +7 semitones approx 1.49
        effectiveRate *= 1.49;
        break;
      case 'voice_chipmunk':
        // +12 semitones approx 1.95
        effectiveRate *= 1.95;
        break;
      case 'voice_monster':
        // -5 semitones approx 0.75
        effectiveRate *= 0.75;
        break;
      case 'voice_demon':
        // -8 semitones approx 0.63
        effectiveRate *= 0.63;
        break;
      case 'voice_giant':
        // -12 semitones approx 0.50
        effectiveRate *= 0.5;
        break;
      default:
        break;
    }

    this.audioElement.playbackRate = Math.max(0.25, Math.min(2.5, effectiveRate));

    // Apply DSP effect parameters
    if (this.filterNode && this.ctx) {
      const now = this.ctx.currentTime;
      switch (this.activeEffect) {
        case 'fx_filter':
          this.filterNode.type = 'lowpass';
          // 400Hz to 18000Hz based on amount
          const freq = 400 + Math.pow(this.fxAmount, 2) * 17600;
          this.filterNode.frequency.setTargetAtTime(freq, now, 0.05);
          this.filterNode.Q.setTargetAtTime(3.0 * this.fxAmount, now, 0.05);
          break;
        case 'fx_distortion':
        case 'voice_monster':
        case 'voice_demon':
          this.filterNode.type = 'peaking';
          this.filterNode.frequency.setTargetAtTime(1000, now, 0.05);
          this.filterNode.gain.setTargetAtTime(12 * this.fxAmount, now, 0.05);
          if (this.waveshaperNode) {
            this.waveshaperNode.curve = this.makeDistortionCurve(Math.floor(this.fxAmount * 400)) as any;
          }
          break;
        case 'fx_flanger':
        case 'fx_phaser':
          this.filterNode.type = 'bandpass';
          this.filterNode.frequency.setTargetAtTime(1200, now, 0.05);
          this.filterNode.Q.setTargetAtTime(5.0 * this.fxAmount, now, 0.05);
          break;
        case 'fx_reverb':
        case 'fx_delay':
          this.filterNode.type = 'highshelf';
          this.filterNode.frequency.setTargetAtTime(3500, now, 0.05);
          this.filterNode.gain.setTargetAtTime(4 * this.fxAmount, now, 0.05);
          break;
        default:
          this.filterNode.type = 'allpass';
          if (this.waveshaperNode) {
            this.waveshaperNode.curve = this.makeDistortionCurve(0) as any;
          }
          break;
      }
    }
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const k = typeof amount === 'number' ? amount : 50;
    const nSamples = 44100;
    const buffer = new ArrayBuffer(nSamples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      if (k === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  get currentTimeMs(): number {
    return (this.audioElement.currentTime || 0) * 1000;
  }

  get durationMs(): number {
    return (this.audioElement.duration || 0) * 1000;
  }

  getVisualizerData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(32);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  subscribe(callback: () => void): () => void {
    this.onUpdateCallbacks.push(callback);
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.onUpdateCallbacks.forEach((cb) => cb());
  }
}

export const deckAEngine = new DJDeckEngine('DECK A');
export const deckBEngine = new DJDeckEngine('DECK B');
