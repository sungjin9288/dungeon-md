import * as Tone from 'tone';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BgmTrack = 'home' | 'battle' | 'summon' | 'none';

export type SfxId =
  | 'attack'
  | 'death'
  | 'wave_clear'
  | 'level_up'
  | 'summon_pull'
  | 'summon_legendary'
  | 'gold_earn'
  | 'button_click'
  | 'equip'
  | 'boss_appear'
  | 'room_build'
  | 'room_upgrade'
  | 'monster_place'
  | 'skill_activate'
  | 'victory'
  | 'defeat';

interface AudioSettings {
  bgmVolume: number;    // 0–1
  sfxVolume: number;    // 0–1
  bgmEnabled: boolean;
  sfxEnabled: boolean;
}

type ManagedBgmSynth =
  | Tone.Synth
  | Tone.PolySynth
  | Tone.NoiseSynth
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.AMSynth
  | Tone.FMSynth;

type TriggerAttackReleaseVoice = {
  triggerAttackRelease: (...args: unknown[]) => unknown;
};

const AUDIO_KEY = 'dungeonAudioSettings';

// ─── AudioManager ─────────────────────────────────────────────────────────────

class AudioManager {
  private static _instance: AudioManager;

  private settings: AudioSettings = {
    bgmVolume: 0.5,
    sfxVolume: 0.7,
    bgmEnabled: true,
    sfxEnabled: true,
  };

  private started   = false;
  private currentTrack: BgmTrack = 'none';
  private bgmParts:  Tone.Part[]  = [];
  private bgmSynths: ManagedBgmSynth[] = [];
  private bgmLoop:   Tone.Loop | null = null;
  private bgmVoiceLastTimes = new WeakMap<object, number>();

  private constructor() {
    this.loadSettings();
  }

  static getInstance(): AudioManager {
    if (!AudioManager._instance) AudioManager._instance = new AudioManager();
    return AudioManager._instance;
  }

  // ── Settings ────────────────────────────────────────────────────────────────

  private loadSettings() {
    try {
      const raw = localStorage.getItem(AUDIO_KEY);
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch { /* ignore */ }
  }

  private persist() {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(this.settings));
  }

  getSettings(): Readonly<AudioSettings> { return { ...this.settings }; }

  setBgmVolume(v: number) {
    this.settings.bgmVolume = clamp(v);
    this.persist();
    this.bgmSynths.forEach(s => {
      s.volume.value = Tone.gainToDb(this.settings.bgmEnabled ? this.settings.bgmVolume * 0.6 : 0.0001);
    });
  }

  setSfxVolume(v: number) {
    this.settings.sfxVolume = clamp(v);
    this.persist();
  }

  setBgmEnabled(on: boolean) {
    this.settings.bgmEnabled = on;
    this.persist();
    if (!on) {
      this.bgmSynths.forEach(s => { s.volume.value = -Infinity; });
    } else {
      this.bgmSynths.forEach(s => {
        s.volume.value = Tone.gainToDb(this.settings.bgmVolume * 0.6);
      });
    }
  }

  setSfxEnabled(on: boolean) {
    this.settings.sfxEnabled = on;
    this.persist();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async resume() {
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }
  }

  // ── BGM ─────────────────────────────────────────────────────────────────────

  playBgm(track: BgmTrack) {
    if (track === this.currentTrack) return;
    this.stopBgm();
    this.currentTrack = track;
    if (!this.settings.bgmEnabled || track === 'none') return;
    if (!this.started) return;   // will replay after resume()

    switch (track) {
      case 'home':   this._homeBgm();   break;
      case 'battle': this._battleBgm(); break;
      case 'summon': this._summonBgm(); break;
    }
  }

  stopBgm() {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();

    try {
      this.bgmLoop?.stop(0).dispose();
    } catch {
      this.bgmLoop?.dispose();
    }
    this.bgmLoop = null;

    this.bgmParts.forEach(p => {
      try { p.stop(0); } catch { /* Tone can produce a tiny negative stop time after rapid scene restarts */ }
      try { p.dispose(); } catch { /* already gone */ }
    });
    this.bgmParts = [];

    this.bgmSynths.forEach(s => { try { s.disconnect(); s.dispose(); } catch { /* already gone */ } });
    this.bgmSynths = [];
    this.bgmVoiceLastTimes = new WeakMap<object, number>();

    this.currentTrack = 'none';
  }

