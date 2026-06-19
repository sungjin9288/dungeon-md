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

  private started = false;
  private currentTrack: BgmTrack = 'none';

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
  }

  setSfxVolume(v: number) {
    this.settings.sfxVolume = clamp(v);
    this.persist();
  }

  setBgmEnabled(on: boolean) {
    this.settings.bgmEnabled = on;
    this.persist();
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
  //  절차적 BGM은 제거됨. 실제 음악 트랙을 별도 제작해 연동할 때 playBgm/stopBgm에
  //  재생·정지 로직을 채운다. 현재는 트랙 상태만 추적하며, 설정·API는 보존한다.

  playBgm(track: BgmTrack) {
    if (track === this.currentTrack) return;
    this.currentTrack = track;
  }

  stopBgm() {
    this.currentTrack = 'none';
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
