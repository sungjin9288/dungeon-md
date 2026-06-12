export type ReadinessDirectiveKind =
  | 'room-design'
  | 'room-repair'
  | 'assign-monster'
  | 'install-trap'
  | 'grow-monster'
  | 'forge-equipment'
  | 'power-risk'
  | 'battle-ready';

export type ReadinessDirectiveSeverity = 'danger' | 'warning' | 'ready';

export interface ReadinessDirectiveContext {
  readonly roomLabel?: string;
  readonly roomOrdinal?: number;
  readonly unlockedSlots?: number;
  readonly builtRooms?: number;
  readonly monsterCount?: number;
  readonly emptySlots?: number;
  readonly placed?: number;
  readonly capacity?: number;
  readonly skillReady?: number;
  readonly readiness?: number;
  readonly currentPower?: number;
  readonly requiredPower?: number;
}

export interface ReadinessDirectiveCopy {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly chip: string;
  readonly statLabel: string;
  readonly accent: number;
  readonly severity: ReadinessDirectiveSeverity;
}

function roomLabel(ctx: ReadinessDirectiveContext): string {
  if (ctx.roomLabel) return ctx.roomLabel;
  if (typeof ctx.roomOrdinal === 'number') return `방 #${ctx.roomOrdinal}`;
  return '대상 방';
}

function formatPower(ctx: ReadinessDirectiveContext): string {
  const current = ctx.currentPower ?? 0;
  const required = ctx.requiredPower ?? 0;
  return required > 0 ? `권장 DEF ${required} / 현재 DEF ${current}` : `현재 DEF ${current}`;
}

export function getReadinessDirectiveCopy(
  kind: ReadinessDirectiveKind,
  ctx: ReadinessDirectiveContext = {},
): ReadinessDirectiveCopy {
  const label = roomLabel(ctx);
  switch (kind) {
    case 'room-design':
      if (typeof ctx.emptySlots === 'number' && ctx.emptySlots > 0) {
        return {
          icon: '▣',
          title: '새 방 설계',
          body: `추가 방 ${ctx.emptySlots}개를 설계하면 침략 루트 제어력이 올라갑니다.`,
          ctaLabel: '던전 정비',
          chip: '보강',
          statLabel: '확장',
          accent: 0x55b88a,
          severity: 'warning',
        };
      }
      if (!ctx.roomLabel && typeof ctx.unlockedSlots === 'number') {
        return {
          icon: '▣',
          title: '새 방 설계',
          body: `해금 슬롯 ${ctx.unlockedSlots}개 중 배치된 방이 없습니다.`,
          ctaLabel: '던전 정비',
          chip: '설계',
          statLabel: '확장',
          accent: 0x55b88a,
          severity: 'danger',
        };
      }
      return {
        icon: '▣',
        title: '새 방 설계',
        body: `${label} 역할을 정해 던전 동선을 확장하세요.`,
        ctaLabel: `${label} 설계`,
        chip: '설계',
        statLabel: '확장',
        accent: 0x55b88a,
        severity: 'warning',
      };
    case 'room-repair':
      return {
        icon: '!',
        title: '파손 방 복구',
        body: `${label} 내구도가 0입니다. 방을 열어 수리 흐름을 확인하세요.`,
        ctaLabel: `${label} 수리`,
        chip: '위험',
        statLabel: '내구',
        accent: 0xff6b5f,
        severity: 'danger',
      };
    case 'assign-monster':
      return {
        icon: '👹',
        title: '수호자 배치',
        body: ctx.builtRooms
          ? `방 ${ctx.builtRooms}개가 비어 있어 침략자를 막을 전열이 없습니다.`
          : `${label}에 빈 몬스터 슬롯이 있습니다.`,
        ctaLabel: ctx.builtRooms ? '던전 정비' : `${label} 배치`,
        chip: '위험',
        statLabel: '슬롯',
        accent: 0xffb84d,
        severity: ctx.builtRooms ? 'danger' : 'warning',
      };
    case 'install-trap':
      return {
        icon: '⌁',
        title: '함정 설치',
        body: ctx.monsterCount
          ? `수호자 ${ctx.monsterCount}명이 배치됐지만 지연/피해 함정이 없습니다.`
          : `${label} 방어 슬롯이 비어 있습니다.`,
        ctaLabel: ctx.monsterCount ? '던전 정비' : `${label} 설치`,
        chip: '보강',
        statLabel: '함정',
        accent: 0x9bdf6a,
        severity: 'warning',
      };
    case 'grow-monster':
      return {
        icon: '▲',
        title: '몬스터 성장 대기',
        body: `스킬 포인트 ${ctx.skillReady ?? 0}명분을 사용해 방어 전력을 올리세요.`,
        ctaLabel: '막사 이동',
        chip: '성장',
        statLabel: 'SP',
        accent: 0xdba6ff,
        severity: 'warning',
      };
    case 'forge-equipment':
      return {
        icon: '⚒',
        title: '장비 제작 보강',
        body: `${label} 준비도 ${ctx.readiness ?? 0}%입니다. 장비 제작으로 수호자 전력을 올리세요.`,
        ctaLabel: '제작 이동',
        chip: '보강',
        statLabel: '준비',
        accent: 0x66e0c6,
        severity: 'warning',
      };
    case 'power-risk':
      return {
        icon: '⚒',
        title: '장비 제작 보강',
        body: `${formatPower(ctx)}. 성장과 장비 제작으로 방어선을 보강하세요.`,
        ctaLabel: '던전 정비',
        chip: '위험',
        statLabel: 'DEF',
        accent: 0xff6b5f,
        severity: 'danger',
      };
    case 'battle-ready':
      return {
        icon: '⚔',
        title: '침공 대응 준비',
        body: ctx.requiredPower
          ? `${formatPower(ctx)}. 편성 상태가 안정적입니다.`
          : '방 배치와 성장 루프가 안정권입니다. 다음 전투를 준비하세요.',
        ctaLabel: '전투 준비',
        chip: '준비',
        statLabel: '준비',
        accent: 0xffe27a,
        severity: 'ready',
      };
  }
}