  private resolveBgmScheduleTime(voice: object, time: number): number {
    const now = Tone.now();
    const last = this.bgmVoiceLastTimes.get(voice) ?? Number.NEGATIVE_INFINITY;
    const minTime = Math.max(now + 0.015, last + 0.002);
    const candidate = Number.isFinite(time) ? time : minTime;
    const safeTime = Math.max(candidate, minTime);
    this.bgmVoiceLastTimes.set(voice, safeTime);
    return safeTime;
  }

  private triggerBgmNote(
    voice: unknown,
    note: string | string[],
    duration: string,
    time: number,
    velocity?: number,
  ): void {
    const target = voice as TriggerAttackReleaseVoice;
    const scheduledTime = this.resolveBgmScheduleTime(voice as object, time);
    try {
      target.triggerAttackRelease(note, duration, scheduledTime, velocity);
    } catch {
      const retryTime = this.resolveBgmScheduleTime(voice as object, Tone.now() + 0.05);
      try { target.triggerAttackRelease(note, duration, retryTime, velocity); } catch { /* skip unstable audio frame */ }
    }
  }

  private triggerBgmDuration(
    voice: unknown,
    duration: string,
    time: number,
    velocity?: number,
  ): void {
    const target = voice as TriggerAttackReleaseVoice;
    const scheduledTime = this.resolveBgmScheduleTime(voice as object, time);
    try {
      target.triggerAttackRelease(duration, scheduledTime, velocity);
    } catch {
      const retryTime = this.resolveBgmScheduleTime(voice as object, Tone.now() + 0.05);
      try { target.triggerAttackRelease(duration, retryTime, velocity); } catch { /* skip unstable audio frame */ }
    }
  }

  // ── SFX ─────────────────────────────────────────────────────────────────────

  playSfx(id: SfxId) {
    if (!this.settings.sfxEnabled || !this.started) return;
    const vol = Tone.gainToDb(this.settings.sfxVolume);
    switch (id) {
      case 'button_click':     this._sfxClick(vol);          break;
      case 'attack':           this._sfxAttack(vol);         break;
      case 'death':            this._sfxDeath(vol);          break;
      case 'wave_clear':       this._sfxWaveClear(vol);      break;
      case 'level_up':         this._sfxLevelUp(vol);        break;
      case 'gold_earn':        this._sfxGold(vol);           break;
      case 'equip':            this._sfxEquip(vol);          break;
      case 'summon_pull':      this._sfxSummonPull(vol);     break;
      case 'summon_legendary': this._sfxSummonLegendary(vol); break;
      case 'boss_appear':      this._sfxBossAppear(vol);     break;
      case 'room_build':       this._sfxRoomBuild(vol);      break;
      case 'room_upgrade':     this._sfxRoomUpgrade(vol);    break;
      case 'monster_place':    this._sfxMonsterPlace(vol);   break;
      case 'skill_activate':   this._sfxSkillActivate(vol);  break;
      case 'victory':          this._sfxVictory(vol);        break;
      case 'defeat':           this._sfxDefeat(vol);         break;
    }
  }

  // ── BGM tempo control ────────────────────────────────────────────────────

  /** Ramp BGM tempo over `duration` seconds. */
  rampBpm(target: number, duration: number): void {
    if (this.currentTrack !== 'none' && this.started) {
      Tone.getTransport().bpm.rampTo(target, duration);
    }
  }

