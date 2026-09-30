/**
 * Legion Codex — fixed-view guardian, invader, modifier, and event archive.
 * Selectors are presentation-only. Reward orders are revalidated from the same
 * current save passed to the existing pure transactions.
 */

import { ENDLESS_MODIFIER_SIGILS, WAVE_EVENT_SIGILS } from '../ui/sigilMaps';
import { addSigil, type SigilKind } from '../ui/Sigils';
import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH, ROOT_NAV_Y } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import {
  MONSTER_DEFS,
  getSkinForMonster,
  resolveMonsterTypeId,
  type MonsterId,
  type TribeId,
} from '../data/monsters';
import { INVADER_DEFS } from '../data/invaders';
import { ENDLESS_MODIFIERS } from '../data/endlessModifiers';
import { WAVE_EVENTS } from '../data/waveEvents';
import { getTraitBlurb } from '../data/invaderTraits';
import { claimAllCodexTribeRewards, claimCodexTribeReward } from '../data/rewardTransactions';
import {
  TRIBE_META,
  getClaimableCodexTribes,
  getCodexTribeProgress,
  getDexNo,
  getRarityMeta,
} from '../ui/CodexShared';
import { showCodexMonsterDetail } from '../ui/CodexMonsterDetail';
import { generatePortrait } from '../art/PortraitGenerator';
import { getCharacterArtStreamer } from '../art/CharacterArtStreamer';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addSceneHeader,
  addTabBar,
  type PrimaryActionButtonRefs,
} from '../ui/GameUiPrimitives';
import { buildHomeZoneNavigation } from '../ui/GameZoneNavigation';
import { getContextualBackTarget, getZoneDestination } from '../data/navigationContract';

type CodexTab = 'monsters' | 'invaders' | 'modifiers' | 'events';
type GuardianGroupId = TribeId | 'unaffiliated';
type MonsterRecord = (typeof MONSTER_DEFS)[MonsterId];
type InvaderRecord = (typeof INVADER_DEFS)[keyof typeof INVADER_DEFS];
type ReceiptTone = 'success' | 'warning';

interface GuardianGroup {
  readonly id: GuardianGroupId;
  readonly label: string;
  readonly name: string;
  readonly accent: number;
}

interface Receipt {
  readonly title: string;
  readonly detail: string;
  readonly tone: ReceiptTone;
}

interface IntelRecord {
  readonly id: string;
  readonly sigil: SigilKind;
  readonly name: string;
  readonly summary: string;
  readonly detail: string;
  readonly metrics: string;
  readonly accent: number;
}

const GROUPS: readonly GuardianGroup[] = [
  ...TRIBE_META.map(tribe => ({
    id: tribe.id,
    label: tribe.name.replace(/족$/, ''),
    name: tribe.name,
    accent: tribe.color,
  })),
  { id: 'unaffiliated', label: '기타', name: '독립 기록', accent: DUNGEON_UI.EDGE },
];

const TABS: readonly { id: CodexTab; label: string }[] = [
  { id: 'monsters', label: '수호자' },
  { id: 'invaders', label: '침략자' },
  { id: 'modifiers', label: '도전 변수' },
  { id: 'events', label: '웨이브 사건' },
];

const X = 14;
const W = CANVAS_WIDTH - X * 2;
const STATUS_Y = 74;
const TABS_Y = 132;
const CONTENT_Y = 182;
/** Two rows of four: a tribe of 20 fits in three pages instead of seven. */
const GUARDIAN_COLS = 4;
const RECORDS_PER_GUARDIAN_PAGE = GUARDIAN_COLS * 2;
const GUARDIAN_CARD_H = 82;
/** Pager sits under the two card rows; the one-line detail under the pager, clear of the reward panel (614). */
const GUARDIAN_DETAIL_Y = 344 + 2 * (GUARDIAN_CARD_H + 6) + 46;
const RECORDS_PER_INVADER_PAGE = 3;
const RECORDS_PER_INTEL_PAGE = 4;
const COOLDOWN_MS = 250;

