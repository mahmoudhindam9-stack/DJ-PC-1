import React, { useEffect, useState } from 'react';
import {
  AudioLines, Check, Clock3, Download, Headphones, KeyRound,
  Loader2, Music2, Play, Save, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { AudioItem, ThemeColors } from '../../types';
import { generateLyriaMusic, type LyriaModel } from '../../services/LyriaMusicService';

interface AIMusicStudioScreenProps {
  themeColors: ThemeColors;
  isArabic: boolean;
  onPlayGeneratedTrack: (track: AudioItem) => void;
  onSendToDeckA: (track: AudioItem) => void;
  onSendToDeckB: (track: AudioItem) => void;
  onSaveToLibrary: (track: AudioItem) => Promise<void>;
}

const KEY_STORAGE = 'dj-lyria-api-key-v1';
const GENRES = ['Electronic / EDM', 'Arabic Pop', 'Hip-Hop', 'Cinematic Orchestral', 'Lo-fi / Chill', 'Rock', 'Jazz / Soul', 'Afrobeats', 'Ambient'];
const MOODS = ['Energetic', 'Uplifting', 'Dark', 'Romantic', 'Dreamy', 'Epic', 'Relaxed', 'Mysterious'];

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([buffer], { type: mimeType || 'audio/mpeg' });
}

