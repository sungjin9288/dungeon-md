import Phaser from 'phaser';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { getEndlessModifierById } from '../data/endlessModifiers';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';

interface EndlessResult {
  wave: number;
  kills: number;
  goldEarned: number;
  crystalsEarned: number;
  isNewRecord: boolean;
  previousBest: number;
}

// The combat flow has already awarded this receipt. Rendering never grants again.
export class EndlessResultScene extends Phaser.Scene {
  private leaving = false;

  constructor() { super({ key: 'EndlessResultScene' }); }

  create(): void {
    this.leaving = false;
    const result = this.registry.get('endlessResult') as EndlessResult | undefined;
    if (!result) {
      this.scene.start('StageSelectScene');
      return;
    }

    this.cameras.main.setAlpha(1);
    this.drawBackground();
    this.label(195, 36, '무한 던전 원정록', 21, DUNGEON_UI_CSS.PARCHMENT, true).setOrigin(0.5);
    this.label(195, 68, '끝난 원정을 돌아보고, 다음 방어를 준비하세요', 11,
      DUNGEON_UI_CSS.MUTED).setOrigin(0.5);
    this.drawRecord(result);
    this.drawLedger(result);
    this.drawModifier();
    this.label(195, 628, '영혼 결정 지급 완료', 13, DUNGEON_UI_CSS.JADE, true).setOrigin(0.5);
    this.label(195, 654, '이번 원정에서 얻은 기록은 다음 도전에도 남습니다', 11,
      DUNGEON_UI_CSS.MUTED).setOrigin(0.5);
    this.drawActions();
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-900);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(14, 96, CANVAS_WIDTH - 28, 518);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.5);
    for (let y = 108; y < 610; y += 42) g.lineBetween(22, y, 368, y);
    // A carved threshold frames the reached wave, without competing with actions.
    g.fillStyle(DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(76, 110, 238, 214, 86);
    g.lineStyle(2, DUNGEON_UI.IRON, 1);
    g.strokeRoundedRect(76, 110, 238, 214, 86);
    g.lineStyle(1, DUNGEON_UI.BRASS, 0.4);
    g.lineBetween(112, 311, 278, 311);
  }

  private drawRecord(result: EndlessResult): void {
    const { wave, previousBest, isNewRecord } = result;
    const status = isNewRecord ? '새로운 최고 기록' : previousBest === 0
      ? '첫 원정 기록' : wave === previousBest ? '최고 기록과 동률' : '원정 종료';
    this.label(195, 144, status, 13,
      isNewRecord ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.BRASS, true).setOrigin(0.5);
    this.label(195, 205, formatHudResourceValue(wave), 56, DUNGEON_UI_CSS.PARCHMENT, true)
      .setOrigin(0.5).setName('endless-wave');
    this.label(195, 249, '도달 웨이브', 12, DUNGEON_UI_CSS.TEXT).setOrigin(0.5);
    const comparison = previousBest === 0 ? '새로운 여정의 첫 이정표' : wave > previousBest
      ? `이전 ${formatHudResourceValue(previousBest)}파 · ${formatHudResourceValue(wave - previousBest)}파 돌파`
      : wave === previousBest ? `이전 최고 ${formatHudResourceValue(previousBest)}파 유지`
        : `이전 최고 ${formatHudResourceValue(previousBest)}파 · ${formatHudResourceValue(previousBest - wave)}파 차이`;
    this.label(195, 285, comparison, 11, DUNGEON_UI_CSS.MUTED).setOrigin(0.5);
  }

  private drawLedger(result: EndlessResult): void {
    addFramedPanel(this, {
      x: 28, y: 341, w: 334, h: 167,
      fillColor: DUNGEON_UI.STONE_RAISED, borderColor: DUNGEON_UI.IRON,
      shadowOpacity: 0.2,
    });
    const rows = [
      { label: '처치한 침략자', value: result.kills, color: DUNGEON_UI_CSS.PARCHMENT },
      { label: '원정 중 획득 골드', value: result.goldEarned, color: DUNGEON_UI_CSS.BRASS },
      { label: '지급된 영혼 결정', value: result.crystalsEarned, color: DUNGEON_UI_CSS.JADE },
    ];
    rows.forEach((row, index) => {
      const y = 373 + index * 52;
      this.label(44, y, row.label, 12, DUNGEON_UI_CSS.TEXT).setOrigin(0, 0.5);
      this.label(346, y, row.value.toLocaleString('ko-KR'), 17, row.color, true)
        .setOrigin(1, 0.5).setName(`endless-stat-${index}`);
      if (index < rows.length - 1) {
        const line = this.add.graphics();
        line.lineStyle(1, DUNGEON_UI.IRON, 0.55);
        line.lineBetween(44, y + 25, 346, y + 25);
      }
    });
  }

  private drawModifier(): void {
    const modifier = getEndlessModifierById(this.registry.get('endlessModifier'));
    this.label(32, 533, '이번 원정의 도전 변수', 11, DUNGEON_UI_CSS.MUTED);
    this.label(32, 556, modifier ? modifier.name : '기본 도전', 14,
      DUNGEON_UI_CSS.PARCHMENT, true);
    this.label(32, 583, modifier?.desc ?? '적용된 도전 변수 없음', 11,
      DUNGEON_UI_CSS.TEXT).setWordWrapWidth(326).setLineSpacing(3);
  }

  private drawActions(): void {
    const actions = [
      { name: 'endless-retry', y: 687, label: '다시 도전', primary: true, route: 'DungeonScene' },
      { name: 'endless-return', y: 751, label: '스테이지 선택', primary: false, route: 'StageSelectScene' },
    ];
    for (const action of actions) {
      const button = addPrimaryActionButton(this, {
        x: 28, y: action.y, w: 334, h: 50,
        label: action.label, fontSize: '15px', showArrow: action.primary,
        fillColor: action.primary ? DUNGEON_UI.BRASS : DUNGEON_UI.STONE,
        hoverFillColor: action.primary ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON,
        borderColor: action.primary ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON,
        textColor: action.primary ? '#171006' : DUNGEON_UI_CSS.TEXT,
        onPress: () => {
          if (action.primary) {
            this.registry.set('stageConfig', { stageNumber: 0, endless: true });
          }
          this.scene.start(action.route);
        },
      });
      button.zone.setName(action.name);
      const press = button.zone.listeners('pointerdown')[0] as () => void;
      button.zone.removeAllListeners('pointerdown');
      button.zone.on('pointerdown', () => {
        if (this.leaving) return;
        this.leaving = true;
        press();
      });
    }
    this.label(195, 823, '재도전 시 새로운 도전 변수가 선택됩니다', 11,
      DUNGEON_UI_CSS.MUTED).setOrigin(0.5);
  }

  private label(x: number, y: number, text: string, size: number, color: string, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color,
      fontStyle: bold ? 'bold' : 'normal',
    });
  }
}
