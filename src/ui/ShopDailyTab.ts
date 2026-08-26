import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { purchaseDailyEquipment, purchaseDailySkill } from '../data/shopTransactions';
import { ACTIVE_SKILLS, EQUIPMENT_DEFS, type ActiveSkill, type Equipment } from '../data/barracks';

// ─── Daily rotation seeded by UTC day ─────────────────────────────────────────

export function getDayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getDailyItems(): { skills: ActiveSkill[]; equipment: Equipment[] } {
  const day = getDayIndex();
  const skills    = seededShuffle(ACTIVE_SKILLS,  day).slice(0, 3);
  const equipment = seededShuffle(EQUIPMENT_DEFS, day + 7).slice(0, 3);
  return { skills, equipment };
}

// ─── Shared context interface ─────────────────────────────────────────────────

export interface ShopDailyTabContext {
  readonly scene: Phaser.Scene;
  readonly contentCtr: Phaser.GameObjects.Container;
  readonly showToast: (msg: string) => void;
  readonly refreshContent: () => void;
}

// ─── Equipment tab ────────────────────────────────────────────────────────────

export function buildEquipmentTab(ctx: ShopDailyTabContext): void {
  const { scene, contentCtr } = ctx;
  const gs = loadGameState();
  const { equipment } = getDailyItems();

  const titleT = scene.add.text(CANVAS_WIDTH / 2, 104, '⚒️ 일일 장비', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5).setDepth(6);
  contentCtr.add(titleT);

  contentCtr.add(scene.add.text(CANVAS_WIDTH - 16, 104, `💠 ${gs.soulCrystals}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
  }).setOrigin(1, 0.5).setDepth(6));

  let eqSecs = Math.floor((86_400_000 - (Date.now() % 86_400_000)) / 1000);
  const fmtEq = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return `🕐 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')} 후 재입고`;
  };
  const eqCd = scene.add.text(CANVAS_WIDTH / 2, 124, fmtEq(eqSecs), {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5).setDepth(6);
  contentCtr.add(eqCd);
  const eqTick = scene.time.addEvent({ delay: 1000, loop: true, callback: () => {
    eqSecs = Math.max(0, eqSecs - 1);
    if (eqCd.active) eqCd.setText(fmtEq(eqSecs));
  }});
  eqCd.on('destroy', () => eqTick.remove());

  equipment.forEach((eq, i) => {
    const owned = gs.ownedEquipment.includes(eq.id);
    drawItemCard(
      ctx,
      CANVAS_WIDTH / 2, 180 + i * 104, eq.icon, eq.name, eq.desc,
      eq.goldCost, eq.gemCost, owned, 'equip',
      () => {
        const state = loadGameState();
        const result = purchaseDailyEquipment(state, eq.id, eq.gemCost);
        if (!result.ok) { ctx.showToast('영혼 결정체 부족'); return; }
        if (result.changed) saveGameState(result.state);
        ctx.showToast(result.changed ? `${eq.name} 구입 완료!` : '이미 보유 중');
        ctx.refreshContent();
      },
    );
  });
}

// ─── Skill tab ────────────────────────────────────────────────────────────────

export function buildSkillTab(ctx: ShopDailyTabContext): void {
  const { scene, contentCtr } = ctx;
  const gs = loadGameState();
  const { skills } = getDailyItems();

  const titleT = scene.add.text(CANVAS_WIDTH / 2, 104, '✨ 일일 스킬', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5).setDepth(6);
  contentCtr.add(titleT);

  contentCtr.add(scene.add.text(CANVAS_WIDTH - 16, 104, `💠 ${gs.soulCrystals}`, {
    fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
  }).setOrigin(1, 0.5).setDepth(6));

  let skSecs = Math.floor((86_400_000 - (Date.now() % 86_400_000)) / 1000);
  const fmtSk = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return `🕐 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')} 후 재입고`;
  };
  const skCd = scene.add.text(CANVAS_WIDTH / 2, 124, fmtSk(skSecs), {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5).setDepth(6);
  contentCtr.add(skCd);
  const skTick = scene.time.addEvent({ delay: 1000, loop: true, callback: () => {
    skSecs = Math.max(0, skSecs - 1);
    if (skCd.active) skCd.setText(fmtSk(skSecs));
  }});
  skCd.on('destroy', () => skTick.remove());

  skills.forEach((sk, i) => {
    const owned = gs.ownedActiveSkills.includes(sk.id);
    drawItemCard(
      ctx,
      CANVAS_WIDTH / 2, 168 + i * 104, sk.icon, sk.name, sk.desc,
      sk.goldCost, sk.gemCost, owned, 'skill',
      () => {
        const state = loadGameState();
        const result = purchaseDailySkill(state, sk.id, sk.gemCost);
        if (!result.ok) { ctx.showToast('영혼 결정체 부족'); return; }
        if (result.changed) saveGameState(result.state);
        ctx.showToast(result.changed ? `${sk.name} 습득!` : '이미 보유 중');
        ctx.refreshContent();
      },
    );
  });
}

// ─── Item card (equipment / skill) ───────────────────────────────────────────

function drawItemCard(
  ctx: ShopDailyTabContext,
  cx: number, cy: number,
  icon: string, name: string, desc: string,
  _goldCost: number, gemCost: number,
  owned: boolean, _type: 'equip' | 'skill',
  onBuy: () => void,
): void {
  const { scene, contentCtr } = ctx;
  const w = 330, h = 88;
  // Owned cards switch to a positive green accent; available use purple (soul-crystal hue).
  const accent = owned ? CASUAL.GREEN : CASUAL.PURPLE;
  const cardX = cx - w / 2, cardY = cy - h / 2;
  const bg = scene.add.graphics().setDepth(6);
  bg.fillStyle(CASUAL.SHADOW, 0.22);
  bg.fillRoundedRect(cardX, cardY + 4, w, h, 10);
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(cardX, cardY, w, h, 10);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(cardX + 5, cardY + 4, w - 10, 6, 3);
  bg.lineStyle(3, accent, 1);
  bg.strokeRoundedRect(cardX, cardY, w, h, 10);
  contentCtr.add(bg);

  contentCtr.add(scene.add.text(cardX + 20, cy, icon, {
    fontFamily: 'sans-serif', fontSize: '28px',
  }).setOrigin(0.5).setDepth(7));

  contentCtr.add(scene.add.text(cardX + 46, cy - 22, name, {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setDepth(7));

  contentCtr.add(scene.add.text(cardX + 46, cy - 4, desc, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: 180 },
  }).setDepth(7));

  if (owned) {
    // Owned → muted cream pill + INK_SOFT "보유중".
    const owW = 64, owH = 24;
    const owX = cx + w / 2 - owW - 8;
    const owBg = scene.add.graphics().setDepth(7);
    owBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    owBg.fillRoundedRect(owX, cy - owH / 2, owW, owH, 8);
    owBg.lineStyle(2, CASUAL.EDGE_SOFT, 0.9);
    owBg.strokeRoundedRect(owX, cy - owH / 2, owW, owH, 8);
    contentCtr.add(owBg);
    contentCtr.add(scene.add.text(owX + owW / 2, cy, '보유중', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5).setDepth(8));
  } else {
    contentCtr.add(scene.add.text(cardX + 46, cy + 18, `💠 ${gemCost}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
    }).setDepth(7));

    // 구매 → bright green candy button.
    const btnW = 72, btnH = 26;
    const btnX = cx + w / 2 - btnW - 8;
    const btnY = cy - btnH / 2;
    const btnBg = scene.add.graphics().setDepth(7);
    btnBg.fillStyle(CASUAL.GREEN_DK, 1);
    btnBg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 8);
    btnBg.fillStyle(CASUAL.GREEN, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH - 1, 8);
    btnBg.fillStyle(0xffffff, 0.32);
    btnBg.fillRoundedRect(btnX + 5, btnY + 3, btnW - 10, 9, 4);
    contentCtr.add(btnBg);

    contentCtr.add(scene.add.text(btnX + btnW / 2, cy - 1, `💠 ${gemCost}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: CASUAL_CSS.WHITE, stroke: '#00000033', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8));

    const zone = scene.add.zone(btnX + btnW / 2, cy, btnW, 44)
      .setInteractive().setDepth(9);
    contentCtr.add(zone);
    zone.on('pointerdown', onBuy);
  }
}
