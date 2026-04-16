import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { COLORS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
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
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffcc88',
  }).setOrigin(0.5).setDepth(6);
  contentCtr.add(titleT);

  const msUntilReset = 86_400_000 - (Date.now() % 86_400_000);
  const hh = Math.floor(msUntilReset / 3_600_000);
  const mm = Math.floor((msUntilReset % 3_600_000) / 60_000);
  contentCtr.add(scene.add.text(CANVAS_WIDTH / 2, 124, `🕐 ${hh}시간 ${mm}분 후 재입고`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#666688',
  }).setOrigin(0.5).setDepth(6));

  equipment.forEach((eq, i) => {
    const owned = gs.ownedEquipment.includes(eq.id);
    drawItemCard(
      ctx,
      CANVAS_WIDTH / 2, 180 + i * 104, eq.icon, eq.name, eq.desc,
      eq.goldCost, eq.gemCost, owned, 'equip',
      () => {
        const state = loadGameState();
        if (state.soulCrystals < eq.gemCost) { ctx.showToast('영혼 결정체 부족'); return; }
        state.soulCrystals -= eq.gemCost;
        if (!state.ownedEquipment.includes(eq.id)) state.ownedEquipment.push(eq.id);
        saveGameState(state);
        ctx.showToast(`${eq.name} 구입 완료!`);
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
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#aaffcc',
  }).setOrigin(0.5).setDepth(6);
  contentCtr.add(titleT);

  skills.forEach((sk, i) => {
    const owned = gs.ownedActiveSkills.includes(sk.id);
    drawItemCard(
      ctx,
      CANVAS_WIDTH / 2, 168 + i * 104, sk.icon, sk.name, sk.desc,
      sk.goldCost, sk.gemCost, owned, 'skill',
      () => {
        const state = loadGameState();
        if (state.soulCrystals < sk.gemCost) { ctx.showToast('영혼 결정체 부족'); return; }
        state.soulCrystals -= sk.gemCost;
        if (!state.ownedActiveSkills.includes(sk.id)) state.ownedActiveSkills.push(sk.id);
        saveGameState(state);
        ctx.showToast(`${sk.name} 습득!`);
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
  goldCost: number, gemCost: number,
  owned: boolean, _type: 'equip' | 'skill',
  onBuy: () => void,
): void {
  const { scene, contentCtr } = ctx;
  const w = 330, h = 88;
  const bg = scene.add.graphics().setDepth(6);
  bg.fillStyle(owned ? 0x1a3a1a : 0x1a1a2e, 1);
  bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  bg.lineStyle(1.5, owned ? 0x44aa44 : COLORS.TORCH_GOLD, 0.5);
  bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  contentCtr.add(bg);

  contentCtr.add(scene.add.text(cx - w / 2 + 20, cy, icon, {
    fontFamily: 'sans-serif', fontSize: '28px',
  }).setOrigin(0.5).setDepth(7));

  contentCtr.add(scene.add.text(cx - w / 2 + 46, cy - 22, name, {
    fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
    color: owned ? '#88dd88' : '#ffffff',
  }).setDepth(7));

  contentCtr.add(scene.add.text(cx - w / 2 + 46, cy - 4, desc, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaacc',
    wordWrap: { width: 180 },
  }).setDepth(7));

  if (owned) {
    contentCtr.add(scene.add.text(cx + w / 2 - 12, cy, '✅ 보유 중', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#66cc66',
    }).setOrigin(1, 0.5).setDepth(7));
  } else {
    contentCtr.add(scene.add.text(cx - w / 2 + 46, cy + 18, `💰${goldCost}  💎${gemCost}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ccaa44',
    }).setDepth(7));

    const btnW = 72, btnH = 26;
    const btnX = cx + w / 2 - btnW - 8;
    const btnBg = scene.add.graphics().setDepth(7);
    btnBg.fillStyle(0x220044, 1);
    btnBg.fillRoundedRect(btnX, cy - btnH / 2, btnW, btnH, 6);
    btnBg.lineStyle(1, 0xaa44ff, 0.8);
    btnBg.strokeRoundedRect(btnX, cy - btnH / 2, btnW, btnH, 6);
    contentCtr.add(btnBg);

    contentCtr.add(scene.add.text(btnX + btnW / 2, cy, `💎 ${gemCost}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
    }).setOrigin(0.5).setDepth(8));

    const zone = scene.add.zone(btnX + btnW / 2, cy, btnW, btnH)
      .setInteractive().setDepth(9);
    contentCtr.add(zone);
    zone.on('pointerdown', onBuy);
  }
}