export class CodexScene extends Phaser.Scene {
  private gameState!: GameState;
  private codexTab: CodexTab = 'monsters';
  private showOwnedOnly = false;
  private guardianGroup: GuardianGroupId = 'dokkaebi';
  private guardianPage = 0;
  private selectedMonsterId = '';
  private invaderChapter = 1;
  private invaderPage = 0;
  private selectedInvaderId = '';
  private modifierPage = 0;
  private eventPage = 0;
  private selectedModifierId = '';
  private selectedEventId = '';
  private receipt: Receipt | null = null;
  private transactionPending = false;
  private lastTransactionAt = 0;
  private detailOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'CodexScene' });
  }

  private visibleArtIds = new Set<string>();
  private artRedrawQueued = false;

  create(): void {
    this.gameState = loadGameState();
    this.codexTab = this.readTab();
    this.showOwnedOnly = this.registry.get('codexOwnedFilter') === true;
    this.guardianGroup = 'dokkaebi';
    this.guardianPage = 0;
    this.invaderChapter = 1;
    this.invaderPage = 0;
    this.modifierPage = 0;
    this.eventPage = 0;
    this.receipt = null;
    this.transactionPending = false;
    this.lastTransactionAt = 0;
    this.detailOverlay = null;
    this.visibleArtIds = new Set();
    this.artRedrawQueued = false;
    const off = getCharacterArtStreamer(this.game).onLoaded(id => {
      if (!this.visibleArtIds.has(id) || this.artRedrawQueued) return;
      this.artRedrawQueued = true;
      this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
        this.artRedrawQueued = false;
        if (this.sys.isActive()) this.render();
      });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.resetCamera();
    this.render();
  }

  private render(): void {
    this.clearRenderedObjects();
    this.resetCamera();
    this.reconcileSelections();
    this.drawBackdrop();
    this.drawHeader();
    this.drawStatus();
    this.drawTabs();
    if (this.codexTab === 'monsters') this.drawGuardians();
    else if (this.codexTab === 'invaders') this.drawInvaders();
    else this.drawIntel(this.codexTab);
    buildHomeZoneNavigation(this, 'legion', zone => {
      if (this.transactionPending || this.detailOverlay) return;
      this.transactionPending = true;
      this.scene.start(getZoneDestination(zone));
    });
  }

  private clearRenderedObjects(): void {
    this.tweens.killAll();
    for (const child of [...this.children.list]) child.destroy();
    this.detailOverlay = null;
  }

  private resetCamera(): void {
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.cameras.main.centerOn(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }

  private drawBackdrop(): void {
    const g = this.add.graphics().setDepth(-900);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 66, CANVAS_WIDTH, ROOT_NAV_Y - 66);
    g.fillStyle(DUNGEON_UI.STONE, 0.75);
    g.fillRect(0, 66, 16, ROOT_NAV_Y - 66);
    g.fillRect(CANVAS_WIDTH - 16, 66, 16, ROOT_NAV_Y - 66);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.34);
    for (let y = 84; y < ROOT_NAV_Y; y += 44) {
      g.lineBetween(16, y, CANVAS_WIDTH - 16, y);
      const offset = ((y - 84) / 44) % 2 === 0 ? 18 : 46;
      for (let x = offset; x < CANVAS_WIDTH - 16; x += 72) g.lineBetween(x, y, x, y + 44);
    }
    g.fillStyle(DUNGEON_UI.BRASS, 0.035);
    g.fillCircle(CANVAS_WIDTH / 2, 424, 172);
    g.lineStyle(1.5, DUNGEON_UI.BRASS, 0.16);
    g.lineBetween(24, 69, CANVAS_WIDTH - 24, 69);
  }

  private drawHeader(): void {
    const header = addSceneHeader(this, {
      title: '군단 도감',
      subtitle: '수호자와 침략 기록을 열람하고 부족 보상을 회수',
      y: 26,
      onBack: () => {
        if (this.transactionPending || this.detailOverlay) return;
        this.transactionPending = true;
        this.scene.start((this.registry.get('previousScene') as string | undefined)
          ?? getContextualBackTarget('CodexScene'));
      },
    });
    (header.container.list.find(child => child.type === 'Zone') as Phaser.GameObjects.Zone | undefined)
      ?.setName('codex-back');
  }

  private drawStatus(): void {
    this.panel(STATUS_Y, 52, DUNGEON_UI.IRON);
    const cells = [
      { label: '보유 수호자', value: `${this.ownedTypes().size} / ${Object.keys(MONSTER_DEFS).length}`, color: DUNGEON_UI_CSS.JADE },
      { label: '보상 회수', value: `${new Set(this.gameState.codexRewardsClaimed ?? []).size} / ${TRIBE_META.length}`, color: DUNGEON_UI_CSS.BRASS },
      { label: '현재 기록', value: `${this.currentCount()}건`, color: DUNGEON_UI_CSS.TEXT },
    ];
    cells.forEach((cell, index) => {
      const cellW = W / 3;
      const cx = X + index * cellW;
      if (index > 0) {
        const divider = this.add.graphics();
        divider.lineStyle(1, DUNGEON_UI.IRON, 0.9);
        divider.lineBetween(cx, STATUS_Y + 9, cx, STATUS_Y + 43);
      }
      this.add.text(cx + cellW / 2, STATUS_Y + 16, cell.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);
      this.add.text(cx + cellW / 2, STATUS_Y + 36, cell.value, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: cell.color,
      }).setOrigin(0.5);
    });
  }

  private drawTabs(): void {
    const refs = addTabBar(this, {
      tabs: TABS,
      active: this.codexTab,
      y: TABS_Y,
      height: 44,
      fontSize: '11px',
      accent: DUNGEON_UI.BRASS,
      onSelect: tab => {
        if (this.transactionPending || this.detailOverlay || tab === this.codexTab) return;
        this.codexTab = tab;
        this.registry.set('codexActiveTab', tab);
        this.render();
      },
    });
    refs.container.list.filter(child => child.type === 'Zone').forEach((zone, index) => {
      zone.setName(`codex-tab-${TABS[index]?.id ?? index}`);
    });
  }

  // ── Guardian archive ──────────────────────────────────────────────────────

  private drawGuardians(): void {
    this.drawGroupSeals();
    const records = this.guardianRecords();
    this.reconcileGuardian(records);
    this.drawGuardianLedger(records);
    this.drawGuardianPage(records);
    this.drawGuardianDetail(records);
    this.drawRewardCommand();
  }

  private drawGroupSeals(): void {
    const gap = 4;
    const buttonW = (W - gap * 5) / 6;
    GROUPS.forEach((group, index) => {
      const active = group.id === this.guardianGroup;
      this.button({
        name: `codex-group-${group.id}`,
        x: X + (index % 6) * (buttonW + gap),
        y: CONTENT_Y + Math.floor(index / 6) * 48,
        w: buttonW,
        label: group.label,
        fontSize: '10px',
        fill: active ? DUNGEON_UI.BRASS : DUNGEON_UI.STONE,
        border: active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE,
        textColor: active ? '#171006' : DUNGEON_UI_CSS.TEXT,
        onPress: () => {
          if (this.guardianGroup === group.id) return;
          this.guardianGroup = group.id;
          this.guardianPage = 0;
          this.selectedMonsterId = '';
          this.render();
        },
      });
    });
  }

  private drawGuardianLedger(records: readonly MonsterRecord[]): void {
    const group = GROUPS.find(entry => entry.id === this.guardianGroup)!;
    this.panel(276, 62, group.accent, group.accent);
    if (this.guardianGroup === 'unaffiliated') {
      this.leftText(30, 294, `${group.name} · ${records.length}종`, 12, DUNGEON_UI_CSS.PARCHMENT, true);
      this.leftText(30, 318, '부족 보상과 분리된 전체 registry 기록', 10, DUNGEON_UI_CSS.MUTED);
    } else {
      const progress = getCodexTribeProgress(this.gameState, this.guardianGroup);
      const reward = progress.rewardMonsterId ? MONSTER_DEFS[progress.rewardMonsterId] : undefined;
      this.leftText(30, 294, `${group.name} · 보유 ${progress.ownedCount}/${progress.allMonsterIds.length}`, 12, DUNGEON_UI_CSS.PARCHMENT, true);
      this.leftText(30, 318, `보상 기준 ${progress.requiredOwnedCount}/${progress.requiredMonsterIds.length} · ${reward?.name ?? '보상 없음'}`, 10,
        progress.claimable ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED);
    }
    this.button({
      name: 'codex-owned-filter', x: X + W - 82, y: 285, w: 70,
      label: this.showOwnedOnly ? '보유만' : '전체', fontSize: '10px',
      fill: this.showOwnedOnly ? DUNGEON_UI.JADE : DUNGEON_UI.STONE,
      border: this.showOwnedOnly ? DUNGEON_UI.JADE : DUNGEON_UI.EDGE,
      textColor: this.showOwnedOnly ? '#07110b' : DUNGEON_UI_CSS.TEXT,
      onPress: () => {
        this.showOwnedOnly = !this.showOwnedOnly;
        this.registry.set('codexOwnedFilter', this.showOwnedOnly);
        this.guardianPage = 0;
        this.selectedMonsterId = '';
        this.render();
      },
    });
  }

  private drawGuardianPage(records: readonly MonsterRecord[]): void {
    const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_GUARDIAN_PAGE));
    const start = this.guardianPage * RECORDS_PER_GUARDIAN_PAGE;
    const visible = records.slice(start, start + RECORDS_PER_GUARDIAN_PAGE);
    // Ritual-v2 cutouts stream in per page; the card redraws when one lands.
    this.visibleArtIds = new Set(visible.map(monster => monster.id));
    getCharacterArtStreamer(this.game).request(this.visibleArtIds);
    const gap = 6;
    const cardW = (W - gap * (GUARDIAN_COLS - 1)) / GUARDIAN_COLS;
    visible.forEach((monster, index) => this.drawGuardianCard(
      monster,
      X + (index % GUARDIAN_COLS) * (cardW + gap),
      344 + Math.floor(index / GUARDIAN_COLS) * (GUARDIAN_CARD_H + gap),
      cardW,
    ));
    if (visible.length === 0) {
      this.panel(344, 96, DUNGEON_UI.IRON);
      this.centerText(CANVAS_WIDTH / 2, 392, '현재 filter에 표시할 수호자가 없습니다', 11, DUNGEON_UI_CSS.MUTED);
    }
    this.pager({
      y: 344 + 2 * (GUARDIAN_CARD_H + gap),
      label: records.length ? `${start + 1}–${Math.min(records.length, start + visible.length)} / ${records.length}` : '0 / 0',
      page: this.guardianPage,
      pageCount,
      prefix: 'codex-guardian-page',
      onChange: direction => {
        const next = Phaser.Math.Clamp(this.guardianPage + direction, 0, pageCount - 1);
        if (next === this.guardianPage) return;
        this.guardianPage = next;
        this.selectedMonsterId = records[next * RECORDS_PER_GUARDIAN_PAGE]?.id ?? '';
        this.render();
      },
    });
  }

  private drawGuardianCard(monster: MonsterRecord, x: number, y: number, w: number): void {
    const selected = monster.id === this.selectedMonsterId;
    const owned = this.isOwned(monster.id);
    const rarity = getRarityMeta(monster.rarityTier);
    const h = GUARDIAN_CARD_H;
    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(selected ? 2 : 1, selected ? DUNGEON_UI.BRASS_BRIGHT : owned ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, selected ? 1 : 0.8);
    g.strokeRoundedRect(x, y, w, h, 8);
    if (selected) {
      // Along the bottom edge: at the top it crossed the dex number.
      g.fillStyle(DUNGEON_UI.BRASS, 1);
      g.fillRect(x + 8, y + GUARDIAN_CARD_H - 4, w - 16, 2);
    }
    if (owned) {
      const skin = getSkinForMonster(monster.id, this.gameState.equippedSkins ?? {});
      const key = generatePortrait(this, monster.id, skin?.id);
      if (this.textures.exists(key)) this.add.image(x + w / 2, y + 40, key).setDisplaySize(40, 40);
      else this.centerText(x + w / 2, y + 40, skin?.emoji ?? monster.emoji, 26, '#ffffff');
    } else {
      g.fillStyle(DUNGEON_UI.VOID, 0.88);
      g.fillCircle(x + w / 2, y + 40, 18);
      this.centerText(x + w / 2, y + 40, '?', 20, DUNGEON_UI_CSS.MUTED, true);
    }
    // Owned = jade frame; the old "보유 · 열람 가능" line did not fit four across.
    this.leftText(x + 6, y + 11, `#${getDexNo(monster.id)}`, 10, rarity.css, true);
    this.rightText(x + w - 6, y + 11, rarity.label, 10, rarity.css, true);
    this.centerText(x + w / 2, y + h - 12, monster.name, 10, owned ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED, true, w - 8);
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.setName(`codex-guardian-record-${monster.id}`);
    zone.on('pointerdown', () => {
      if (this.transactionPending || this.detailOverlay || this.selectedMonsterId === monster.id) return;
      this.selectedMonsterId = monster.id;
      this.render();
    });
  }

  /** One line under the pager: the selected record's gist and the detail button (was a 112px panel). */
  private drawGuardianDetail(records: readonly MonsterRecord[]): void {
    const monster = records.find(record => record.id === this.selectedMonsterId) ?? records[0];
    const owned = monster ? this.isOwned(monster.id) : false;
    const y = GUARDIAN_DETAIL_Y;
    this.panel(y, 44, owned ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, owned ? DUNGEON_UI.JADE : DUNGEON_UI.IRON);
    if (!monster) {
      this.centerText(CANVAS_WIDTH / 2, y + 22, '선택 가능한 기록이 없습니다', 11, DUNGEON_UI_CSS.MUTED);
      return;
    }
    const rarity = getRarityMeta(monster.rarityTier);
    this.leftText(30, y + 13, `${monster.name} · ${rarity.stars} ${rarity.label} · ${this.elementLabel(monster.element)}`, 11,
      DUNGEON_UI_CSS.PARCHMENT, true, W - 130);
    this.leftText(30, y + 31, owned
      ? `ATK ${monster.baseDamage} · COOL ${(monster.attackCooldown / 1000).toFixed(1)}s · RANGE ${monster.range}`
      : `획득 · ${this.unlockLabel(monster.unlockMethod)}`, 10, owned ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED, false, W - 130);
    this.button({
      name: 'codex-detail-open', x: X + W - 96, y, w: 88,
      label: owned ? '상세 열람' : '미보유', fontSize: '10px', enabled: owned,
      fill: DUNGEON_UI.JADE, border: DUNGEON_UI.JADE, textColor: '#07110b',
      onPress: () => {
        if (!owned) return;
        this.detailOverlay = showCodexMonsterDetail(this, monster, this.gameState, () => { this.detailOverlay = null; });
      },
    });
  }

  private drawRewardCommand(): void {
    const progress = this.guardianGroup === 'unaffiliated'
      ? null
      : getCodexTribeProgress(this.gameState, this.guardianGroup);
    const reward = progress?.rewardMonsterId ? MONSTER_DEFS[progress.rewardMonsterId] : undefined;
    const eligible = getClaimableCodexTribes(this.gameState);
    const claimable = progress?.claimable ?? false;
    const tone = claimable ? DUNGEON_UI.BRASS : progress?.claimed ? DUNGEON_UI.JADE : DUNGEON_UI.IRON;
    this.panel(614, 158, tone);
    const status = !progress
      ? '독립 기록에는 부족 보상이 없습니다'
      : progress.claimed
        ? `${reward?.name ?? '부족 보상'} · 회수 완료`
        : claimable
          ? `${reward?.name ?? '부족 보상'} · 지금 회수 가능`
          : `${reward?.name ?? '부족 보상'} · 필수 기록 ${progress.missingMonsterIds.length}종 남음`;
    this.leftText(30, 632, status, 10,
      claimable ? DUNGEON_UI_CSS.BRASS : progress?.claimed ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED, true);
    const receiptTone = this.receipt?.tone === 'warning' ? DUNGEON_UI.EMBER : this.receipt ? DUNGEON_UI.JADE : DUNGEON_UI.IRON;
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.82);
    g.fillRoundedRect(28, 644, W - 28, 60, 7);
    g.lineStyle(1, receiptTone, this.receipt ? 0.92 : 0.62);
    g.strokeRoundedRect(28, 644, W - 28, 60, 7);
    this.leftText(40, 661, this.receipt?.title ?? '보상 기록 대기', 10,
      this.receipt?.tone === 'warning' ? DUNGEON_UI_CSS.EMBER : this.receipt ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED, true);
    this.leftText(40, 686, this.receipt?.detail ?? '수령 결과와 보유 변동이 이곳에 표시됩니다', 10,
      this.receipt ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED, false, W - 52);
    const hasAll = eligible.length > 0;
    const primaryW = hasAll ? 214 : W - 28;
    this.button({
      name: 'codex-claim-selected', x: 28, y: 714, w: primaryW, h: 48,
      label: claimable && reward ? `${reward.name} 회수` : progress?.claimed ? '부족 보상 회수 완료' : '선택 부족 보상 대기',
      fontSize: claimable ? '11px' : '10px', enabled: claimable, kind: 'transaction',
      fill: DUNGEON_UI.BRASS, border: DUNGEON_UI.BRASS, textColor: '#171006',
      onPress: () => this.claimSelected(),
    });
    if (hasAll) {
      this.button({
        name: 'codex-claim-all', x: 250, y: 714, w: 112, h: 48,
        label: `전체 회수 ${eligible.length}`, fontSize: '10px', kind: 'transaction',
        fill: DUNGEON_UI.STONE_RAISED, border: DUNGEON_UI.JADE, textColor: DUNGEON_UI_CSS.JADE,
        onPress: () => this.claimAll(),
      });
    }
  }

  // ── Invader archive ───────────────────────────────────────────────────────

  private drawInvaders(): void {
    const gap = 6;
    const buttonW = (W - gap * 2) / 3;
    for (let chapter = 1; chapter <= 9; chapter += 1) {
      const index = chapter - 1;
      const active = chapter === this.invaderChapter;
      this.button({
        name: `codex-invader-chapter-${chapter}`,
        x: X + (index % 3) * (buttonW + gap), y: CONTENT_Y + Math.floor(index / 3) * 48, w: buttonW,
        label: `Chapter ${chapter}`, fontSize: '10px',
        fill: active ? DUNGEON_UI.EMBER : DUNGEON_UI.STONE,
        border: active ? DUNGEON_UI.EMBER : DUNGEON_UI.EDGE,
        textColor: active ? '#180705' : DUNGEON_UI_CSS.TEXT,
        onPress: () => {
          if (chapter === this.invaderChapter) return;
          this.invaderChapter = chapter;
          this.invaderPage = 0;
          this.selectedInvaderId = '';
          this.render();
        },
      });
    }
    const records = this.invaderRecords();
    this.reconcileInvader(records);
    const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_INVADER_PAGE));
    const start = this.invaderPage * RECORDS_PER_INVADER_PAGE;
    const visible = records.slice(start, start + RECORDS_PER_INVADER_PAGE);
    this.ledger({
      y: 330, title: `Chapter ${this.invaderChapter} 침략 정보`,
      detail: `${start + 1}–${Math.min(records.length, start + visible.length)} / ${records.length} · 전술 행동 포함`,
      page: this.invaderPage, pageCount, prefix: 'codex-invader-page', accent: DUNGEON_UI.EMBER,
      onChange: direction => {
        const next = Phaser.Math.Clamp(this.invaderPage + direction, 0, pageCount - 1);
        if (next === this.invaderPage) return;
        this.invaderPage = next;
        this.selectedInvaderId = records[next * RECORDS_PER_INVADER_PAGE]?.type ?? '';
        this.render();
      },
    });
    visible.forEach((record, index) => this.drawInvaderCard(record, 394 + index * 66));
    this.drawInvaderDetail(records);
  }

  private drawInvaderCard(record: InvaderRecord, y: number): void {
    const selected = record.type === this.selectedInvaderId;
    const danger = record.isBoss || record.isMiniBoss;
    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(X, y, W, 60, 8);
    g.lineStyle(selected ? 2 : 1, selected ? DUNGEON_UI.BRASS_BRIGHT : danger ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON, selected ? 1 : 0.82);
    g.strokeRoundedRect(X, y, W, 60, 8);
    g.fillStyle(record.color, 0.9);
    g.fillCircle(42, y + 30, record.isBoss ? 10 : 7);
    this.leftText(64, y + 19, record.koreanName, 12, DUNGEON_UI_CSS.PARCHMENT, true);
    this.rightText(X + W - 14, y + 19, record.isBoss ? 'BOSS' : record.isMiniBoss ? '정예' : '일반', 10,
      danger ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED, true);
    this.leftText(64, y + 42, `HP ${record.hp} · 속도 ${record.speed} · 피해 ${record.damage} · 보상 ${record.reward}`, 10, DUNGEON_UI_CSS.MUTED);
    const zone = this.add.zone(X, y, W, 60).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.setName(`codex-invader-record-${record.type}`);
    zone.on('pointerdown', () => {
      if (this.transactionPending || this.detailOverlay || record.type === this.selectedInvaderId) return;
      this.selectedInvaderId = record.type;
      this.render();
    });
  }

  private drawInvaderDetail(records: readonly InvaderRecord[]): void {
    const selected = records.find(record => record.type === this.selectedInvaderId) ?? records[0];
    this.panel(596, 176, selected?.isBoss ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON,
      selected?.isBoss ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON);
    if (!selected) return;
    this.leftText(32, 618, selected.koreanName, 15, DUNGEON_UI_CSS.PARCHMENT, true);
    this.rightText(X + W - 16, 618, `Chapter ${selected.chapter ?? 1}`, 10, DUNGEON_UI_CSS.EMBER, true);
    this.leftText(32, 648, `HP ${selected.hp} · 이동 ${selected.speed} · 돌파 피해 ${selected.damage} · 처치 골드 ${selected.reward}`, 10, DUNGEON_UI_CSS.TEXT);
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.82);
    g.fillRoundedRect(28, 668, W - 28, 86, 7);
    g.lineStyle(1, selected.behavior ? DUNGEON_UI.EMBER : DUNGEON_UI.IRON, 0.78);
    g.strokeRoundedRect(28, 668, W - 28, 86, 7);
    this.leftText(40, 685, selected.behavior ? `전술 행동 · ${selected.behavior}` : '전술 행동 · 없음', 10,
      selected.behavior ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED, true);
    this.leftText(40, 718, selected.behavior ? getTraitBlurb(selected.behavior) ?? selected.behavior : '고유 전술 행동 없음', 10,
      DUNGEON_UI_CSS.TEXT, false, W - 52);
  }

  // ── Modifier / event archive ──────────────────────────────────────────────

  private drawIntel(tab: 'modifiers' | 'events'): void {
    const records = this.intelRecords(tab);
    const page = tab === 'modifiers' ? this.modifierPage : this.eventPage;
    const selectedId = tab === 'modifiers' ? this.selectedModifierId : this.selectedEventId;
    const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_INTEL_PAGE));
    const start = page * RECORDS_PER_INTEL_PAGE;
    const visible = records.slice(start, start + RECORDS_PER_INTEL_PAGE);
    const accent = tab === 'modifiers' ? DUNGEON_UI.EMBER : DUNGEON_UI.JADE;
    this.ledger({
      y: CONTENT_Y,
      title: tab === 'modifiers' ? '무한 던전 도전 변수' : '웨이브 사건 기록',
      detail: tab === 'modifiers'
        ? `${start + 1}–${Math.min(records.length, start + visible.length)} / ${records.length} · 런마다 1개 무작위`
        : `${start + 1}–${Math.min(records.length, start + visible.length)} / ${records.length} · 웨이브 사이 무작위`,
      page, pageCount, prefix: `codex-${tab}-page`, accent,
      onChange: direction => {
        const next = Phaser.Math.Clamp(page + direction, 0, pageCount - 1);
        if (next === page) return;
        const id = records[next * RECORDS_PER_INTEL_PAGE]?.id ?? '';
        if (tab === 'modifiers') {
          this.modifierPage = next;
          this.selectedModifierId = id;
        } else {
          this.eventPage = next;
          this.selectedEventId = id;
        }
        this.render();
      },
    });
    visible.forEach((record, index) => this.drawIntelCard(record, 250 + index * 70, selectedId, tab));
    this.drawIntelDetail(records.find(record => record.id === selectedId) ?? records[0], tab, accent);
  }

  private drawIntelCard(record: IntelRecord, y: number, selectedId: string, tab: 'modifiers' | 'events'): void {
    const selected = record.id === selectedId;
    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(X, y, W, 64, 8);
    g.lineStyle(selected ? 2 : 1, selected ? DUNGEON_UI.BRASS_BRIGHT : record.accent, selected ? 1 : 0.72);
    g.strokeRoundedRect(X, y, W, 64, 8);
    g.fillStyle(record.accent, 0.22);
    g.fillRoundedRect(24, y + 10, 42, 44, 7);
    addSigil(this, record.sigil, 45, y + 32, 26, DUNGEON_UI.BRASS_BRIGHT, { disc: false });
    this.leftText(78, y + 20, record.name, 12, DUNGEON_UI_CSS.PARCHMENT, true);
    this.rightText(X + W - 14, y + 20, record.metrics, 10,
      tab === 'modifiers' ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.JADE, true);
    this.leftText(78, y + 44, record.summary, 10, DUNGEON_UI_CSS.MUTED, false, W - 152);
    const zone = this.add.zone(X, y, W, 64).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.setName(`codex-${tab}-record-${record.id}`);
    zone.on('pointerdown', () => {
      if (this.transactionPending || this.detailOverlay || selected) return;
      if (tab === 'modifiers') this.selectedModifierId = record.id;
      else this.selectedEventId = record.id;
      this.render();
    });
  }

  private drawIntelDetail(selected: IntelRecord | undefined, tab: 'modifiers' | 'events', accent: number): void {
    this.panel(536, 236, accent, accent);
    if (!selected) return;
    addSigil(this, selected.sigil, 42, 560, 18, accent, { disc: false });
    this.leftText(58, 560, selected.name, 15, DUNGEON_UI_CSS.PARCHMENT, true);
    this.rightText(X + W - 16, 560, selected.metrics, 10,
      tab === 'modifiers' ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.JADE, true);
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.82);
    g.fillRoundedRect(28, 582, W - 28, 88, 7);
    g.lineStyle(1, accent, 0.76);
    g.strokeRoundedRect(28, 582, W - 28, 88, 7);
    this.leftText(40, 604, tab === 'modifiers' ? '적용 결과' : '발생 효과', 10,
      tab === 'modifiers' ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.JADE, true);
    this.leftText(40, 638, selected.detail, 11, DUNGEON_UI_CSS.TEXT, false, W - 52);
    this.leftText(32, 694, tab === 'modifiers'
      ? '실제 선택은 무한 던전 진입 시 무작위로 정해집니다.'
      : '실제 발생은 전투 중 무작위로 정해집니다.', 10, DUNGEON_UI_CSS.MUTED, false, W - 36);
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  private claimSelected(): void {
    if (!this.beginTransaction() || this.guardianGroup === 'unaffiliated') return;
    const fresh = loadGameState();
    const progress = getCodexTribeProgress(fresh, this.guardianGroup);
    const reward = progress.rewardMonsterId ? MONSTER_DEFS[progress.rewardMonsterId] : undefined;
    if (!progress.claimable || !progress.rewardMonsterId || !reward) {
      this.gameState = fresh;
      this.receipt = {
        title: progress.claimed ? '선택 부족 · 이미 회수 완료' : '선택 부족 · 최신 기록 재검증 실패',
        detail: progress.claimed ? 'roster와 완료 부족 수는 변경되지 않았습니다'
          : `현재 저장 기준 필수 기록 ${progress.missingMonsterIds.length}종 남음 · 보상 미지급`,
        tone: 'warning',
      };
      this.queueRender();
      return;
    }
    const beforeOwned = this.ownedTypes(fresh).size;
    const result = claimCodexTribeReward(fresh, this.guardianGroup, progress.rewardMonsterId);
    if (!result.ok) {
      this.gameState = result.state;
      this.receipt = { title: '선택 부족 · 보상 회수 실패', detail: 'roster와 완료 부족 수는 변경되지 않았습니다', tone: 'warning' };
      this.queueRender();
      return;
    }
    saveGameState(result.state);
    this.gameState = result.state;
    this.receipt = {
      title: `${reward.name} · 보상 회수 완료`,
      detail: `완료 부족 ${fresh.completedTribes ?? 0}→${result.state.completedTribes} · 보유 수호자 ${beforeOwned}→${this.ownedTypes(result.state).size}`,
      tone: 'success',
    };
    this.queueRender();
  }

  private claimAll(): void {
    if (!this.beginTransaction()) return;
    const fresh = loadGameState();
    const eligible = getClaimableCodexTribes(fresh);
    if (eligible.length === 0) {
      this.gameState = fresh;
      this.receipt = { title: '전체 회수 · 최신 기록에 대상 없음', detail: 'roster와 완료 부족 수는 변경되지 않았습니다', tone: 'warning' };
      this.queueRender();
      return;
    }
    const beforeOwned = this.ownedTypes(fresh).size;
    const result = claimAllCodexTribeRewards(fresh, eligible);
    if (result.claimedCount === 0) {
      this.gameState = result.state;
      this.receipt = { title: '전체 회수 · 보상 지급 없음', detail: '최신 저장 기준 모든 대상이 이미 처리되었습니다', tone: 'warning' };
      this.queueRender();
      return;
    }
    saveGameState(result.state);
    this.gameState = result.state;
    this.receipt = {
      title: `전체 회수 완료 · ${result.claimedCount}개 부족`,
      detail: `완료 부족 ${fresh.completedTribes ?? 0}→${result.state.completedTribes} · 보유 수호자 ${beforeOwned}→${this.ownedTypes(result.state).size}`,
      tone: 'success',
    };
    this.queueRender();
  }

  private beginTransaction(): boolean {
    const timestamp = Date.now();
    if (timestamp - this.lastTransactionAt < COOLDOWN_MS) {
      this.transactionPending = false;
      return false;
    }
    this.lastTransactionAt = timestamp;
    return true;
  }

  private queueRender(): void {
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      this.transactionPending = false;
      if (this.sys.isActive()) this.render();
    });
  }

  // ── Reconciliation and data views ─────────────────────────────────────────

  private readTab(): CodexTab {
    const raw = this.registry.get('codexActiveTab');
    return TABS.some(tab => tab.id === raw) ? raw as CodexTab : 'monsters';
  }

  private currentCount(): number {
    if (this.codexTab === 'monsters') return Object.keys(MONSTER_DEFS).length;
    if (this.codexTab === 'invaders') return Object.keys(INVADER_DEFS).length;
    return this.codexTab === 'modifiers' ? ENDLESS_MODIFIERS.length : WAVE_EVENTS.length;
  }

  private ownedTypes(state: GameState = this.gameState): Set<MonsterId> {
    const out = new Set<MonsterId>();
    state.ownedMonsters.forEach(monster => {
      const id = resolveMonsterTypeId(monster.id);
      if (id) out.add(id);
    });
    return out;
  }

  private isOwned(id: MonsterId, state: GameState = this.gameState): boolean {
    return this.ownedTypes(state).has(id);
  }

  private guardianRecords(): MonsterRecord[] {
    const records = (Object.values(MONSTER_DEFS) as MonsterRecord[]).filter(monster => (
      this.guardianGroup === 'unaffiliated' ? !monster.tribe : monster.tribe === this.guardianGroup
    ));
    const filtered = this.showOwnedOnly ? records.filter(monster => this.isOwned(monster.id)) : records;
    const ids = Object.keys(MONSTER_DEFS);
    return filtered.sort((a, b) => Number(this.isOwned(b.id)) - Number(this.isOwned(a.id))
      || ids.indexOf(a.id) - ids.indexOf(b.id));
  }

  private invaderRecords(): InvaderRecord[] {
    return (Object.values(INVADER_DEFS) as InvaderRecord[])
      .filter(record => (record.chapter ?? 1) === this.invaderChapter);
  }

  private intelRecords(tab: 'modifiers' | 'events'): IntelRecord[] {
    if (tab === 'modifiers') return ENDLESS_MODIFIERS.map(modifier => ({
      id: modifier.id,
      sigil: ENDLESS_MODIFIER_SIGILS[modifier.id] ?? 'skull',
      name: modifier.name,
      summary: modifier.desc.split(' · 보상')[0],
      detail: modifier.desc,
      metrics: `보상 ×${modifier.rewardMult.toFixed(2)}`,
      accent: DUNGEON_UI.EMBER,
    }));
    return WAVE_EVENTS.map(event => ({
      id: event.type,
      sigil: WAVE_EVENT_SIGILS[event.type] ?? 'spark',
      name: event.name,
      summary: event.description,
      detail: event.description,
      metrics: '전투 사건',
      accent: Number.parseInt(event.color.slice(1), 16),
    }));
  }

  private reconcileSelections(): void {
    this.reconcileGuardian(this.guardianRecords());
    this.reconcileInvader(this.invaderRecords());
    const modifiers = this.intelRecords('modifiers');
    const events = this.intelRecords('events');
    if (!modifiers.some(record => record.id === this.selectedModifierId)) this.selectedModifierId = modifiers[0]?.id ?? '';
    if (!events.some(record => record.id === this.selectedEventId)) this.selectedEventId = events[0]?.id ?? '';
    this.modifierPage = Phaser.Math.Clamp(this.modifierPage, 0, Math.max(0, Math.ceil(modifiers.length / RECORDS_PER_INTEL_PAGE) - 1));
    this.eventPage = Phaser.Math.Clamp(this.eventPage, 0, Math.max(0, Math.ceil(events.length / RECORDS_PER_INTEL_PAGE) - 1));
  }

  private reconcileGuardian(records: readonly MonsterRecord[]): void {
    this.guardianPage = Phaser.Math.Clamp(this.guardianPage, 0, Math.max(0, Math.ceil(records.length / RECORDS_PER_GUARDIAN_PAGE) - 1));
    let index = records.findIndex(record => record.id === this.selectedMonsterId);
    if (index < 0) {
      index = this.guardianPage * RECORDS_PER_GUARDIAN_PAGE;
      this.selectedMonsterId = records[index]?.id ?? records[0]?.id ?? '';
    }
    if (index >= 0) this.guardianPage = Math.floor(index / RECORDS_PER_GUARDIAN_PAGE);
  }

  private reconcileInvader(records: readonly InvaderRecord[]): void {
    this.invaderPage = Phaser.Math.Clamp(this.invaderPage, 0, Math.max(0, Math.ceil(records.length / RECORDS_PER_INVADER_PAGE) - 1));
    let index = records.findIndex(record => record.type === this.selectedInvaderId);
    if (index < 0) {
      index = this.invaderPage * RECORDS_PER_INVADER_PAGE;
      this.selectedInvaderId = records[index]?.type ?? records[0]?.type ?? '';
    }
    if (index >= 0) this.invaderPage = Math.floor(index / RECORDS_PER_INVADER_PAGE);
  }

  // ── Shared render helpers ─────────────────────────────────────────────────

  private panel(y: number, h: number, border: number, accent?: number): void {
    addFramedPanel(this, {
      x: X, y, w: W, h,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: border,
      accentColor: accent,
      shadowOpacity: 0.2,
    });
  }

  private button(options: {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h?: number;
    readonly label: string;
    readonly fontSize: string;
    readonly enabled?: boolean;
    readonly kind?: 'view' | 'transaction';
    readonly fill: number;
    readonly border: number;
    readonly textColor: string;
    readonly onPress: () => void;
  }): PrimaryActionButtonRefs {
    const refs = addPrimaryActionButton(this, {
      x: options.x, y: options.y, w: options.w, h: options.h ?? 44,
      label: options.label, fontSize: options.fontSize, enabled: options.enabled ?? true,
      once: true, showArrow: false,
      fillColor: options.fill, hoverFillColor: options.fill,
      borderColor: options.border, hoverBorderColor: options.border,
      disabledFillColor: DUNGEON_UI.SOOT, disabledBorderColor: DUNGEON_UI.IRON,
      textColor: options.textColor,
      onPress: options.onPress,
    });
    refs.zone.setName(options.name);
    const press = refs.zone.listeners('pointerdown')[0] as ((...args: unknown[]) => void) | undefined;
    if (press) {
      refs.zone.removeAllListeners('pointerdown');
      refs.zone.on('pointerdown', (...args: unknown[]) => {
        if (this.transactionPending || this.detailOverlay) return;
        if (options.kind === 'transaction') this.transactionPending = true;
        press(...args);
      });
    }
    return refs;
  }

  private pager(options: {
    readonly y: number;
    readonly label: string;
    readonly page: number;
    readonly pageCount: number;
    readonly prefix: string;
    readonly onChange: (direction: -1 | 1) => void;
  }): void {
    this.panel(options.y, 44, DUNGEON_UI.IRON);
    this.leftText(30, options.y + 22, options.label, 10, DUNGEON_UI_CSS.MUTED, true);
    this.rightText(X + W - 112, options.y + 22, `${options.page + 1} / ${options.pageCount}`, 10, DUNGEON_UI_CSS.MUTED, true);
    this.pagerButtons(options.y, options.page, options.pageCount, options.prefix, options.onChange);
  }

  private ledger(options: {
    readonly y: number;
    readonly title: string;
    readonly detail: string;
    readonly page: number;
    readonly pageCount: number;
    readonly prefix: string;
    readonly accent: number;
    readonly onChange: (direction: -1 | 1) => void;
  }): void {
    this.panel(options.y, 58, options.accent, options.accent);
    this.leftText(30, options.y + 18, options.title, 12, DUNGEON_UI_CSS.PARCHMENT, true);
    this.leftText(30, options.y + 40, options.detail, 10, DUNGEON_UI_CSS.MUTED);
    this.rightText(X + W - 112, options.y + 29, `${options.page + 1} / ${options.pageCount}`, 10, DUNGEON_UI_CSS.MUTED, true);
    this.pagerButtons(options.y + 7, options.page, options.pageCount, options.prefix, options.onChange);
  }

  private pagerButtons(y: number, page: number, pageCount: number, prefix: string, onChange: (direction: -1 | 1) => void): void {
    this.button({
      name: `${prefix}-previous`, x: X + W - 98, y, w: 44,
      label: '‹', fontSize: '18px', enabled: page > 0,
      fill: DUNGEON_UI.STONE, border: DUNGEON_UI.EDGE, textColor: DUNGEON_UI_CSS.TEXT,
      onPress: () => onChange(-1),
    });
    this.button({
      name: `${prefix}-next`, x: X + W - 48, y, w: 44,
      label: '›', fontSize: '18px', enabled: page < pageCount - 1,
      fill: DUNGEON_UI.STONE, border: DUNGEON_UI.EDGE, textColor: DUNGEON_UI_CSS.TEXT,
      onPress: () => onChange(1),
    });
  }

  private leftText(x: number, y: number, value: string, size: number, color: string, bold = false, wrap?: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color,
      fontStyle: bold ? 'bold' : 'normal',
      wordWrap: wrap ? { width: wrap } : undefined,
      lineSpacing: wrap ? 3 : 0,
    }).setOrigin(0, 0.5);
  }

  private rightText(x: number, y: number, value: string, size: number, color: string, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal',
    }).setOrigin(1, 0.5);
  }

  private centerText(x: number, y: number, value: string, size: number, color: string, bold = false, wrap?: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color,
      fontStyle: bold ? 'bold' : 'normal', align: 'center',
      wordWrap: wrap ? { width: wrap } : undefined,
    }).setOrigin(0.5);
  }

  private elementLabel(element: string | undefined): string {
    const labels: Record<string, string> = { fire: '화염', frost: '서리', lightning: '번개', dark: '암흑', holy: '신성' };
    return element ? labels[element] ?? element : '중립';
  }

  private unlockLabel(method: string | undefined): string {
    const labels: Record<string, string> = { summon: '소환', codex_reward: '도감 보상', fusion_combination: '융합', seasonal: '시즌' };
    return method ? labels[method] ?? method : '기본 기록';
  }
}
