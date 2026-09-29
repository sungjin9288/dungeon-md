import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { DUNGEON_UI as UI, DUNGEON_UI_CSS as CSS } from '../constants/colors';
import { type DialogueLine, getCinematic } from '../data/cinematics';
import { loadGameState, saveGameState } from '../data/wisdom';
import { markCinematicSeen } from '../data/storyTransactions';
import { getSpeakerArtId, selectSpeakerArtSource } from '../data/characterArt';
import { getCharacterArtStreamer } from '../art/CharacterArtStreamer';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { getReducedMotion } from '../utils/reducedMotion';

export interface CinematicSceneData {
  cinematicId: string;
  nextScene: string;
  nextData?: object;
}

const CHAR_MS = 28;

export class CinematicScene extends Phaser.Scene {
  private lines: DialogueLine[] = [];
  private lineIndex = 0;
  private nextScene = 'StageSelectScene';
  private nextData?: object;
  private phase: 'typing' | 'ready' | 'transition' | 'finished' = 'transition';
  private lineVersion = 0;
  private inputReadyAt = 0;
  private reducedMotion = false;
  private typeTimer?: Phaser.Time.TimerEvent;
  private pauseTimer?: Phaser.Time.TimerEvent;
  private lineTween?: Phaser.Tweens.Tween;
  private exitTween?: Phaser.Tweens.Tween;

