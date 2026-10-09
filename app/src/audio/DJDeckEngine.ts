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

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const VOICE_RATE: Partial<Record<DJEffectType, number>> = {
  voice_woman: 1.26,
  voice_kid: 1.49,
  voice_chipmunk: 1.95,
  voice_monster: 0.75,
  voice_demon: 0.63,
  voice_giant: 0.5,
};

export class DJDeckEngine {
  public readonly deckName: string;
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  private deckGain: GainNode | null = null;
  private crossfadeGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private delayLfo: OscillatorNode | null = null;
  private delayLfoGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private waveshaperNode: WaveShaperNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bpmAnalyser: AnalyserNode | null = null;
  private bpmSilentGain: GainNode | null = null;
  private bpmFrameId: number | null = null;
  private bpmLastSampleAt = 0;
  private bpmLastEvaluationAt = 0;
  private bpmSampleIntervalMs = 50;
  private bpmPreviousSpectrum = new Uint8Array(0);
  private bpmSamples: number[] = [];
  private bpmCandidate: number | null = null;
  private bpmCandidateHits = 0;

  public currentBpm: number | null = null;
  public bpmConfidence = 0;
  public currentTrack: AudioItem | null = null;
  public pitch = 1.0;
  public cuePositionMs = 0;
  public activeEffect: DJEffectType = 'none';
  public fxAmount = 0.5;
  public isPlaying = false;
  public volume = 1.0;
  private crossfadeVolume = 1.0;
  private onUpdateCallbacks: Array<() => void> = [];

