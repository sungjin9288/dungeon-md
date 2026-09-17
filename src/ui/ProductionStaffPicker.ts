// ─── Production staff picker ──────────────────────────────────────────────────
// Choose the guardian that works a facility. A guardian on shift leaves its
// room (and any other shift) — the transaction owns that rule; this overlay
// only shows each candidate's tribe fit and where it currently stands.

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { FACILITY_AFFINITY, FACILITY_DEFS, isFacilityAffineTribe, STAFF_AFFINITY_MULT, STAFF_MULT } from '../data/production';
import { findStaffedFacility } from '../data/productionTransactions';
import type { GameState } from '../data/wisdom';
import { TRIBE_LABELS } from './BarracksShared';
import { addMonsterPortrait } from './MonsterPortraitView';

export interface ProductionStaffPickerOptions {
  readonly gs: GameState;
  readonly facilityId: string;
  readonly onAssign: (monsterId: string) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

const PAGE_SIZE = 9;
const COLS = 3;
const PANEL_X = 14;
const PANEL_W = CANVAS_WIDTH - PANEL_X * 2;
const PANEL_Y = 92;
const PANEL_H = 640;
const CHIP_W = 110;
const CHIP_H = 124;
const CHIP_GAP = 8;
const BUTTON_H = 44;

interface Candidate {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly tribeLabel: string;
  readonly affine: boolean;
  readonly inRoom: number | null;
  readonly shiftAt: string | null;
}

function collectCandidates(gs: GameState, facilityId: string): Candidate[] {
  const roomOf = new Map<string, number>();
  (gs.dungeonSlots ?? []).forEach((slot, idx) => {
    for (const id of slot?.monsterIds ?? []) if (id) roomOf.set(id, idx);
  });
  const out: Candidate[] = [];
  for (const owned of gs.ownedMonsters ?? []) {
    const profile = resolveOwnedMonsterProfile(owned.id);
    if (!profile) continue;
    out.push({
      id: owned.id,
      name: profile.name,
      level: owned.level,
      tribeLabel: profile.tribe ? TRIBE_LABELS[profile.tribe] ?? '수호' : '수호',
      affine: isFacilityAffineTribe(facilityId, profile.tribe),
      inRoom: roomOf.get(owned.id) ?? null,
      shiftAt: findStaffedFacility(gs, owned.id),
    });
  }
  // Affine tribe first, then free guardians, then by level.
  return out.sort((a, b) => Number(b.affine) - Number(a.affine) || Number(a.inRoom !== null) - Number(b.inRoom !== null) || b.level - a.level);
}

function addButton(
  scene: Phaser.Scene, c: Phaser.GameObjects.Container,
  x: number, y: number, w: number, label: string, enabled: boolean, accent: number, name: string, onTap: () => void,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(enabled ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.VOID, 1);
  bg.fillRoundedRect(x, y, w, BUTTON_H, 7);
  bg.lineStyle(1.2, enabled ? accent : DUNGEON_UI.IRON, enabled ? 0.85 : 0.35);
  bg.strokeRoundedRect(x, y, w, BUTTON_H, 7);
  c.add(bg);
  c.add(scene.add.text(x + w / 2, y + BUTTON_H / 2, label, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
    color: enabled ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));
  if (!enabled) return;
  const zone = scene.add.zone(x, y, w, BUTTON_H).setOrigin(0).setName(name).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onTap);
  c.add(zone);
}