export const AIMusicStudioScreen: React.FC<AIMusicStudioScreenProps> = ({
  themeColors, isArabic, onPlayGeneratedTrack, onSendToDeckA, onSendToDeckB, onSaveToLibrary,
}) => {
  const [apiKey, setApiKey] = useState(() => {
    try { return window.localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
  });
  const [rememberKey, setRememberKey] = useState(() => {
    try { return Boolean(window.localStorage.getItem(KEY_STORAGE)); } catch { return false; }
  });
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState<LyriaModel>('lyria-3.5');
  const [trackTitle, setTrackTitle] = useState('Midnight Drive');
  const [description, setDescription] = useState('A polished modern club track with a memorable hook, clean low end, tight percussion, evolving synth textures and a professional mix. Build tension, deliver a confident drop, and finish with a smooth outro.');
  const [genre, setGenre] = useState('Electronic / EDM');
  const [mood, setMood] = useState('Energetic');
  const [bpm, setBpm] = useState(124);
  const [vocalMode, setVocalMode] = useState<'instrumental' | 'generated' | 'custom'>('instrumental');
  const [customLyrics, setCustomLyrics] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generatedTrack, setGeneratedTrack] = useState<AudioItem | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState('');
  const [saved, setSaved] = useState(false);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const accent = themeColors.primary;
  const card = themeColors.surface;
  const panel = themeColors.surfaceVariant;
  const border = themeColors.border;
  const muted = themeColors.textMuted;
  const fg = themeColors.textPrimary;

  useEffect(() => {
    try {
      if (rememberKey && apiKey.trim()) window.localStorage.setItem(KEY_STORAGE, apiKey.trim());
      else window.localStorage.removeItem(KEY_STORAGE);
    } catch { /* Only persist the key when explicitly requested. */ }
  }, [apiKey, rememberKey]);

  const buildPrompt = (): string => {
    const parts = [
      'Genre: ' + genre + '.',
      'Mood: ' + mood + '.',
      'Target tempo: approximately ' + bpm + ' BPM.',
      description.trim(),
    ];
    if (vocalMode === 'instrumental') parts.push('Instrumental only. No vocals and no lyrics.');
    else if (vocalMode === 'generated') parts.push('Include original generated vocals and lyrics that fit the mood and genre. Do not imitate a specific existing singer.');
    else parts.push('Use these original lyrics as the lyrical source, with clear Verse, Chorus, and Outro sections:\n' + customLyrics.trim());
    parts.push(model === 'lyria-3-clip-preview'
      ? 'Create a complete 30-second musical clip with a clear hook and a clean ending.'
      : 'Create a full song around 2 minutes long with a clear intro, verse, chorus, development and satisfying outro.');
    return parts.join('\n\n');
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    if (!apiKey.trim()) {
      setErrorMessage(isArabic ? 'أدخل مفتاح Gemini API لتشغيل Lyria.' : 'Enter your Gemini API key to use Lyria.');
      return;
    }
    if (description.trim().length < 12) {
      setErrorMessage(isArabic ? 'اكتب وصفًا أوضح للموسيقى المطلوبة.' : 'Describe the music you want in more detail.');
      return;
    }
    if (vocalMode === 'custom' && customLyrics.trim().length < 4) {
      setErrorMessage(isArabic ? 'اكتب كلمات الأغنية أو اختر الغناء التلقائي.' : 'Add your lyrics or choose generated vocals.');
      return;
    }

    setGenerating(true);
    setSaved(false);
    setGeneratedLyrics('');
    try {
      const result = await generateLyriaMusic(apiKey.trim(), buildPrompt(), model);
      const blob = base64ToBlob(result.audioBase64, result.mimeType);
      const url = URL.createObjectURL(blob);
      setGeneratedUrl(url);
      const track: AudioItem = {
        id: 'lyria_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        title: trackTitle.trim() || (isArabic ? 'مقطوعة مولدة بالذكاء الاصطناعي' : 'AI Generated Track'),
        artist: 'DJ Desktop · Lyria',
        album: isArabic ? 'استوديو الموسيقى بالذكاء الاصطناعي' : 'AI Music Studio',
        duration: model === 'lyria-3-clip-preview' ? 30000 : 120000,
        uri: url,
        audioBlob: blob,
        addedDate: Date.now(),
      };
      setGeneratedTrack(track);
      setAudioDurationMs(0);
      setGeneratedLyrics(result.lyrics || '');
      setStatusMessage(isArabic ? 'تم توليد الموسيقى. استمع إليها ثم احفظها أو أرسلها إلى أحد الـ Decks.' : 'Music generated. Preview it, save it, or send it directly to either DJ deck.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isArabic ? 'فشل توليد الموسيقى.' : 'Music generation failed.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedTrack || saved || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const track = { ...generatedTrack, duration: audioDurationMs || generatedTrack.duration };
      await onSaveToLibrary(track);
      setGeneratedTrack(track);
      setSaved(true);
      setStatusMessage(isArabic ? 'تم حفظ الموسيقى في المكتبة.' : 'Saved to your music library.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر حفظ الموسيقى.' : 'Could not save the generated track.'));
    } finally {
      setSaving(false);
    }
  };

  const durationText = (milliseconds: number) => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  };
  const fieldClass = 'w-full rounded-xl border px-3 py-2.5 text-xs outline-none focus:ring-2 resize-y';
  const fieldStyle: React.CSSProperties = { backgroundColor: panel, borderColor: border, color: fg };

  return (
    <div id="ai-music-studio-screen" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5" style={{ backgroundColor: themeColors.background, color: fg }}>
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="relative overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ backgroundColor: card, borderColor: border }}>
          <div className="absolute -right-8 -top-12 w-52 h-52 rounded-full blur-3xl opacity-15" style={{ backgroundColor: accent }} />
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,' + themeColors.primary + ',' + themeColors.secondary + ')' }}><AudioLines className="w-7 h-7 text-white" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">{isArabic ? 'استوديو الموسيقى بالذكاء الاصطناعي' : 'AI Music Studio'}</h1>
                <span className="rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: panel, color: accent }}>Powered by Google Lyria</span>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed" style={{ color: muted }}>
                {isArabic ? 'حوّل وصفك إلى موسيقى ستيريو، واختر النوع والمزاج والسرعة والغناء. استمع واحفظ النتيجة أو أرسلها إلى Deck A أو Deck B.' : 'Turn a musical idea into stereo audio. Shape genre, mood, tempo and vocals, then preview, save, or send it to Deck A or Deck B.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold">
                <span className="rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5" style={{ borderColor: border }}><Headphones className="w-3.5 h-3.5" />{isArabic ? 'صوت ستيريو' : 'Stereo audio'}</span>
                <span className="rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5" style={{ borderColor: border }}><Clock3 className="w-3.5 h-3.5" />{model === 'lyria-3-clip-preview' ? '30 sec clip' : 'Full song · ~2 min'}</span>
                <span className="rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5" style={{ borderColor: border }}><ShieldCheck className="w-3.5 h-3.5" />{isArabic ? 'المفتاح يمر عبر الخدمة المحلية' : 'Key sent only to local service'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] gap-4 items-start">
          <form onSubmit={(event) => { void handleGenerate(event); }} className="rounded-2xl border p-4 sm:p-5 space-y-4" style={{ backgroundColor: card, borderColor: border }}>
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" style={{ color: accent }} /><h2 className="text-sm font-black">{isArabic ? 'صمّم مقطوعتك' : 'Compose your track'}</h2></div>
            <div className="space-y-2">
              <label className="block text-xs font-bold">{isArabic ? 'مفتاح Gemini API' : 'Gemini API key'}</label>
              <div className="flex items-center gap-2"><KeyRound className="w-4 h-4 shrink-0" style={{ color: muted }} /><input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} placeholder="AIza..." className={fieldClass} style={fieldStyle} aria-label="Gemini API key" /><button type="button" onClick={() => setShowKey((value) => !value)} className="rounded-lg border px-2.5 py-2 text-[10px] font-bold" style={{ borderColor: border }}>{showKey ? 'Hide' : 'Show'}</button></div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]" style={{ color: muted }}><label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={rememberKey} onChange={(event) => setRememberKey(event.target.checked)} />{isArabic ? 'تذكر المفتاح على هذا الجهاز' : 'Remember key on this device'}</label><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">{isArabic ? 'الحصول على مفتاح' : 'Get an API key'}</a></div>
            </div>

            <div className="space-y-2"><label className="block text-xs font-bold">{isArabic ? 'اسم المقطوعة' : 'Track title'}</label><input value={trackTitle} onChange={(event) => setTrackTitle(event.target.value)} maxLength={90} className={fieldClass} style={fieldStyle} /></div>

            <div className="space-y-2"><label className="block text-xs font-bold">{isArabic ? 'نمط التوليد' : 'Generation mode'}</label><div className="grid grid-cols-2 gap-2">
              {([
                { value: 'lyria-3.5', label: isArabic ? 'أغنية كاملة' : 'Full-length song', detail: isArabic ? 'أغنية ببنية كاملة' : 'Structured full song' },
                { value: 'lyria-3-clip-preview', label: isArabic ? 'مقطع سريع' : 'Quick clip', detail: isArabic ? '30 ثانية' : '30 seconds' },
              ] as Array<{ value: LyriaModel; label: string; detail: string }>).map((option) => <button key={option.value} type="button" onClick={() => setModel(option.value)} className="rounded-xl border p-3 text-left" style={{ backgroundColor: model === option.value ? accent + '18' : panel, borderColor: model === option.value ? accent : border }}><span className="block text-xs font-black">{option.label}</span><span className="block text-[10px] mt-1 opacity-70">{option.detail}</span></button>)}
            </div></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1.5"><span className="block text-xs font-bold">{isArabic ? 'النوع الموسيقي' : 'Genre'}</span><select value={genre} onChange={(event) => setGenre(event.target.value)} className={fieldClass} style={fieldStyle}>{GENRES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="space-y-1.5"><span className="block text-xs font-bold">{isArabic ? 'المزاج' : 'Mood'}</span><select value={mood} onChange={(event) => setMood(event.target.value)} className={fieldClass} style={fieldStyle}>{MOODS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            </div>

            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: border }}><div className="flex items-center justify-between gap-3 text-xs"><label htmlFor="lyria-bpm" className="font-bold">{isArabic ? 'السرعة المستهدفة' : 'Target BPM'}</label><span className="font-mono font-black" style={{ color: accent }}>{bpm} BPM</span></div><input id="lyria-bpm" type="range" min={60} max={180} value={bpm} onChange={(event) => setBpm(Number(event.target.value))} className="w-full" style={{ accentColor: accent }} /><div className="flex justify-between text-[9px]" style={{ color: muted }}><span>60 BPM</span><span>120 BPM</span><span>180 BPM</span></div></div>

            <div className="space-y-2"><label className="block text-xs font-bold">{isArabic ? 'وصف الإنتاج الموسيقي' : 'Production direction'}</label><textarea rows={4} maxLength={6000} value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass + ' leading-relaxed'} style={fieldStyle} placeholder={isArabic ? 'صف الإيقاع والآلات والطاقة وبنية الأغنية...' : 'Describe the beat, instruments, energy and arrangement...'} /><div className="flex flex-wrap gap-1.5">{['Punchy club drums and deep bass', 'Warm Arabic strings and tabla', 'Cinematic risers and a powerful drop', 'Soft piano with vinyl texture'].map((preset) => <button key={preset} type="button" onClick={() => setDescription(preset + '. Build a professional mix with a clear intro, dynamic arrangement, memorable hook and polished ending.')} className="rounded-full border px-2.5 py-1 text-[9px] font-semibold" style={{ borderColor: border, backgroundColor: panel }}>{preset}</button>)}</div></div>

            <div className="space-y-2"><label className="block text-xs font-bold">{isArabic ? 'الغناء والكلمات' : 'Vocals & lyrics'}</label><div className="grid grid-cols-3 gap-2">{([
              { value: 'instrumental', label: isArabic ? 'آلات فقط' : 'Instrumental' },
              { value: 'generated', label: isArabic ? 'غناء تلقائي' : 'AI vocals' },
              { value: 'custom', label: isArabic ? 'كلماتي' : 'Custom lyrics' },
            ] as const).map((option) => <button type="button" key={option.value} onClick={() => setVocalMode(option.value)} className="rounded-lg border py-2 px-1.5 text-[10px] font-bold" style={{ backgroundColor: vocalMode === option.value ? accent + '18' : panel, borderColor: vocalMode === option.value ? accent : border }}>{option.label}</button>)}</div>{vocalMode === 'custom' && <textarea value={customLyrics} onChange={(event) => setCustomLyrics(event.target.value)} maxLength={6000} rows={5} className={fieldClass + ' leading-relaxed'} style={fieldStyle} placeholder={'[Verse 1]\nWrite your original lyrics...\n\n[Chorus]\nYour hook goes here...'} />}</div>

            {errorMessage && <div role="alert" className="rounded-xl border p-3 text-xs leading-relaxed" style={{ color: '#fb7185', borderColor: '#fb718555' }}>{errorMessage}</div>}
            {statusMessage && <div role="status" className="rounded-xl border p-3 text-xs leading-relaxed" style={{ color: '#34d399', borderColor: '#34d39955' }}>{statusMessage}</div>}
            <button type="submit" disabled={generating || !description.trim()} className="w-full rounded-xl px-4 py-3.5 text-xs font-black text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(100deg,' + themeColors.primary + ',' + themeColors.secondary + ')' }}>{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{generating ? (isArabic ? 'Lyria تصنع الموسيقى...' : 'Lyria is composing your music...') : (isArabic ? 'توليد الموسيقى' : 'Generate music')}</button>
            <p className="text-[10px] leading-relaxed" style={{ color: muted }}>{isArabic ? 'يتطلب اتصالًا بالإنترنت ومفتاح Gemini API مع صلاحية Lyria. قد تنطبق حدود الاستخدام أو الرسوم.' : 'Requires internet access and a Gemini API key with Lyria access. API quotas or billing may apply.'}</p>
          </form>

          <section className="rounded-2xl border p-4 sm:p-5 space-y-4 lg:sticky lg:top-4" style={{ backgroundColor: card, borderColor: border }}>
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Music2 className="w-5 h-5" style={{ color: accent }} /><h2 className="text-sm font-black">{isArabic ? 'غرفة الاستماع' : 'Listening room'}</h2></div>{generatedTrack && <span className="text-[9px] font-black tracking-wider" style={{ color: '#34d399' }}>READY</span>}</div>
            {generatedTrack && generatedUrl ? <>
              <div className="rounded-2xl border p-4" style={{ borderColor: border, background: 'linear-gradient(145deg,' + panel + ',' + card + ')' }}><div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(145deg,' + themeColors.primary + ',' + themeColors.secondary + ')' }}><AudioLines className="w-7 h-7 text-white" /></div><div className="text-sm font-black break-words">{generatedTrack.title}</div><div className="text-[10px] mt-1" style={{ color: muted }}>DJ Desktop · Google Lyria</div><div className="flex flex-wrap gap-2 mt-3 text-[10px] font-bold"><span className="rounded-lg px-2 py-1" style={{ backgroundColor: panel }}>{genre}</span><span className="rounded-lg px-2 py-1" style={{ backgroundColor: panel }}>{bpm} BPM target</span><span className="rounded-lg px-2 py-1" style={{ backgroundColor: panel }}>{durationText(audioDurationMs || generatedTrack.duration)}</span></div></div>
              <audio controls preload="metadata" src={generatedUrl} className="w-full" onLoadedMetadata={(event) => { const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration * 1000 : 0; if (duration > 0) { setAudioDurationMs(duration); setGeneratedTrack((current) => current ? { ...current, duration } : current); } }} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onPlayGeneratedTrack({ ...generatedTrack, duration: audioDurationMs || generatedTrack.duration })} className="rounded-xl px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2 text-white" style={{ backgroundColor: accent }}><Play className="w-4 h-4 fill-current" />{isArabic ? 'تشغيل بالمشغل' : 'Play in player'}</button>
                <button type="button" onClick={() => void handleSave()} disabled={saved || saving} className="rounded-xl border px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50" style={{ borderColor: border, backgroundColor: panel }}><Save className="w-4 h-4" />{saved ? (isArabic ? 'تم الحفظ' : 'Saved') : saving ? (isArabic ? 'حفظ...' : 'Saving...') : (isArabic ? 'حفظ بالمكتبة' : 'Save to library')}</button>
                <button type="button" onClick={() => onSendToDeckA({ ...generatedTrack, duration: audioDurationMs || generatedTrack.duration })} className="rounded-xl border px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2" style={{ borderColor: themeColors.accentA, color: themeColors.accentA }}><Music2 className="w-4 h-4" />Send to Deck A</button>
                <button type="button" onClick={() => onSendToDeckB({ ...generatedTrack, duration: audioDurationMs || generatedTrack.duration })} className="rounded-xl border px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2" style={{ borderColor: themeColors.accentB, color: themeColors.accentB }}><Music2 className="w-4 h-4" />Send to Deck B</button>
                <a href={generatedUrl} download={(generatedTrack.title || 'lyria-track').replace(/[\\/:*?"<>|]/g, '_') + '.mp3'} className="col-span-2 rounded-xl border px-3 py-2.5 text-xs font-black flex items-center justify-center gap-2" style={{ borderColor: border, backgroundColor: panel }}><Download className="w-4 h-4" />{isArabic ? 'تنزيل ملف الموسيقى' : 'Download generated audio'}</a>
              </div>
              {generatedLyrics && <details className="rounded-xl border p-3" style={{ borderColor: border }}><summary className="cursor-pointer text-xs font-black">{isArabic ? 'الكلمات وبنية المقطوعة' : 'Generated lyrics & structure'}</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed" style={{ color: muted }}>{generatedLyrics}</pre></details>}
              {saved && <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#34d399' }}><Check className="w-3.5 h-3.5" />{isArabic ? 'الموسيقى محفوظة في المكتبة ويمكن تشغيلها بعد إعادة فتح التطبيق.' : 'Saved in your library and available after restarting.'}</p>}
            </> : <div className="min-h-[380px] rounded-2xl border flex flex-col items-center justify-center text-center p-6" style={{ borderColor: border, background: 'radial-gradient(ellipse at top,' + accent + '12,transparent 65%)' }}><div className="w-20 h-20 rounded-full border flex items-center justify-center mb-4" style={{ borderColor: accent + '60', color: accent }}><AudioLines className="w-9 h-9" /></div><div className="text-sm font-black">{isArabic ? 'مساحة الماستر' : 'Master listening room'}</div><p className="mt-2 max-w-xs text-xs leading-relaxed" style={{ color: muted }}>{isArabic ? 'ستظهر هنا المقطوعة ومشغل الاستماع وأزرار الحفظ والإرسال إلى الـ Decks بعد التوليد.' : 'Your generated track, audio player, lyrics, download, library save, and Deck A/B actions will appear here.'}</p></div>}
          </section>
        </div>
      </div>
    </div>
  );
};
