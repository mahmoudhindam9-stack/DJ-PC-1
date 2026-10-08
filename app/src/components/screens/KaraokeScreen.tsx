import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Settings,
  Circle,
  Square,
  Volume2,
  Sparkles,
  Sliders,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ThemeColors, MicFilterType, BeatFxDivision } from '../../types';
import { micEngine } from '../../audio/MicEngine';

interface KaraokeScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
}

export const KaraokeScreen: React.FC<KaraokeScreenProps> = ({ themeColors, isArabic }) => {
  const [isMicEnabled, setIsMicEnabled] = useState(micEngine.isMicEnabled);
  const [isRecording, setIsRecording] = useState(micEngine.isRecording);
  const [recordingSeconds, setRecordingSeconds] = useState(micEngine.recordingSeconds);
  const [micVolume, setMicVolume] = useState(micEngine.micVolume);
  const [echoLevel, setEchoLevel] = useState(micEngine.echoLevel);
  const [reverbLevel, setReverbLevel] = useState(micEngine.reverbLevel);
  const [flangerMix, setFlangerMix] = useState(micEngine.flangerMix);
  const [currentFilter, setCurrentFilter] = useState<MicFilterType>(micEngine.currentFilter);
  const [bpm, setBpm] = useState(micEngine.bpm);
  const [beatDivision, setBeatDivision] = useState<BeatFxDivision>(micEngine.beatDivision);
  const [voiceProcessing, setVoiceProcessing] = useState(micEngine.voiceProcessing);
  const [devices, setDevices] = useState(micEngine.inputDevices);
  const [selectedDevice, setSelectedDevice] = useState(micEngine.selectedDeviceId);
  const [vuLevel, setVuLevel] = useState(0);

  useEffect(() => {
    const unsub = micEngine.subscribe(() => {
      setIsMicEnabled(micEngine.isMicEnabled);
      setIsRecording(micEngine.isRecording);
      setRecordingSeconds(micEngine.recordingSeconds);
      setMicVolume(micEngine.micVolume);
      setEchoLevel(micEngine.echoLevel);
      setReverbLevel(micEngine.reverbLevel);
      setFlangerMix(micEngine.flangerMix);
      setCurrentFilter(micEngine.currentFilter);
      setBpm(micEngine.bpm);
      setBeatDivision(micEngine.beatDivision);
      setVoiceProcessing(micEngine.voiceProcessing);
      setDevices(micEngine.inputDevices);
      setSelectedDevice(micEngine.selectedDeviceId);
    });

    // VU meter polling loop
    let animId: number;
    const pollVu = () => {
      if (micEngine.isMicEnabled) {
        setVuLevel(micEngine.getVuLevel());
      } else {
        setVuLevel(0);
      }
      animId = requestAnimationFrame(pollVu);
    };
    pollVu();

    return () => {
      unsub();
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleToggleMic = async () => {
    await micEngine.toggleMic();
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      micEngine.stopRecordingAndDownload();
    } else {
      micEngine.startRecording();
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filterList: Array<{ id: MicFilterType; name: string }> = [
    { id: 'NONE', name: 'Original / Bypass' },
    { id: 'WARM', name: 'Warm Vocal' },
    { id: 'BRIGHT', name: 'Bright Treble' },
    { id: 'TELEPHONE', name: 'Old Phone' },
    { id: 'ROBOT', name: 'Cyber Robot' },
    { id: 'RADIO', name: 'FM Broadcast' },
    { id: 'CLUB', name: 'Club Stage' },
    { id: 'MEGAPHONE', name: 'Megaphone' },
  ];

  return (
    <div
      id="karaoke-screen"
      className="flex-1 flex flex-col h-full overflow-y-auto select-none p-4 space-y-4"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.textPrimary,
      }}
    >
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mic className="w-6 h-6" style={{ color: themeColors.primary }} />
          <div>
            <h1 className="text-lg font-black tracking-wide">
              {isArabic ? 'استوديو الكاريوكي والصوت المباشر' : 'KARAOKE & LIVE VOCAL STUDIO'}
            </h1>
            <p className="text-xs" style={{ color: themeColors.textMuted }}>
              Real-time Hardware Mic Monitoring, Vocal Effects & Recording
            </p>
          </div>
        </div>

        {/* Input Hardware Selection */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => micEngine.refreshDevices()}
            className="p-1.5 rounded-xl border hover:bg-white/5"
            style={{ borderColor: themeColors.border }}
            title="Refresh Microphones"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <select
            value={selectedDevice || ''}
            onChange={(e) => micEngine.selectDevice(e.target.value || null)}
            className="px-2.5 py-1.5 rounded-xl border text-xs outline-none max-w-xs truncate"
            style={{
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
              color: themeColors.textPrimary,
            }}
          >
            <option value="">Default System Microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.substring(0, 5)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Live Monitor Hero Card */}
      <div
        className="p-6 rounded-2xl border shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: isMicEnabled ? themeColors.primary : themeColors.border,
        }}
      >
        <div className="flex items-center gap-5">
          {/* Big Mic Toggle Circle */}
          <button
            onClick={handleToggleMic}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${
              isMicEnabled ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: isMicEnabled ? themeColors.primary : themeColors.surfaceVariant,
              color: isMicEnabled ? '#ffffff' : themeColors.textMuted,
            }}
            title={isMicEnabled ? 'Mute Microphone' : 'Enable Microphone'}
          >
            {isMicEnabled ? <Mic className="w-9 h-9" /> : <MicOff className="w-9 h-9" />}
          </button>

          <div>
            <span
              className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded"
              style={{
                backgroundColor: isMicEnabled ? `${themeColors.primary}25` : themeColors.surfaceVariant,
                color: isMicEnabled ? themeColors.primary : themeColors.textMuted,
              }}
            >
              {isMicEnabled
                ? isArabic
                  ? 'الميكروفون قيد التشغيل المباشر'
                  : 'LIVE MONITOR ACTIVE'
                : isArabic
                ? 'الميكروفون مغلق'
                : 'MONITOR MUTED'}
            </span>
            <h2 className="text-base font-bold mt-1">
              {isMicEnabled
                ? isArabic
                  ? 'الصوت ينتقل مباشرة إلى السماعات'
                  : 'Vocal signal routed to master output'
                : isArabic
                ? 'اضغط على زر الميكروفون للبدء'
                : 'Click mic icon to activate live feedback'}
            </h2>
          </div>
        </div>

        {/* Live VU Level Meter & Recording Button */}
        <div className="flex flex-col items-center sm:items-end gap-3 w-full sm:w-auto">
          {/* VU Level Bar */}
          <div className="flex items-center gap-2 w-full sm:w-48">
            <span className="text-[10px] font-mono opacity-60">VU:</span>
            <div
              className="flex-1 h-3 rounded-full overflow-hidden border p-0.5"
              style={{
                backgroundColor: themeColors.surfaceVariant,
                borderColor: themeColors.border,
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${vuLevel}%`,
                  backgroundColor:
                    vuLevel > 80 ? '#ff1744' : vuLevel > 50 ? '#ffab00' : themeColors.primary,
                }}
              />
            </div>
            <span className="text-[10px] font-mono w-8 text-right opacity-80">{vuLevel}%</span>
          </div>

          {/* Recording Button */}
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="text-xs font-mono font-bold text-red-500 animate-pulse">
                REC {formatTimer(recordingSeconds)}
              </span>
            )}
            <button
              onClick={handleToggleRecord}
              disabled={!isMicEnabled}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                !isMicEnabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isRecording
                  ? 'bg-red-500 text-white border-red-400'
                  : 'hover:bg-white/5'
              }`}
              style={{
                borderColor: isRecording ? '#ff1744' : themeColors.border,
              }}
            >
              {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />}
              <span>
                {isRecording
                  ? isArabic
                    ? 'إيقاف وحفظ التسجيل'
                    : 'Stop & Save'
                  : isArabic
                  ? 'بدء تسجيل الأداء'
                  : 'Record Performance'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Vocal Effect Filters Chips */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        <span className="text-xs font-bold tracking-wider opacity-70">
          {isArabic ? 'تأثيرات الصوت (VOCAL CHARACTER PRESETS)' : 'VOCAL CHARACTER PRESETS'}
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {filterList.map((f) => {
            const isSel = currentFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => micEngine.setFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold border whitespace-nowrap transition-all ${
                  isSel ? 'shadow-sm font-bold' : 'hover:bg-white/5 opacity-70'
                }`}
                style={{
                  backgroundColor: isSel ? themeColors.primary : themeColors.surfaceVariant,
                  borderColor: isSel ? themeColors.primary : themeColors.border,
                  color: isSel ? '#ffffff' : themeColors.textPrimary,
                }}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* DSP Mixing Sliders: Mic Volume, Echo, Reverb, Flanger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mic Volume */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" style={{ color: themeColors.primary }} />
              {isArabic ? 'مستوى صوت المايك' : 'MIC GAIN'}
            </span>
            <span className="font-mono">{Math.round(micVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={2.0}
            step={0.05}
            value={micVolume}
            onChange={(e) => micEngine.setMicVolume(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.primary,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>

        {/* Echo Level */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.secondary }} />
              {isArabic ? 'صدى الصوت (ECHO)' : 'ECHO DELAY'}
            </span>
            <span className="font-mono">{Math.round(echoLevel * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.01}
            value={echoLevel}
            onChange={(e) => micEngine.setEchoLevel(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.secondary,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>

        {/* Reverb Level */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" style={{ color: themeColors.tertiary }} />
              {isArabic ? 'تردد الغرفة (REVERB)' : 'CONVOLUTION REVERB'}
            </span>
            <span className="font-mono">{Math.round(reverbLevel * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.01}
            value={reverbLevel}
            onChange={(e) => micEngine.setReverbLevel(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.tertiary,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>

        {/* Flanger Mix */}
        <div
          className="p-4 rounded-2xl border shadow-lg flex flex-col gap-2"
          style={{
            backgroundColor: themeColors.surface,
            borderColor: themeColors.border,
          }}
        >
          <div className="flex justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" style={{ color: themeColors.accentB }} />
              {isArabic ? 'تأثير الفلانجر (FLANGER)' : 'FLANGER MIX'}
            </span>
            <span className="font-mono">{Math.round(flangerMix * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.01}
            value={flangerMix}
            onChange={(e) => micEngine.setFlangerMix(Number(e.target.value))}
            className="w-full h-2 rounded appearance-none cursor-pointer"
            style={{
              accentColor: themeColors.accentB,
              backgroundColor: themeColors.surfaceVariant,
            }}
          />
        </div>
      </div>

      {/* Beat FX & Voice Processing Toggles */}
      <div
        className="p-4 rounded-2xl border shadow-lg flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        }}
      >
        {/* BPM & Division */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold opacity-70">BEAT SYNC:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono">{bpm} BPM</span>
            <input
              type="range"
              min={70}
              max={180}
              value={bpm}
              onChange={(e) => micEngine.setBpm(Number(e.target.value))}
              className="w-24 h-1.5 rounded appearance-none cursor-pointer"
              style={{
                accentColor: themeColors.primary,
                backgroundColor: themeColors.surfaceVariant,
              }}
            />
          </div>

          <div className="flex items-center gap-1">
            {(['1/1', '1/2', '1/4', '1/8', '3/4'] as BeatFxDivision[]).map((d) => (
              <button
                key={d}
                onClick={() => micEngine.setBeatDivision(d)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-bold border ${
                  beatDivision === d ? 'shadow-sm' : 'opacity-60'
                }`}
                style={{
                  backgroundColor: beatDivision === d ? themeColors.primary : 'transparent',
                  borderColor: beatDivision === d ? themeColors.primary : themeColors.border,
                  color: beatDivision === d ? '#ffffff' : themeColors.textPrimary,
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Acoustic Echo Cancellation & Noise Suppression */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={voiceProcessing}
              onChange={(e) => micEngine.toggleVoiceProcessing(e.target.checked)}
              className="rounded"
              style={{ accentColor: themeColors.primary }}
            />
            <span>{isArabic ? 'إلغاء الصدى والضجيج التلقائي (AEC)' : 'Hardware Echo & Noise Suppression'}</span>
          </label>
        </div>
      </div>
    </div>
  );
};