export function openProductionStaffPicker(scene: Phaser.Scene, opts: ProductionStaffPickerOptions): Phaser.GameObjects.Container {
  const { gs, facilityId } = opts;
  const def = FACILITY_DEFS[facilityId];
  const staffed = gs.facilityStaff?.[facilityId] ?? null;
  const candidates = collectCandidates(gs, facilityId);
  const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  let page = 0;

  const root = scene.add.container(0, 0).setDepth(300);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.72);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  root.add(dim);
  // Swallow taps outside the panel so the plate underneath cannot fire.
  const shield = scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0).setInteractive();
  root.add(shield);

  const panel = scene.add.graphics();
  panel.fillStyle(DUNGEON_UI.STONE, 1);
  panel.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12);
  panel.lineStyle(1.5, DUNGEON_UI.BRASS, 0.8);
  panel.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12);
  root.add(panel);

  root.add(scene.add.text(PANEL_X + 16, PANEL_Y + 16, `${def.emoji} ${def.name} 근무 배정`, {
    fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  const affineTribe = TRIBE_LABELS[FACILITY_AFFINITY[facilityId]] ?? FACILITY_AFFINITY[facilityId];
  root.add(scene.add.text(PANEL_X + 16, PANEL_Y + 40, `${affineTribe} 부족 ×${STAFF_AFFINITY_MULT.toFixed(1)} · 그 외 ×${STAFF_MULT.toFixed(1)} · 근무 중인 수호자는 방어에서 빠집니다`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, wordWrap: { width: PANEL_W - 32 },
  }));

  const pageLayer = scene.add.container(0, 0);
  root.add(pageLayer);

  const renderPage = (): void => {
    pageLayer.removeAll(true);
    const gridX = PANEL_X + (PANEL_W - (CHIP_W * COLS + CHIP_GAP * (COLS - 1))) / 2;
    const gridY = PANEL_Y + 72;
    const visible = candidates.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (visible.length === 0) {
      pageLayer.add(scene.add.text(CANVAS_WIDTH / 2, gridY + 60, '보유 수호자가 없습니다 · 소환에서 획득하세요', {
        fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
    }
    visible.forEach((cand, i) => {
      const x = gridX + (i % COLS) * (CHIP_W + CHIP_GAP);
      const y = gridY + Math.floor(i / COLS) * (CHIP_H + CHIP_GAP);
      const here = cand.shiftAt === facilityId;
      const accent = here ? DUNGEON_UI.JADE : cand.affine ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON;
      const g = scene.add.graphics();
      g.fillStyle(here ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
      g.fillRoundedRect(x, y, CHIP_W, CHIP_H, 8);
      g.lineStyle(here ? 2 : 1, accent, here || cand.affine ? 0.95 : 0.6);
      g.strokeRoundedRect(x, y, CHIP_W, CHIP_H, 8);
      pageLayer.add(g);
      addMonsterPortrait(scene, pageLayer, x + CHIP_W / 2, y + 28, cand.id, { size: 40, depth: 301, frameColor: accent });
      pageLayer.add(scene.add.text(x + CHIP_W / 2, y + 56, cand.name.length > 7 ? `${cand.name.slice(0, 7)}…` : cand.name, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
      }).setOrigin(0.5));
      pageLayer.add(scene.add.text(x + CHIP_W / 2, y + 72, `Lv.${cand.level} · ${cand.tribeLabel}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0.5));
      pageLayer.add(scene.add.text(x + CHIP_W / 2, y + 88, cand.affine ? `적성 ×${STAFF_AFFINITY_MULT.toFixed(1)}` : `×${STAFF_MULT.toFixed(1)}`, {
        fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: cand.affine ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      const where = here ? '이 시설 근무 중'
        : cand.shiftAt ? `${FACILITY_DEFS[cand.shiftAt]?.name ?? cand.shiftAt} 근무 중`
        : cand.inRoom !== null ? `방 #${cand.inRoom + 1} 배치 중` : '대기';
      pageLayer.add(scene.add.text(x + CHIP_W / 2, y + 108, where, {
        fontFamily: 'sans-serif', fontSize: '10px', color: here ? DUNGEON_UI_CSS.JADE : cand.inRoom !== null || cand.shiftAt ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      if (here) return;
      const zone = scene.add.zone(x, y, CHIP_W, CHIP_H).setOrigin(0).setName(`production-staff-${cand.id}`).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => opts.onAssign(cand.id));
      pageLayer.add(zone);
    });

    const navY = PANEL_Y + PANEL_H - BUTTON_H * 2 - 24;
    if (pageCount > 1) {
      addButton(scene, pageLayer, PANEL_X + 16, navY, 90, '‹ 이전', page > 0, DUNGEON_UI.BRASS, 'production-staff-prev', () => { page -= 1; renderPage(); });
      addButton(scene, pageLayer, PANEL_X + PANEL_W - 106, navY, 90, '다음 ›', page < pageCount - 1, DUNGEON_UI.BRASS, 'production-staff-next', () => { page += 1; renderPage(); });
      pageLayer.add(scene.add.text(CANVAS_WIDTH / 2, navY + BUTTON_H / 2, `${page + 1} / ${pageCount}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
      }).setOrigin(0.5));
    }
  };
  renderPage();

  const actionY = PANEL_Y + PANEL_H - BUTTON_H - 12;
  addButton(scene, root, PANEL_X + 16, actionY, 150, '근무 해제', staffed !== null, DUNGEON_UI.EMBER, 'production-staff-clear', opts.onClear);
  addButton(scene, root, PANEL_X + PANEL_W - 166, actionY, 150, '닫기', true, DUNGEON_UI.BRASS, 'production-staff-close', opts.onClose);
  return root;
}
