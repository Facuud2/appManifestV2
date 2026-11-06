/**
 * Apple iOS WebKit Compliant Web Audio Engine
 * Handles low-latency playback, reactive frequency analyser for pastel halo,
 * procedural ambient generators (Silencio, Ruido Blanco, Lluvia), and voice loop playback.
 */

export type AmbienceType = 'none' | 'white_noise' | 'astral_rain';

export function getBestSpanishVoice(gender?: 'female' | 'male'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (spanish.length === 0) return null;

  if (gender === 'female') {
    const female = spanish.find((v) =>
      v.name.toLowerCase().includes('mónica') ||
      v.name.toLowerCase().includes('monica') ||
      v.name.toLowerCase().includes('paulina') ||
      v.name.toLowerCase().includes('helena') ||
      v.name.toLowerCase().includes('female')
    );
    if (female) return female;
  }

  if (gender === 'male') {
    const male = spanish.find((v) =>
      v.name.toLowerCase().includes('jorge') ||
      v.name.toLowerCase().includes('diego') ||
      v.name.toLowerCase().includes('carlos') ||
      v.name.toLowerCase().includes('male')
    );
    if (male) return male;
  }

  const enhanced = spanish.find((v) =>
    v.name.toLowerCase().includes('natural') ||
    v.name.toLowerCase().includes('siri') ||
    v.name.toLowerCase().includes('premium')
  );
  return enhanced || spanish[0];
}

let silentWavUrl: string | null = null;

/** Builds a short silent 8-bit mono WAV used to hold the iOS "playback" audio session. */
function createSilentWavUrl(): string {
  if (silentWavUrl) return silentWavUrl;
  const sampleRate = 8000;
  const sampleCount = sampleRate / 2;
  const buffer = new ArrayBuffer(44 + sampleCount);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeString(36, 'data');
  view.setUint32(40, sampleCount, true);
  for (let i = 0; i < sampleCount; i++) view.setUint8(44 + i, 128);
  silentWavUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  return silentWavUrl;
}

class ManifestAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private warmFilter: BiquadFilterNode | null = null;

  // Ambience nodes
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private currentAmbience: AmbienceType = 'none';

  // Voice playback
  private voiceGain: GainNode | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private isUnlocked: boolean = false;
  private isVoicePlaying: boolean = false;
  private isSpeechSynthesisPlaying: boolean = false;
  private animFrame: number | null = null;
  private currentEnergy: number = 0;
  private sessionKeeper: HTMLAudioElement | null = null;

  public getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass =
        (typeof window !== 'undefined' &&
          ((window as any).AudioContext || (window as any).webkitAudioContext)) ||
        null;

      if (!AudioCtxClass) {
        throw new Error('Web Audio API no soportado');
      }

      this.ctx = new AudioCtxClass();
      this.setupGraph();
    }
    return this.ctx!;
  }

  private setupGraph() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.warmFilter = this.ctx.createBiquadFilter();
    this.warmFilter.type = 'lowpass';
    this.warmFilter.frequency.setValueAtTime(3400, this.ctx.currentTime);
    this.warmFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    this.voiceGain = this.ctx.createGain();
    this.voiceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.voiceGain.connect(this.warmFilter);
    this.warmFilter.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.ambienceGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.startEnergyMonitoring();
  }

  /**
   * iOS routes Web Audio through the "ambient" audio session by default, which is
   * silenced by the ringer/silent switch. Requesting the "playback" session (iOS 17+)
   * and keeping a silent media element alive (older iOS) makes Web Audio audible
   * even when the iPhone is in silent mode, matching desktop behaviour.
   */
  private ensurePlaybackAudioSession() {
    if (typeof window === 'undefined') return;

    try {
      const audioSession = (navigator as any).audioSession;
      if (audioSession && audioSession.type !== 'playback') {
        audioSession.type = 'playback';
      }
    } catch (_) {}

    try {
      if (!this.sessionKeeper) {
        const element = document.createElement('audio');
        element.setAttribute('playsinline', '');
        element.setAttribute('webkit-playsinline', '');
        element.setAttribute('x-webkit-airplay', 'deny');
        element.preload = 'auto';
        element.loop = true;
        element.src = createSilentWavUrl();
        this.sessionKeeper = element;
      }
      if (this.sessionKeeper.paused) {
        // Must be invoked synchronously inside the user gesture.
        void this.sessionKeeper.play().catch(() => {});
      }
    } catch (_) {}
  }

  private async resumeContext(ctx: AudioContext) {
    // iOS can report "interrupted" (calls, Siri, lock screen) besides "suspended".
    if ((ctx.state as string) !== 'running') {
      await ctx.resume();
    }
  }

  public async unlock(): Promise<boolean> {
    try {
      // Everything before the first await runs synchronously within the user gesture.
      this.ensurePlaybackAudioSession();
      const ctx = this.getAudioContext();
      await this.resumeContext(ctx);
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.warn('[AudioEngine] Could not unlock Web Audio:', e);
      return false;
    }
  }

  private startEnergyMonitoring() {
    if (this.animFrame || typeof window === 'undefined') return;

    const dataArray = new Uint8Array(32);
    const update = () => {
      if (this.analyser && this.isVoicePlaying) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 2; i < 16; i++) {
          sum += dataArray[i];
        }
        const avg = sum / 14;
        const normalized = Math.min(1, Math.max(0, (avg - 10) / 120));
        this.currentEnergy = this.currentEnergy * 0.7 + normalized * 0.3;
      } else {
        this.currentEnergy = this.currentEnergy * 0.8;
        if (this.currentEnergy < 0.01) this.currentEnergy = 0;
      }
      this.animFrame = requestAnimationFrame(update);
    };

    this.animFrame = requestAnimationFrame(update);
  }

  public getReactiveEnergy(): number {
    return this.currentEnergy;
  }

  public getIsVoicePlaying(): boolean {
    return this.isVoicePlaying || this.isSpeechSynthesisPlaying;
  }

  public getAudioFrequencyData(targetArray?: Uint8Array): Uint8Array | null {
    if (!this.analyser) return null;
    const array = targetArray || new Uint8Array(32);
    this.analyser.getByteFrequencyData(array as any);
    return array;
  }

  public setAmbience(type: AmbienceType) {
    if (this.currentAmbience === type && this.ambienceSource) return;
    this.stopAmbience();
    this.currentAmbience = type;

    if (type === 'none') return;

    try {
      this.ensurePlaybackAudioSession();
      const ctx = this.getAudioContext();
      if (!this.ambienceGain) return;
      void this.resumeContext(ctx).catch(() => {});
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      this.ambienceGain.gain.cancelScheduledValues(now);
      this.ambienceGain.gain.setValueAtTime(0, now);
      this.ambienceGain.gain.linearRampToValueAtTime(0.14, now + 1.2);

      const bufferDuration = 10;
      const bufferSize = ctx.sampleRate * bufferDuration;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      if (type === 'white_noise') {
        // Soothing warm white noise with 850Hz filter
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.08;
        }

        // Circular boundary crossfade
        const fadeLen = 2048;
        for (let i = 0; i < fadeLen; i++) {
          const t = i / fadeLen;
          output[i] = output[i] * t + output[bufferSize - fadeLen + i] * (1 - t);
        }

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, now);
        filter.Q.setValueAtTime(0.5, now);

        source.connect(filter);
        filter.connect(this.ambienceGain);
        source.start();
        this.ambienceSource = source;
      } else if (type === 'astral_rain') {
        // Procedural soft rain shower
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
          b6 = white * 0.115926;
        }

        const fadeLen = 2048;
        for (let i = 0; i < fadeLen; i++) {
          const t = i / fadeLen;
          output[i] = output[i] * t + output[bufferSize - fadeLen + i] * (1 - t);
        }

        const rainSource = ctx.createBufferSource();
        rainSource.buffer = noiseBuffer;
        rainSource.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950, now);
        filter.Q.setValueAtTime(1.2, now);

        rainSource.connect(filter);
        filter.connect(this.ambienceGain);
        rainSource.start();
        this.ambienceSource = rainSource;
      }
    } catch (e) {
      console.warn('[AudioEngine] Error playing ambience:', e);
    }
  }

  public stopAmbience() {
    if (this.ctx && this.ambienceGain) {
      const now = this.ctx.currentTime;
      this.ambienceGain.gain.cancelScheduledValues(now);
      this.ambienceGain.gain.setValueAtTime(this.ambienceGain.gain.value, now);
      this.ambienceGain.gain.linearRampToValueAtTime(0, now + 0.3);
    }
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
        this.ambienceSource.disconnect();
      } catch (_) {}
      this.ambienceSource = null;
    }
    this.currentAmbience = 'none';
  }

  public async decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => resolve(buf),
        (err) => reject(err)
      );
    });
  }

  public async playVoice(
    audioSource: AudioBuffer | string,
    onEnded?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    this.stopVoice();

    try {
      const ctx = this.getAudioContext();
      await this.resumeContext(ctx);

      let audioBuffer: AudioBuffer | null = null;
      if (typeof audioSource === 'string') {
        const res = await fetch(audioSource);
        const arrayBuf = await res.arrayBuffer();
        audioBuffer = await this.decodeAudio(arrayBuf);
      } else {
        audioBuffer = audioSource;
      }

      if (!audioBuffer || !this.voiceGain) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const now = ctx.currentTime;
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.setValueAtTime(1.0, now);
      source.connect(this.voiceGain);

      source.onended = () => {
        this.isVoicePlaying = false;
        if (onEnded) onEnded();
      };

      this.voiceSource = source;
      this.isVoicePlaying = true;
      source.start(0);
    } catch (e) {
      console.warn('[AudioEngine] Error playing voice:', e);
      this.isVoicePlaying = false;
      onError?.(e instanceof Error ? e : new Error('No se pudo reproducir el audio.'));
      if (onEnded) onEnded();
    }
  }

  public speakVoice(
    text: string,
    options?: { pitch?: number; rate?: number; gender?: 'female' | 'male' },
    onEnded?: () => void
  ): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnded) onEnded();
      return false;
    }

    this.stopVoice();

    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.volume = 1.0;
      utterance.rate = options?.rate ?? 0.88;
      utterance.pitch = options?.pitch ?? 1.0;

      const bestVoice = getBestSpanishVoice(options?.gender);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      this.isVoicePlaying = true;
      this.isSpeechSynthesisPlaying = true;

      let timer: any = null;
      let step = 0;
      timer = setInterval(() => {
        if (!this.isSpeechSynthesisPlaying) {
          clearInterval(timer);
          return;
        }
        step++;
        const pulse = 0.35 + 0.45 * Math.sin(step * 0.45) * Math.sin(step * 0.2);
        this.currentEnergy = Math.max(0.1, Math.min(0.9, pulse));
      }, 50);

      const finish = () => {
        if (timer) clearInterval(timer);
        this.isSpeechSynthesisPlaying = false;
        this.isVoicePlaying = false;
        this.currentEnergy = 0;
        if (onEnded) onEnded();
      };

      utterance.onend = () => finish();
      utterance.onerror = () => finish();

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      console.warn('[AudioEngine] SpeechSynthesis error:', e);
      this.isVoicePlaying = false;
      this.isSpeechSynthesisPlaying = false;
      if (onEnded) onEnded();
      return false;
    }
  }

  public stopVoice() {
    if (this.voiceSource) {
      try {
        this.voiceSource.stop();
        this.voiceSource.disconnect();
      } catch (_) {}
      this.voiceSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    this.isVoicePlaying = false;
    this.isSpeechSynthesisPlaying = false;
    this.currentEnergy = 0;
  }
}

export const audioEngine = typeof window !== 'undefined' ? new ManifestAudioEngine() : (null as any);
