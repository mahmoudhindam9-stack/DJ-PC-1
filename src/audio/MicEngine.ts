import { MicFilterType, BeatFxDivision } from '../types';

export class MicEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Nodes
  private inputGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private echoDelay: DelayNode | null = null;
  private echoFeedback: GainNode | null = null;
  private echoWetGain: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private flangerDelay: DelayNode | null = null;
  private flangerWetGain: GainNode | null = null;
  private masterOutputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // MediaRecorder for recording processed vocals
  private recorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingTimer: number | null = null;

  // State
  public isMicEnabled = false;
  public isRecording = false;
  public recordingSeconds = 0;
  public micVolume = 1.0; // 0 to 2.0
  public echoLevel = 0.2; // 0 to 1.0
  public reverbLevel = 0.25; // 0 to 1.0
  public flangerMix = 0.0; // 0 to 1.0
  public filterMix = 0.0; // 0 to 1.0
  public currentFilter: MicFilterType = 'NONE';
  public bpm = 120;
  public beatDivision: BeatFxDivision = '1/4';
  public voiceProcessing = true; // AEC & noise suppression
  public inputDevices: MediaDeviceInfo[] = [];
  public selectedDeviceId: string | null = null;

  private onUpdateCallbacks: Array<() => void> = [];

  constructor() {
    this.refreshDevices();
  }

  async refreshDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.inputDevices = devices.filter((d) => d.kind === 'audioinput');
        this.notify();
      }
    } catch (e) {
      console.warn('Device enumeration note:', e);
    }
    return this.inputDevices;
  }

  async toggleMic(enable?: boolean): Promise<boolean> {
    const targetState = enable !== undefined ? enable : !this.isMicEnabled;
    if (targetState === this.isMicEnabled) return this.isMicEnabled;

    if (targetState) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
        if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }

        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
            echoCancellation: this.voiceProcessing,
            noiseSuppression: this.voiceProcessing,
            autoGainControl: false,
          },
        };

        this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.setupAudioChain(this.ctx, this.micStream);
        this.isMicEnabled = true;
        this.notify();
        return true;
      } catch (err) {
        console.error('Failed to open microphone:', err);
        this.isMicEnabled = false;
        this.notify();
        return false;
      }
    } else {
      this.cleanupMic();
      this.isMicEnabled = false;
      this.notify();
      return false;
    }
  }

  private setupAudioChain(ctx: AudioContext, stream: MediaStream) {
    this.micSource = ctx.createMediaStreamSource(stream);

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = this.micVolume;

    // Filter node for vocal character
    this.filterNode = ctx.createBiquadFilter();
    this.applyVocalFilter();

    // Echo / Delay chain
    this.echoDelay = ctx.createDelay(2.0);
    this.setDelayTimeFromBpm();

    this.echoFeedback = ctx.createGain();
    this.echoFeedback.gain.value = 0.4;
    this.echoWetGain = ctx.createGain();
    this.echoWetGain.gain.value = this.echoLevel;

    this.echoDelay.connect(this.echoFeedback);
    this.echoFeedback.connect(this.echoDelay);
    this.echoDelay.connect(this.echoWetGain);

    // Algorithmic impulse reverb
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this.buildReverbImpulse(ctx, 1.8, 2.0);
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = this.reverbLevel;
    this.reverbConvolver.connect(this.reverbWetGain);

    // Flanger
    this.flangerDelay = ctx.createDelay(0.05);
    this.flangerDelay.delayTime.value = 0.003;
    this.flangerWetGain = ctx.createGain();
    this.flangerWetGain.gain.value = this.flangerMix;
    this.flangerDelay.connect(this.flangerWetGain);

    // Output gain & analyser
    this.masterOutputGain = ctx.createGain();
    this.masterOutputGain.gain.value = 1.0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 64;

    // Graph routing:
    // micSource -> inputGain -> filterNode
    this.micSource.connect(this.inputGain);
    this.inputGain.connect(this.filterNode);

    // filterNode connects to Dry, Echo, Reverb, Flanger
    this.filterNode.connect(this.masterOutputGain); // Dry
    this.filterNode.connect(this.echoDelay); // Send to echo
    this.filterNode.connect(this.reverbConvolver); // Send to reverb
    this.filterNode.connect(this.flangerDelay); // Send to flanger

    this.echoWetGain.connect(this.masterOutputGain);
    this.reverbWetGain.connect(this.masterOutputGain);
    this.flangerWetGain.connect(this.masterOutputGain);

    this.masterOutputGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  private buildReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      left[i] = n;
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }

  private setDelayTimeFromBpm() {
    if (!this.echoDelay || !this.ctx) return;
    const beatSeconds = 60 / this.bpm;
    let multiplier = 0.25;
    switch (this.beatDivision) {
      case '1/1':
        multiplier = 1.0;
        break;
      case '1/2':
        multiplier = 0.5;
        break;
      case '1/4':
        multiplier = 0.25;
        break;
      case '1/8':
        multiplier = 0.125;
        break;
      case '3/4':
        multiplier = 0.75;
        break;
    }
    const delayTime = Math.max(0.05, Math.min(1.8, beatSeconds * multiplier));
    this.echoDelay.delayTime.setTargetAtTime(delayTime, this.ctx.currentTime, 0.05);
  }

  public applyVocalFilter() {
    if (!this.filterNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    switch (this.currentFilter) {
      case 'WARM':
        this.filterNode.type = 'lowshelf';
        this.filterNode.frequency.setTargetAtTime(300, now, 0.05);
        this.filterNode.gain.setTargetAtTime(5, now, 0.05);
        break;
      case 'BRIGHT':
        this.filterNode.type = 'highshelf';
        this.filterNode.frequency.setTargetAtTime(3500, now, 0.05);
        this.filterNode.gain.setTargetAtTime(6, now, 0.05);
        break;
      case 'TELEPHONE':
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.setTargetAtTime(1400, now, 0.05);
        this.filterNode.Q.setTargetAtTime(2.5, now, 0.05);
        break;
      case 'ROBOT':
      case 'RADIO':
        this.filterNode.type = 'peaking';
        this.filterNode.frequency.setTargetAtTime(2200, now, 0.05);
        this.filterNode.gain.setTargetAtTime(8, now, 0.05);
        break;
      case 'MEGAPHONE':
        this.filterNode.type = 'highpass';
        this.filterNode.frequency.setTargetAtTime(650, now, 0.05);
        break;
      case 'CLUB':
        this.filterNode.type = 'peaking';
        this.filterNode.frequency.setTargetAtTime(120, now, 0.05);
        this.filterNode.gain.setTargetAtTime(7, now, 0.05);
        break;
      default:
        this.filterNode.type = 'allpass';
        break;
    }
  }

  setMicVolume(vol: number) {
    this.micVolume = Math.max(0, Math.min(2.0, vol));
    if (this.inputGain && this.ctx) {
      this.inputGain.gain.setTargetAtTime(this.micVolume, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  setEchoLevel(level: number) {
    this.echoLevel = Math.max(0, Math.min(1.0, level));
    if (this.echoWetGain && this.ctx) {
      this.echoWetGain.gain.setTargetAtTime(this.echoLevel, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  setReverbLevel(level: number) {
    this.reverbLevel = Math.max(0, Math.min(1.0, level));
    if (this.reverbWetGain && this.ctx) {
      this.reverbWetGain.gain.setTargetAtTime(this.reverbLevel, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  setFlangerMix(mix: number) {
    this.flangerMix = Math.max(0, Math.min(1.0, mix));
    if (this.flangerWetGain && this.ctx) {
      this.flangerWetGain.gain.setTargetAtTime(this.flangerMix, this.ctx.currentTime, 0.02);
    }
    this.notify();
  }

  setFilter(filter: MicFilterType) {
    this.currentFilter = filter;
    this.applyVocalFilter();
    this.notify();
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(70, Math.min(180, bpm));
    this.setDelayTimeFromBpm();
    this.notify();
  }

  setBeatDivision(div: BeatFxDivision) {
    this.beatDivision = div;
    this.setDelayTimeFromBpm();
    this.notify();
  }

  toggleVoiceProcessing(enable: boolean) {
    this.voiceProcessing = enable;
    if (this.isMicEnabled) {
      // reinit stream
      this.toggleMic(false).then(() => this.toggleMic(true));
    }
    this.notify();
  }

  selectDevice(deviceId: string | null) {
    this.selectedDeviceId = deviceId;
    if (this.isMicEnabled) {
      this.toggleMic(false).then(() => this.toggleMic(true));
    }
    this.notify();
  }

  // --- RECORDING ---
  startRecording(): boolean {
    if (!this.micStream) return false;
    try {
      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.recorder = new MediaRecorder(this.micStream, { mimeType });
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.recorder.start(250);
      this.isRecording = true;
      this.recordingSeconds = 0;

      if (this.recordingTimer) clearInterval(this.recordingTimer);
      this.recordingTimer = window.setInterval(() => {
        this.recordingSeconds++;
        this.notify();
      }, 1000);

      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to start recording:', e);
      return false;
    }
  }

  stopRecordingAndDownload(filenamePrefix = 'Karaoke_Recording'): void {
    if (!this.recorder || !this.isRecording) return;

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    this.recorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `${filenamePrefix}_${timestamp}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      this.isRecording = false;
      this.recordingSeconds = 0;
      this.notify();
    };

    this.recorder.stop();
  }

  getVuLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return Math.min(100, Math.round((sum / (data.length * 255)) * 100 * 1.5));
  }

  private cleanupMic() {
    if (this.isRecording) {
      this.stopRecordingAndDownload();
    }
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.micSource = null;
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

export const micEngine = new MicEngine();