  private folio!: Phaser.GameObjects.Container;
  private speakerText!: Phaser.GameObjects.Text;
  private speakerEmoji!: Phaser.GameObjects.Text;
  private speakerArt!: Phaser.GameObjects.Image;
  private speakerSeal!: Phaser.GameObjects.Graphics;
  private dialogueText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private progressRule!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'CinematicScene' }); }

  create(data?: CinematicSceneData): void {
    this.lines = [];
    this.lineIndex = 0;
    this.phase = 'transition';
    this.lineVersion++;
    this.inputReadyAt = 0;
    this.reducedMotion = getReducedMotion();
    this.nextScene = data?.nextScene ?? 'StageSelectScene';
    this.nextData = data?.nextData;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    const def = getCinematic(data?.cinematicId ?? '');
    if (!def || def.lines.length === 0) {
      this.phase = 'finished';
      this.scene.start(this.nextScene, this.nextData ?? {});
      return;
    }
    this.lines = def.lines;
    const seenResult = markCinematicSeen(loadGameState(), def.id);
    if (seenResult.changed) saveGameState(seenResult.state);

    this.buildTheatre(def.id);
    this.showLine(0);
    this.streamSpeakerArt();
  }

  /** Request every speaker's cutout; redraw the current speaker when theirs lands. */
  private streamSpeakerArt(): void {
    const streamer = getCharacterArtStreamer(this.game);
    const off = streamer.onLoaded(id => {
      const line = this.lines[this.lineIndex];
      if (line && getSpeakerArtId(line.speaker) === id && this.sys.isActive()) this.applySpeakerArt(line);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    const ids = this.lines.map(line => getSpeakerArtId(line.speaker)).filter((id): id is string => Boolean(id));
    streamer.request(new Set(ids));
  }

  private text(x: number, y: number, value: string, size: number, color: string = CSS.TEXT): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color,
    });
  }

  private buildTheatre(id: string): void {
    this.cameras.main.setBackgroundColor(UI.VOID);
    const stone = this.add.graphics();
    stone.fillStyle(UI.SOOT).fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    stone.fillStyle(UI.STONE).fillRect(20, 112, 350, 347);
    stone.fillStyle(UI.VOID).fillRoundedRect(56, 146, 278, 290, { tl: 130, tr: 130, bl: 0, br: 0 });
    stone.lineStyle(2, UI.IRON).strokeRoundedRect(55, 145, 280, 292, { tl: 130, tr: 130, bl: 0, br: 0 });
    stone.fillStyle(UI.STONE_RAISED);
    for (const x of [28, 346]) {
      stone.fillRect(x, 158, 16, 270);
      stone.fillRect(x - 4, 150, 24, 10);
      stone.fillRect(x - 4, 424, 24, 12);
    }
    stone.lineStyle(1, UI.IRON);
    for (let y = 189; y < 410; y += 42) {
      stone.lineBetween(28, y, 44, y);
      stone.lineBetween(346, y, 362, y);
    }
    stone.fillStyle(UI.IRON).fillRect(46, 426, 298, 8);
    stone.fillStyle(UI.STONE_RAISED).fillRect(32, 438, 326, 10);
    stone.lineStyle(1, UI.BRASS, 0.55).lineBetween(32, 103, 358, 103);

    const chapter = id.match(/^ch(\d+)_/);
    const context = chapter ? `${chapter[1]}장 · 수호의 이야기`
      : id === 'game_complete' ? '수호자가 남긴 기록'
        : id.includes('boss') ? '결전을 앞두고' : '던전에서 전해진 이야기';
    this.text(24, 25, context, 11, CSS.MUTED);
    this.text(24, 48, '던전 연대기', 27, CSS.PARCHMENT).setFontStyle('bold');

    const skip = addPrimaryActionButton(this, {
      x: 270, y: 27, w: 96, h: 44, label: '건너뛰기', fontSize: '12px',
      fillColor: UI.SOOT, hoverFillColor: UI.STONE, borderColor: UI.IRON,
      hoverBorderColor: UI.EDGE, textColor: CSS.MUTED, showArrow: false,
      onPress: () => this.finish(),
    });
    skip.zone.setName('cinematic-skip').removeAllListeners('pointerdown');
    skip.zone.on('pointerdown', () => this.finish());

    this.speakerSeal = this.add.graphics();
    this.speakerEmoji = this.text(121, 295, '', 82).setOrigin(0.5).setName('cinematic-speaker-emoji');
    this.speakerArt = this.add.image(195, 284, '__WHITE').setVisible(false).setName('cinematic-speaker-art');
    this.text(195, 449, '수호의 이야기는 계속된다', 11, CSS.MUTED).setOrigin(0.5);

    const panel = addFramedPanel(this, {
      x: 24, y: 473, w: 342, h: 238, radius: 3,
      fillColor: UI.STONE, borderColor: UI.IRON, borderWidth: 1,
      shadowOpacity: 0.3,
    });
    this.folio = this.add.container(0, 0, [panel.shadow, panel.panel, panel.glow]);
    this.speakerText = this.text(44, 492, '', 18, CSS.BRASS).setFontStyle('bold').setName('cinematic-speaker');
    this.progressText = this.text(344, 496, '', 12, CSS.MUTED).setOrigin(1, 0).setName('cinematic-progress');
    this.dialogueText = this.text(44, 535, '', 18, CSS.PARCHMENT)
      .setWordWrapWidth(302).setLineSpacing(9).setName('cinematic-dialogue');
    this.hintText = this.text(44, 680, '', 11, CSS.MUTED).setName('cinematic-hint');
    this.progressRule = this.add.graphics();
    this.folio.add([this.speakerText, this.progressText, this.dialogueText, this.hintText, this.progressRule]);

    const tapZone = this.add.zone(24, 473, 342, 238).setOrigin(0).setInteractive().setName('cinematic-dialogue-tap');
    tapZone.on('pointerdown', () => this.onTap());
    const action = addPrimaryActionButton(this, {
      x: 24, y: 739, w: 342, h: 50, label: '대사 펼치기', fontSize: '16px',
      fillColor: UI.BRASS, hoverFillColor: UI.BRASS_BRIGHT,
      borderColor: UI.BRASS_BRIGHT, hoverBorderColor: UI.BRASS_BRIGHT,
      textColor: '#101612', onPress: () => this.onTap(),
    });
    this.actionText = action.text.setName('cinematic-action-label');
    action.zone.setName('cinematic-next').removeAllListeners('pointerdown');
    action.zone.on('pointerdown', () => this.onTap());
    this.text(195, 812, '대사를 누르거나 아래 명령으로 진행하세요', 11, CSS.MUTED).setOrigin(0.5);
  }

  private showLine(index: number): void {
    this.clearLineWork();
    const version = ++this.lineVersion;
    const line = this.lines[index];
    this.lineIndex = index;
    this.inputReadyAt = this.time.now + 120;
    this.speakerText.setText(line.speaker);
    this.progressText.setText(`${index + 1} / ${this.lines.length}`);
    this.progressRule.clear().fillStyle(UI.IRON).fillRect(44, 522, 302, 1);
    this.progressRule.fillStyle(UI.BRASS).fillRect(44, 522, 302 * (index + 1) / this.lines.length, 1);

    this.applySpeakerArt(line);
    this.dialogueText.setAlpha(1).setText('');
    this.phase = 'typing';
    this.actionText.setText('대사 펼치기');
    this.hintText.setText('누르면 대사 전체를 바로 읽습니다');

    if (this.reducedMotion || line.text.length === 0) {
      this.revealLine(version);
      return;
    }
    let shown = 0;
    this.typeTimer = this.time.addEvent({
      delay: CHAR_MS, repeat: line.text.length - 1,
      callback: () => {
        if (version !== this.lineVersion || this.phase !== 'typing') return;
        this.dialogueText.setText(line.text.slice(0, ++shown));
        if (shown >= line.text.length) this.revealLine(version);
      },
    });
  }

  /** Speaker portrait (guardian or boss cutout) or the emoji seal until art streams in. */
  private applySpeakerArt(line: DialogueLine): void {
    const speakerX = line.side === 'left' ? 126 : 264;
    this.speakerEmoji.setPosition(speakerX, 289).setText(line.emoji).setAlpha(1).setScale(1);
    const source = selectSpeakerArtSource(line.speaker, key => this.textures.exists(key));
    this.speakerEmoji.setVisible(!source);
    this.speakerArt.setVisible(Boolean(source));
    if (source) {
      this.speakerArt.setTexture(source.textureKey)
        .setPosition(line.side === 'left' ? 155 : 235, 284).setDisplaySize(248, 248);
    }
    this.speakerSeal.clear();
    if (!source) {
      this.speakerSeal.fillStyle(UI.STONE_RAISED).fillCircle(speakerX, 289, 66);
      this.speakerSeal.lineStyle(1, UI.BRASS, 0.7).strokeCircle(speakerX, 289, 70);
    }
    this.speakerSeal.lineStyle(2, UI.BRASS).lineBetween(speakerX - 36, 423, speakerX + 36, 423);
  }

  private revealLine(version = this.lineVersion): void {
    if (version !== this.lineVersion || this.phase !== 'typing') return;
    this.typeTimer?.remove(false);
    this.typeTimer = undefined;
    const line = this.lines[this.lineIndex];
    this.dialogueText.setText(line.text);
    this.phase = 'ready';
    this.actionText.setText(this.lineIndex === this.lines.length - 1 ? '이야기 마치기' : '다음 대사');
    this.hintText.setText(line.pause ? '잠시 후 이어집니다 · 눌러서 바로 진행' : '준비되면 다음 이야기를 펼치세요');
    if (line.pause && line.pause > 0) {
      const index = this.lineIndex;
      this.pauseTimer = this.time.delayedCall(line.pause, () => {
        if (version === this.lineVersion) this.advance(index);
      });
    }
  }

  private onTap(): void {
    if (this.time.now < this.inputReadyAt) return;
    if (this.phase === 'typing') {
      this.inputReadyAt = this.time.now + 180;
      this.revealLine();
    } else if (this.phase === 'ready') {
      this.advance(this.lineIndex);
    }
  }

  private advance(index: number): void {
    if (this.phase !== 'ready' || index !== this.lineIndex) return;
    this.phase = 'transition';
    this.clearLineWork();
    if (index + 1 >= this.lines.length) {
      this.finish();
      return;
    }
    const version = this.lineVersion;
    if (this.reducedMotion) {
      this.showLine(index + 1);
      return;
    }
    this.lineTween = this.tweens.add({
      targets: this.dialogueText, alpha: 0, duration: 140,
      onComplete: () => {
        this.lineTween = undefined;
        if (version === this.lineVersion && this.phase === 'transition') this.showLine(index + 1);
      },
    });
  }

  private finish(): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.clearLineWork();
    const version = ++this.lineVersion;
    const route = (): void => {
      if (version === this.lineVersion) this.scene.start(this.nextScene, this.nextData ?? {});
    };
    if (this.reducedMotion) {
      route();
      return;
    }
    this.exitTween = this.tweens.add({
      targets: this.folio, alpha: 0, duration: 160, onComplete: route,
    });
  }

  private clearLineWork(): void {
    this.typeTimer?.remove(false);
    this.pauseTimer?.remove(false);
    this.lineTween?.stop();
    this.typeTimer = undefined;
    this.pauseTimer = undefined;
    this.lineTween = undefined;
  }

  private cleanup(): void {
    this.phase = 'finished';
    this.lineVersion++;
    this.clearLineWork();
    this.exitTween?.stop();
    this.exitTween = undefined;
  }
}