  constructor(name: string) {
    this.deckName = name;
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.volume = 1;

    const mediaElement = this.audioElement as HTMLAudioElement & {
      preservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
      mozPreservesPitch?: boolean;
    };
    // DJ tempo must alter actual speed and pitch rather than being hidden by pitch preservation.
    mediaElement.preservesPitch = false;
    mediaElement.webkitPreservesPitch = false;
    mediaElement.mozPreservesPitch = false;

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      this.startBpmDetection();
      this.notify();
    });
    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      this.stopBpmDetection();
      this.notify();
    });
    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.stopBpmDetection();
      this.notify();
    });
    this.audioElement.addEventListener('timeupdate', () => this.notify());
    this.audioElement.addEventListener('durationchange', () => this.notify());
    this.audioElement.addEventListener('ratechange', () => this.notify());
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    if (!this.sourceNode) {
      this.setupNodes(this.ctx);
      this.applyPitchAndEffect();
    }
    return this.ctx;
  }

  private setupNodes(ctx: AudioContext) {
    this.sourceNode = ctx.createMediaElementSource(this.audioElement);

    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'allpass';
    this.filterNode.frequency.value = 1000;
    this.filterNode.Q.value = 0.0001;

    this.waveshaperNode = ctx.createWaveShaper();
    this.waveshaperNode.curve = this.makeDistortionCurve(0);
    this.waveshaperNode.oversample = '4x';

    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = -18;
    this.compressorNode.knee.value = 20;
    this.compressorNode.ratio.value = 3;
    this.compressorNode.attack.value = 0.015;
    this.compressorNode.release.value = 0.25;

    this.deckGain = ctx.createGain();
    this.deckGain.gain.value = this.volume;

    this.crossfadeGain = ctx.createGain();
    this.crossfadeGain.gain.value = this.crossfadeVolume;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Use a dedicated high-resolution analyser for beat tracking. Its output is
    // muted, so it observes the same source without adding a second audible path.
    this.bpmAnalyser = ctx.createAnalyser();
    this.bpmAnalyser.fftSize = 2048;
    this.bpmAnalyser.smoothingTimeConstant = 0;
    this.bpmAnalyser.minDecibels = -90;
    this.bpmAnalyser.maxDecibels = -20;
    this.bpmPreviousSpectrum = new Uint8Array(this.bpmAnalyser.frequencyBinCount);
    this.bpmSilentGain = ctx.createGain();
    this.bpmSilentGain.gain.value = 0;
    this.sourceNode.connect(this.bpmAnalyser);
    this.bpmAnalyser.connect(this.bpmSilentGain);
    this.bpmSilentGain.connect(ctx.destination);

    this.delayNode = ctx.createDelay(2);
    this.delayNode.delayTime.value = 0.25;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0;
    this.delayWetGain = ctx.createGain();
    this.delayWetGain.gain.value = 0;

    this.delayLfo = ctx.createOscillator();
    this.delayLfo.frequency.value = 0.25;
    this.delayLfoGain = ctx.createGain();
    this.delayLfoGain.gain.value = 0;
    this.delayLfo.connect(this.delayLfoGain);
    this.delayLfoGain.connect(this.delayNode.delayTime);
    this.delayLfo.start();

    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(ctx, 2.4, 2.7);
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = 0;

    // Main dry path.
    this.sourceNode.connect(this.filterNode);
    this.filterNode.connect(this.waveshaperNode);
    this.waveshaperNode.connect(this.compressorNode);
    this.compressorNode.connect(this.deckGain);

    // Effect returns: these were previously instantiated without being connected to output.
    this.sourceNode.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.deckGain);

    this.sourceNode.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.deckGain);

    this.deckGain.connect(this.crossfadeGain);
    this.crossfadeGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  private createImpulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  loadTrack(track: AudioItem) {
    this.ensureContext();
    this.resetBpmDetection();
    this.currentTrack = track;
    this.audioElement.src = track.uri;
    this.audioElement.load();
    this.seekTo(0);
    this.applyPitchAndEffect();
    this.notify();
  }

  async play() {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch (error) {
        console.warn('Could not resume DJ deck audio context:', error);
      }
    }
    try {
      await this.audioElement.play();
    } catch (error) {
      console.warn('Deck play was blocked or the track could not be decoded:', error);
    }
  }

  pause() {
    this.audioElement.pause();
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else void this.play();
  }

  cue() {
    this.seekTo(this.cuePositionMs);
    if (this.isPlaying) this.pause();
  }

  setCue() {
    this.cuePositionMs = this.currentTimeMs;
    this.notify();
  }

  seekTo(positionMs: number) {
    if (!Number.isNaN(positionMs) && Number.isFinite(positionMs) && positionMs >= 0) {
      try {
        this.audioElement.currentTime = positionMs / 1000;
      } catch {
        // Seeking can be unavailable until a track has loaded.
      }
      this.notify();
    }
  }

  setPitch(pitchValue: number) {
    // Do not snap near 100%: the former +/-4% dead zone made the tempo control seem broken.
    this.pitch = clamp(pitchValue, 0.5, 1.5);
    this.applyPitchAndEffect();
    this.notify();
  }

  /**
   * Match this deck to a playing reference deck, then nudge this track's
   * timeline to the closest beat-grid phase. Beat phase is estimated from
   * the track's measured BPM and its current playback rate.
   */
  syncTo(reference: DJDeckEngine): {
    success: boolean;
    reason: 'synced' | 'pitch-limit' | 'unavailable' | 'not-playing';
  } {
    if (!this.isPlaying || !reference.isPlaying) {
      return { success: false, reason: 'not-playing' };
    }

    const ownBpm = this.currentBpm;
    const referenceBpm = reference.currentBpm;
    if (
      ownBpm === null ||
      referenceBpm === null ||
      this.bpmConfidence < 0.12 ||
      reference.bpmConfidence < 0.12
    ) {
      return { success: false, reason: 'unavailable' };
    }

    const previousPitch = this.pitch;
    const desiredPitch = previousPitch * (referenceBpm / ownBpm);
    const nextPitch = clamp(desiredPitch, 0.5, 1.5);
    const matchedBpm = ownBpm * (nextPitch / previousPitch);
    const pitchLimited = Math.abs(matchedBpm - referenceBpm) / referenceBpm > 0.015;

    // Convert detected output BPM back to track-timeline BPM. Playback rate
    // changes what the analyser hears, but not the time values in the media file.
    const ownPlaybackRate = Math.max(0.25, this.audioElement.playbackRate || 1);
    const referencePlaybackRate = Math.max(0.25, reference.audioElement.playbackRate || 1);
    const ownTrackBpm = ownBpm / ownPlaybackRate;
    const referenceTrackBpm = referenceBpm / referencePlaybackRate;

    if (
      !Number.isFinite(ownTrackBpm) ||
      !Number.isFinite(referenceTrackBpm) ||
      ownTrackBpm <= 0 ||
      referenceTrackBpm <= 0
    ) {
      return { success: false, reason: 'unavailable' };
    }

    const ownPhase = ((this.currentTimeMs * ownTrackBpm / 60000) % 1 + 1) % 1;
    const referencePhase = ((reference.currentTimeMs * referenceTrackBpm / 60000) % 1 + 1) % 1;
    let phaseShiftBeats = referencePhase - ownPhase;
    phaseShiftBeats = ((phaseShiftBeats + 0.5) % 1 + 1) % 1 - 0.5;

    const seekAdjustmentMs = phaseShiftBeats * 60000 / ownTrackBpm;
    const lastSafeMs = this.durationMs > 0 ? Math.max(0, this.durationMs - 50) : Number.MAX_SAFE_INTEGER;
    const alignedTimeMs = clamp(this.currentTimeMs + seekAdjustmentMs, 0, lastSafeMs);

    this.setPitch(nextPitch);
    this.seekTo(alignedTimeMs);

    return { success: true, reason: pitchLimited ? 'pitch-limit' : 'synced' };
  }

  setCrossfadeVolume(gain: number) {
    this.crossfadeVolume = clamp(gain, 0, 1);
    if (this.crossfadeGain && this.ctx) {
      this.crossfadeGain.gain.setTargetAtTime(this.crossfadeVolume, this.ctx.currentTime, 0.02);
    }
  }

  setDeckVolume(volume: number) {
    this.volume = clamp(volume, 0, 1);
    if (this.deckGain && this.ctx) {
      this.deckGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.015);
    }
    this.notify();
  }

  setEffect(effect: DJEffectType) {
    this.activeEffect = effect;
    this.applyPitchAndEffect();
    this.notify();
  }

  setFxAmount(amount: number) {
    this.fxAmount = clamp(amount, 0, 1);
    this.applyPitchAndEffect();
    this.notify();
  }

  private applyPitchAndEffect() {
    const amount = clamp(this.fxAmount, 0, 1);
    const voiceRate = VOICE_RATE[this.activeEffect];
    const effectiveRate = this.pitch * (voiceRate ? 1 + (voiceRate - 1) * amount : 1);
    this.audioElement.playbackRate = clamp(effectiveRate, 0.25, 2.5);

    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.filterNode) {
      this.filterNode.type = 'allpass';
      this.filterNode.frequency.setTargetAtTime(1000, now, 0.03);
      this.filterNode.Q.setTargetAtTime(0.0001, now, 0.03);
      this.filterNode.gain.setTargetAtTime(0, now, 0.03);

      switch (this.activeEffect) {
        case 'fx_filter':
          this.filterNode.type = 'lowpass';
          this.filterNode.frequency.setTargetAtTime(250 + Math.pow(amount, 2) * 18500, now, 0.03);
          this.filterNode.Q.setTargetAtTime(0.7 + amount * 8, now, 0.03);
          break;
        case 'fx_flanger':
          this.filterNode.type = 'allpass';
          this.filterNode.frequency.setTargetAtTime(600 + amount * 5000, now, 0.03);
          this.filterNode.Q.setTargetAtTime(0.5 + amount * 5, now, 0.03);
          break;
        case 'fx_phaser':
          this.filterNode.type = 'allpass';
          this.filterNode.frequency.setTargetAtTime(350 + amount * 4500, now, 0.03);
          this.filterNode.Q.setTargetAtTime(0.5 + amount * 8, now, 0.03);
          break;
        case 'fx_distortion':
          this.filterNode.type = 'peaking';
          this.filterNode.frequency.setTargetAtTime(1000, now, 0.03);
          this.filterNode.Q.setTargetAtTime(1, now, 0.03);
          this.filterNode.gain.setTargetAtTime(amount * 7, now, 0.03);
          break;
        case 'fx_bitcrush':
          this.filterNode.type = 'lowpass';
          this.filterNode.frequency.setTargetAtTime(900 + (1 - amount) * 6500, now, 0.03);
          this.filterNode.Q.setTargetAtTime(0.8, now, 0.03);
          break;
        case 'voice_monster':
        case 'voice_demon':
          this.filterNode.type = 'lowshelf';
          this.filterNode.frequency.setTargetAtTime(220, now, 0.03);
          this.filterNode.gain.setTargetAtTime(4 + amount * 12, now, 0.03);
          break;
        case 'voice_giant':
          this.filterNode.type = 'lowshelf';
          this.filterNode.frequency.setTargetAtTime(180, now, 0.03);
          this.filterNode.gain.setTargetAtTime(2 + amount * 9, now, 0.03);
          break;
        case 'voice_woman':
        case 'voice_kid':
        case 'voice_chipmunk':
          this.filterNode.type = 'highshelf';
          this.filterNode.frequency.setTargetAtTime(1800, now, 0.03);
          this.filterNode.gain.setTargetAtTime(2 + amount * 6, now, 0.03);
          break;
        default:
          break;
      }
    }

    if (this.waveshaperNode) {
      let distortion = 0;
      if (this.activeEffect === 'fx_distortion') distortion = amount * 500;
      else if (this.activeEffect === 'fx_bitcrush') distortion = 40 + amount * 230;
      else if (this.activeEffect === 'voice_monster' || this.activeEffect === 'voice_demon') distortion = amount * 210;
      else if (this.activeEffect === 'voice_giant') distortion = amount * 100;
      this.waveshaperNode.curve = this.makeDistortionCurve(distortion);
    }

    if (this.compressorNode) {
      const active = this.activeEffect === 'fx_compressor';
      this.compressorNode.threshold.setTargetAtTime(active ? -20 - amount * 35 : -18, now, 0.03);
      this.compressorNode.knee.setTargetAtTime(active ? 8 : 20, now, 0.03);
      this.compressorNode.ratio.setTargetAtTime(active ? 3 + amount * 12 : 3, now, 0.03);
      this.compressorNode.attack.setTargetAtTime(active ? 0.003 : 0.015, now, 0.03);
      this.compressorNode.release.setTargetAtTime(active ? 0.12 + amount * 0.35 : 0.25, now, 0.03);
    }

    if (this.delayNode && this.delayFeedback && this.delayWetGain && this.delayLfo && this.delayLfoGain) {
      const isDelay = this.activeEffect === 'fx_delay';
      const isFlanger = this.activeEffect === 'fx_flanger';
      const isPhaser = this.activeEffect === 'fx_phaser';
      const delayBase = isDelay ? 0.08 + amount * 0.42 : isFlanger ? 0.006 : isPhaser ? 0.014 : 0.12;
      const wet = isDelay ? amount * 0.55 : isFlanger ? amount * 0.42 : isPhaser ? amount * 0.32 : 0;
      const feedback = isDelay ? amount * 0.62 : isFlanger ? amount * 0.3 : isPhaser ? amount * 0.18 : 0;

      this.delayNode.delayTime.setTargetAtTime(delayBase, now, 0.025);
      this.delayWetGain.gain.setTargetAtTime(wet, now, 0.025);
      this.delayFeedback.gain.setTargetAtTime(feedback, now, 0.025);
      this.delayLfo.frequency.setTargetAtTime(isFlanger ? 0.15 + amount * 3.5 : isPhaser ? 0.18 + amount * 1.2 : 0.25, now, 0.025);
      this.delayLfoGain.gain.setTargetAtTime(isFlanger ? 0.001 + amount * 0.006 : isPhaser ? 0.0002 + amount * 0.0015 : 0, now, 0.025);
    }

    if (this.reverbWetGain) {
      this.reverbWetGain.gain.setTargetAtTime(this.activeEffect === 'fx_reverb' ? amount * 0.68 : 0, now, 0.04);
    }
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const sampleCount = 44100;
    const curve = new Float32Array(new ArrayBuffer(sampleCount * 4));
    const k = Math.max(0, amount);
    const deg = Math.PI / 180;
    for (let i = 0; i < sampleCount; i += 1) {
      const x = (i * 2) / sampleCount - 1;
      curve[i] = k === 0
        ? x
        : ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }


  private resetBpmDetection(): void {
    this.stopBpmDetection();
    this.currentBpm = null;
    this.bpmConfidence = 0;
    this.bpmSamples = [];
    this.bpmCandidate = null;
    this.bpmCandidateHits = 0;
    this.bpmLastSampleAt = 0;
    this.bpmLastEvaluationAt = 0;
    this.bpmSampleIntervalMs = 50;
    if (this.bpmPreviousSpectrum.length !== (this.bpmAnalyser?.frequencyBinCount || 0)) {
      this.bpmPreviousSpectrum = new Uint8Array(this.bpmAnalyser?.frequencyBinCount || 0);
    } else {
      this.bpmPreviousSpectrum.fill(0);
    }
  }

  private startBpmDetection(): void {
    if (!this.bpmAnalyser || this.bpmFrameId !== null || !this.currentTrack) return;
    this.bpmLastSampleAt = 0;
    this.bpmFrameId = window.requestAnimationFrame(this.sampleBpmFrame);
  }

  private stopBpmDetection(): void {
    if (this.bpmFrameId !== null) {
      window.cancelAnimationFrame(this.bpmFrameId);
      this.bpmFrameId = null;
    }
    this.bpmLastSampleAt = 0;
  }

  /**
   * Real-time beat tracking using positive spectral flux and an onset-envelope
   * autocorrelation. It needs no song metadata and updates once per second after
   * enough live audio has been observed.
   */
  private sampleBpmFrame = (timestamp: number): void => {
    this.bpmFrameId = null;
    if (!this.isPlaying || !this.bpmAnalyser || !this.ctx) return;

    if (this.bpmLastSampleAt === 0) {
      this.bpmLastSampleAt = timestamp;
      this.bpmFrameId = window.requestAnimationFrame(this.sampleBpmFrame);
      return;
    }

    const elapsedMs = timestamp - this.bpmLastSampleAt;
    if (elapsedMs < 45) {
      this.bpmFrameId = window.requestAnimationFrame(this.sampleBpmFrame);
      return;
    }

    this.bpmLastSampleAt = timestamp;
    this.bpmSampleIntervalMs = this.bpmSamples.length === 0
      ? elapsedMs
      : this.bpmSampleIntervalMs * 0.8 + elapsedMs * 0.2;

    const spectrum = new Uint8Array(this.bpmAnalyser.frequencyBinCount);
    this.bpmAnalyser.getByteFrequencyData(spectrum);

    // Positive spectral flux emphasizes new percussive energy instead of the
    // sustained tonal energy that otherwise dominates a music spectrum.
    const firstBin = 3;
    const lastBin = Math.min(
      spectrum.length - 1,
      Math.floor(2400 * this.bpmAnalyser.fftSize / (this.ctx.sampleRate || 44100)),
    );
    let flux = 0;
    let activeBins = 0;
    for (let bin = firstBin; bin <= lastBin; bin += 1) {
      const increase = spectrum[bin] - (this.bpmPreviousSpectrum[bin] || 0);
      if (increase > 0) flux += increase;
      activeBins += 1;
    }
    this.bpmPreviousSpectrum = spectrum;
    this.bpmSamples.push(activeBins > 0 ? flux / activeBins : 0);

    // Keep around 16 seconds for a stable tempo estimate without unbounded memory.
    if (this.bpmSamples.length > 320) this.bpmSamples.shift();

    if (
      this.bpmSamples.length >= 100 &&
      (this.bpmLastEvaluationAt === 0 || timestamp - this.bpmLastEvaluationAt >= 1000)
    ) {
      this.bpmLastEvaluationAt = timestamp;
      this.estimateBpmFromOnsets();
    }

    this.bpmFrameId = window.requestAnimationFrame(this.sampleBpmFrame);
  };

  private estimateBpmFromOnsets(): void {
    const samples = this.bpmSamples;
    if (samples.length < 100) return;

    const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
    let variance = 0;
    for (const value of samples) variance += (value - mean) ** 2;
    variance /= samples.length;

    // Silence or near-constant ambience has no reliable beat envelope.
    if (variance < 0.08) {
      this.bpmConfidence = 0;
      this.notify();
      return;
    }

    const intervalMs = Math.max(40, Math.min(90, this.bpmSampleIntervalMs));
    const minLag = Math.max(2, Math.floor(60000 / (200 * intervalMs)));
    const maxLag = Math.min(samples.length >> 1, Math.ceil(60000 / (60 * intervalMs)));
    let bestLag = 0;
    let bestCorrelation = -1;

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let dot = 0;
      let leftEnergy = 0;
      let rightEnergy = 0;
      for (let index = lag; index < samples.length; index += 1) {
        const left = samples[index] - mean;
        const right = samples[index - lag] - mean;
        dot += left * right;
        leftEnergy += left * left;
        rightEnergy += right * right;
      }
      const denominator = Math.sqrt(leftEnergy * rightEnergy);
      const correlation = denominator > 0 ? dot / denominator : 0;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }

    this.bpmConfidence = Math.max(0, bestCorrelation);
    if (bestLag === 0 || bestCorrelation < 0.12) {
      this.notify();
      return;
    }

    const detectedBpm = Math.round(60000 / (bestLag * intervalMs));
    if (!Number.isFinite(detectedBpm) || detectedBpm < 60 || detectedBpm > 200) {
      this.notify();
      return;
    }

    if (this.currentBpm === null) {
      this.currentBpm = detectedBpm;
      this.bpmCandidate = null;
      this.bpmCandidateHits = 0;
    } else if (Math.abs(detectedBpm - this.currentBpm) <= 4) {
      // Smooth small estimate fluctuations, so the deck display doesn't flicker.
      this.currentBpm = Math.round(this.currentBpm * 0.65 + detectedBpm * 0.35);
      this.bpmCandidate = null;
      this.bpmCandidateHits = 0;
    } else {
      if (this.bpmCandidate !== null && Math.abs(detectedBpm - this.bpmCandidate) <= 3) {
        this.bpmCandidate = Math.round(this.bpmCandidate * 0.5 + detectedBpm * 0.5);
        this.bpmCandidateHits += 1;
      } else {
        this.bpmCandidate = detectedBpm;
        this.bpmCandidateHits = 1;
      }
      // Require repeated evidence before replacing a stable reading.
      if (this.bpmCandidateHits >= 3) {
        this.currentBpm = this.bpmCandidate;
        this.bpmCandidate = null;
        this.bpmCandidateHits = 0;
      }
    }

    this.notify();
  }

  get currentTimeMs(): number {
    return (this.audioElement.currentTime || 0) * 1000;
  }

  get durationMs(): number {
    return (this.audioElement.duration || 0) * 1000;
  }

  getVisualizerData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(128);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  subscribe(callback: () => void): () => void {
    this.onUpdateCallbacks.push(callback);
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter((registered) => registered !== callback);
    };
  }

  private notify() {
    this.onUpdateCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn('DJ deck subscriber failed:', error);
      }
    });
  }
}

export const deckAEngine = new DJDeckEngine('DECK A');
export const deckBEngine = new DJDeckEngine('DECK B');