  /** Reset BGM tempo to the current track's default. */
  resetBpm(): void {
    const defaults: Record<BgmTrack, number> = { home: 72, battle: 120, summon: 60, none: 120 };
    Tone.getTransport().bpm.value = defaults[this.currentTrack];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BGM IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Home — slow Korean-folk-inspired pentatonic loop at 72 BPM */
  private _homeBgm() {
    const vol = Tone.gainToDb(this.settings.bgmVolume * 0.45);

    // Pluck melody (main voice)
    const pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.8, sustain: 0.0, release: 1.2 },
      volume: vol,
    }).toDestination();

    // Pad harmony
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.6, decay: 0.4, sustain: 0.6, release: 2.0 },
      volume: vol - 8,
    }).toDestination();

    this.bgmSynths.push(pluck, pad);

    // Korean pentatonic (G-major pentatonic): G3 A3 B3 D4 E4 G4 A4 B4 D5 E5
    const melody: [string, string][] = [
      ['0:0:0','G4'], ['0:0:2','B4'], ['0:1:0','D5'], ['0:1:2','E5'],
      ['0:2:0','D5'], ['0:2:2','B4'], ['0:3:0','G4'], ['0:3:2','A4'],
      ['1:0:0','E5'], ['1:0:2','D5'], ['1:1:0','B4'], ['1:1:2','G4'],
      ['1:2:0','A4'], ['1:2:2','B4'], ['1:3:0','D5'], ['1:3:2','E5'],
      ['2:0:0','G5'], ['2:0:2','E5'], ['2:1:0','D5'], ['2:1:2','B4'],
      ['2:2:0','A4'], ['2:2:2','G4'], ['2:3:0','E4'], ['2:3:2','D4'],
      ['3:0:0','G4'], ['3:0:2','A4'], ['3:1:0','B4'], ['3:1:2','D5'],
      ['3:2:0','B4'], ['3:2:2','A4'], ['3:3:0','G4'], ['3:3:2','G4'],
    ];

    const harmonyChords: [string, string[]][] = [
      ['0:0:0',['G3','B3','D4']], ['0:2:0',['D3','A3','D4']],
      ['1:0:0',['E3','B3','E4']], ['1:2:0',['A3','E3','A4']],
      ['2:0:0',['G3','D4','G4']], ['2:2:0',['E3','B3','E4']],
      ['3:0:0',['D3','A3','D4']], ['3:2:0',['G3','B3','D4']],
    ];

    const melodyPart = new Tone.Part((time, note: string) => {
      this.triggerBgmNote(pluck, note, '8n', time, 0.6);
    }, melody);
    melodyPart.loop = true;
    melodyPart.loopEnd = '4m';

    const padPart = new Tone.Part((time, notes: string[]) => {
      this.triggerBgmNote(pad, notes, '2n', time, 0.3);
    }, harmonyChords);
    padPart.loop = true;
    padPart.loopEnd = '4m';

    this.bgmParts.push(melodyPart, padPart);

    Tone.getTransport().bpm.value = 72;
    melodyPart.start(0);
    padPart.start(0);
    Tone.getTransport().start();
  }

  /** Battle — tense 120 BPM minor driving loop */
  private _battleBgm() {
    const vol = Tone.gainToDb(this.settings.bgmVolume * 0.5);

    // Lead synth
    const lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.3 },
      volume: vol - 4,
    }).toDestination();

    // Bass
    const bass = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2 },
      volume: vol - 2,
    }).toDestination();

    // Drums - kick
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 6,
      volume: vol + 2,
    }).toDestination();

    // Hi-hat
    const hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: vol - 8,
    }).toDestination();

    this.bgmSynths.push(lead, bass, kick, hihat);

    // A minor pentatonic riff: A3 C4 D4 E4 G4
    const riff: [string, string][] = [
      ['0:0:0','A3'],['0:0:1','C4'],['0:0:2','D4'],['0:0:3','E4'],
      ['0:1:0','G4'],['0:1:1','E4'],['0:1:2','D4'],['0:1:3','C4'],
      ['0:2:0','A3'],['0:2:1','A3'],['0:2:2','C4'],['0:2:3','E4'],
      ['0:3:0','D4'],['0:3:1','C4'],['0:3:2','A3'],['0:3:3','A3'],
      ['1:0:0','E4'],['1:0:1','G4'],['1:0:2','A4'],['1:0:3','G4'],
      ['1:1:0','E4'],['1:1:1','D4'],['1:1:2','C4'],['1:1:3','A3'],
      ['1:2:0','G3'],['1:2:1','A3'],['1:2:2','C4'],['1:2:3','D4'],
      ['1:3:0','E4'],['1:3:1','E4'],['1:3:2','E4'],['1:3:3','E4'],
    ];

    const bassLine: [string, string][] = [
      ['0:0:0','A2'],['0:1:0','A2'],['0:2:0','C3'],['0:3:0','G2'],
      ['1:0:0','E2'],['1:1:0','E2'],['1:2:0','F2'],['1:3:0','E2'],
    ];

    const kickPattern: [string, string][] = [
      ['0:0:0','C1'],['0:2:0','C1'],
      ['1:0:0','C1'],['1:2:0','C1'],
    ];

    const hihatPattern: [string, string][] = [
      ['0:0:2','C5'],['0:1:2','C5'],['0:2:2','C5'],['0:3:2','C5'],
      ['1:0:2','C5'],['1:1:2','C5'],['1:2:2','C5'],['1:3:2','C5'],
    ];

    const riffPart = new Tone.Part((time, note: string) => {
      this.triggerBgmNote(lead, note, '16n', time, 0.7);
    }, riff);
    riffPart.loop = true; riffPart.loopEnd = '2m';

    const bassPart = new Tone.Part((time, note: string) => {
      this.triggerBgmNote(bass, note, '8n', time, 0.8);
    }, bassLine);
    bassPart.loop = true; bassPart.loopEnd = '2m';

    const kickPart = new Tone.Part((time) => {
      this.triggerBgmNote(kick, 'C1', '8n', time);
    }, kickPattern);
    kickPart.loop = true; kickPart.loopEnd = '2m';

    const hihatPart = new Tone.Part((time) => {
      this.triggerBgmDuration(hihat, '16n', time);
    }, hihatPattern);
    hihatPart.loop = true; hihatPart.loopEnd = '2m';

    this.bgmParts.push(riffPart, bassPart, kickPart, hihatPart);

    Tone.getTransport().bpm.value = 120;
    riffPart.start(0); bassPart.start(0); kickPart.start(0); hihatPart.start(0);
    Tone.getTransport().start();
  }

  /** Summon — mystical 60 BPM whole-tone pad */
  private _summonBgm() {
    const vol = Tone.gainToDb(this.settings.bgmVolume * 0.4);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1.0, decay: 0.5, sustain: 0.7, release: 3.0 },
      volume: vol,
    }).toDestination();

    const bells = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 1.5, sustain: 0.0, release: 2.0 },
      volume: vol - 4,
    }).toDestination();

    this.bgmSynths.push(pad, bells);

    // Whole-tone scale: C D E F# G# A# C
    const chords: [string, string[]][] = [
      ['0:0:0',['C3','E3','G#3','C4']],
      ['0:2:0',['D3','F#3','A#3','D4']],
      ['1:0:0',['E3','G#3','C4','E4']],
      ['1:2:0',['F#3','A#3','D4','F#4']],
      ['2:0:0',['G#3','C4','E4','G#4']],
      ['2:2:0',['A#3','D4','F#4','A#4']],
      ['3:0:0',['C4','E4','G#4','C5']],
      ['3:2:0',['A#3','D4','F#4','C4']],
    ];

    const bellNotes: [string, string][] = [
      ['0:0:0','C6'],['0:1:2','G#5'],['0:3:0','D6'],
      ['1:0:2','A#5'],['1:2:0','E6'],['1:3:2','F#5'],
      ['2:1:0','C6'],['2:2:2','G#5'],['3:0:0','D6'],
      ['3:1:2','A#5'],['3:3:0','E6'],
    ];

    const padPart = new Tone.Part((time, notes: string[]) => {
      this.triggerBgmNote(pad, notes, '2n', time, 0.4);
    }, chords);
    padPart.loop = true; padPart.loopEnd = '4m';

    const bellPart = new Tone.Part((time, note: string) => {
      this.triggerBgmNote(bells, note, '8n', time, 0.5);
    }, bellNotes);
    bellPart.loop = true; bellPart.loopEnd = '4m';

    this.bgmParts.push(padPart, bellPart);

    Tone.getTransport().bpm.value = 60;
    padPart.start(0); bellPart.start(0);
    Tone.getTransport().start();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SFX IMPLEMENTATIONS  (fire-and-forget, auto-dispose)
  // ═══════════════════════════════════════════════════════════════════════════

  private _sfxClick(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
      volume: vol - 6,
    }).toDestination();
    s.triggerAttackRelease('G5', '32n');
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 300);
  }

  private _sfxAttack(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
      volume: vol - 4,
    }).toDestination();
    s.triggerAttackRelease('C4', '16n');
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 400);
  }

  private _sfxDeath(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.6, sustain: 0, release: 0.5 },
      volume: vol - 4,
    }).toDestination();
    // Descending glide
    s.triggerAttack('E4');
    s.frequency.rampTo('A2', 0.5);
    setTimeout(() => { s.triggerRelease(); }, 400);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 1200);
  }

  private _sfxWaveClear(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
      volume: vol - 2,
    }).toDestination();
    // C major ascending fanfare
    const now = Tone.now();
    ['C4','E4','G4','C5'].forEach((n, i) => {
      s.triggerAttackRelease(n, '8n', now + i * 0.12);
    });
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 1000);
  }

  private _sfxLevelUp(vol: number) {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
      volume: vol,
    }).toDestination();
    const now = Tone.now();
    s.triggerAttackRelease('C4', '8n', now);
    s.triggerAttackRelease('E4', '8n', now + 0.1);
    s.triggerAttackRelease('G4', '8n', now + 0.2);
    s.triggerAttackRelease(['C5','E5','G5'], '4n', now + 0.3);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 2000);
  }

  private _sfxGold(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      volume: vol - 4,
    }).toDestination();
    const now = Tone.now();
    s.triggerAttackRelease('C6', '32n', now);
    s.triggerAttackRelease('E6', '32n', now + 0.05);
    s.triggerAttackRelease('G6', '32n', now + 0.10);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 600);
  }

  private _sfxEquip(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
      volume: vol - 4,
    }).toDestination();
    const now = Tone.now();
    s.triggerAttackRelease('D5', '8n', now);
    s.triggerAttackRelease('A5', '8n', now + 0.12);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 800);
  }

  private _sfxSummonPull(vol: number) {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0, release: 0.3 },
      volume: vol - 6,
    }).toDestination();
    const sparkle = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
      volume: vol - 4,
    }).toDestination();
    noise.triggerAttackRelease('8n');
    const now = Tone.now();
    ['G5','A#5','D6','G6'].forEach((n, i) => {
      sparkle.triggerAttackRelease(n, '16n', now + i * 0.08);
    });
    setTimeout(() => {
      try { noise.dispose(); sparkle.dispose(); } catch { /* ok */ }
    }, 1500);
  }

  private _sfxSummonLegendary(vol: number) {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 1.0 },
      volume: vol + 2,
    }).toDestination();
    const now = Tone.now();
    // Epic rising fanfare
    s.triggerAttackRelease('C4', '8n', now);
    s.triggerAttackRelease('E4', '8n', now + 0.15);
    s.triggerAttackRelease('G4', '8n', now + 0.30);
    s.triggerAttackRelease(['C5','E5','G5'], '4n', now + 0.50);
    s.triggerAttackRelease(['E5','G5','C6'], '4n', now + 0.85);
    s.triggerAttackRelease(['G5','C6','E6'], '2n', now + 1.20);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 3500);
  }

  /** Boss appearance — low rumble + metallic sting */
  private _sfxBossAppear(vol: number) {
    // Deep rumble
    const rumble = new Tone.MembraneSynth({
      pitchDecay: 0.3, octaves: 3,
      envelope: { attack: 0.05, decay: 1.5, sustain: 0, release: 0.5 },
      volume: vol + 4,
    }).toDestination();
    rumble.triggerAttackRelease('C1', '2n');
    setTimeout(() => { try { rumble.dispose(); } catch { /* ok */ } }, 2500);

    // Metallic sting
    const sting = new Tone.MetalSynth({
      envelope: { attack: 0.01, decay: 0.8, release: 0.3 },
      harmonicity: 3.1, modulationIndex: 16, resonance: 2000,
      volume: vol - 2,
    }).toDestination();
    sting.triggerAttackRelease('16n', Tone.now() + 0.3);
    setTimeout(() => { try { sting.dispose(); } catch { /* ok */ } }, 2000);

    // Dissonant chord stab
    const stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.6, sustain: 0, release: 0.8 },
      volume: vol,
    }).toDestination();
    stab.triggerAttackRelease(['C2', 'Gb2', 'Bb2'], '4n', Tone.now() + 0.5);
    setTimeout(() => { try { stab.dispose(); } catch { /* ok */ } }, 2500);
  }

  /** Room construction — thud + tap */
  private _sfxRoomBuild(vol: number) {
    const thud = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 2,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
      volume: vol - 2,
    }).toDestination();
    thud.triggerAttackRelease('C2', '16n');
    const tap = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.15, release: 0.1 },
      harmonicity: 5.1, modulationIndex: 8, resonance: 3000,
      volume: vol - 8,
    }).toDestination();
    tap.triggerAttackRelease('32n', Tone.now() + 0.08);
    setTimeout(() => { try { thud.dispose(); tap.dispose(); } catch { /* ok */ } }, 800);
  }

  /** Room upgrade — ascending power-up tone */
  private _sfxRoomUpgrade(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.3 },
      volume: vol - 2,
    }).toDestination();
    const now = Tone.now();
    s.triggerAttackRelease('C5', '16n', now);
    s.triggerAttackRelease('E5', '16n', now + 0.08);
    s.triggerAttackRelease('G5', '8n', now + 0.16);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 800);
  }

  /** Monster placement — whoosh + chime */
  private _sfxMonsterPlace(vol: number) {
    const noise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.1 },
      volume: vol - 10,
    }).toDestination();
    noise.triggerAttackRelease('16n');
    const chime = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.15 },
      volume: vol - 4,
    }).toDestination();
    chime.triggerAttackRelease('A5', '16n', Tone.now() + 0.05);
    setTimeout(() => { try { noise.dispose(); chime.dispose(); } catch { /* ok */ } }, 600);
  }

  /** Skill activation — magic burst */
  private _sfxSkillActivate(vol: number) {
    const s = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.4 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 },
      volume: vol - 2,
    }).toDestination();
    s.triggerAttackRelease('E5', '8n');
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 800);
  }

  /** Chapter clear victory — triumphant fanfare */
  private _sfxVictory(vol: number) {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      volume: vol + 2,
    }).toDestination();
    const now = Tone.now();
    s.triggerAttackRelease('C4', '8n', now);
    s.triggerAttackRelease('E4', '8n', now + 0.15);
    s.triggerAttackRelease('G4', '8n', now + 0.30);
    s.triggerAttackRelease(['C5','E5'], '4n', now + 0.50);
    s.triggerAttackRelease(['E5','G5','C6'], '2n', now + 0.80);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 3000);
  }

  /** Defeat — somber descending tone */
  private _sfxDefeat(vol: number) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.5, sustain: 0.2, release: 1.0 },
      volume: vol - 2,
    }).toDestination();
    const now = Tone.now();
    s.triggerAttackRelease('G3', '8n', now);
    s.triggerAttackRelease('E3', '8n', now + 0.25);
    s.triggerAttackRelease('C3', '8n', now + 0.50);
    s.triggerAttackRelease('A2', '4n', now + 0.80);
    setTimeout(() => { try { s.dispose(); } catch { /* ok */ } }, 2500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number) { return Math.max(0, Math.min(1, v)); }

// ─── Singleton export ─────────────────────────────────────────────────────────

export const audioManager = AudioManager.getInstance();
