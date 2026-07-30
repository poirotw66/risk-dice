/**
 * Streak tiers — the whole UI escalates as the run gets longer, so the reward
 * for "one more roll" keeps visibly growing.
 */
export interface StreakTier {
  min: number;
  /** Rank name shown next to the streak counter */
  name: string;
  tagline: string;
  /** Main text colour */
  color: string;
  /** rgb triple used for glows / shadows */
  rgb: string;
  /** Particle palette for this tier */
  particles: string[];
  /** 0..1 — drives glow strength, shake, particle counts */
  intensity: number;
}

export const STREAK_TIERS: StreakTier[] = [
  {
    min: 0,
    name: '新手',
    tagline: 'Press START to roll fate...',
    color: '#67e8f9',
    rgb: '103, 232, 249',
    particles: ['#67e8f9', '#01CDFE', '#a5f3fc'],
    intensity: 0,
  },
  {
    min: 1,
    name: '熱身',
    tagline: '運氣站在你這邊',
    color: '#05FFA1',
    rgb: '5, 255, 161',
    particles: ['#05FFA1', '#34d399', '#B4F8C8'],
    intensity: 0.2,
  },
  {
    min: 5,
    name: '順風',
    tagline: '手感來了',
    color: '#fbbf24',
    rgb: '251, 191, 36',
    particles: ['#fbbf24', '#fde68a', '#f59e0b', '#05FFA1'],
    intensity: 0.4,
  },
  {
    min: 10,
    name: '火熱',
    tagline: '燙手！要不要收手？',
    color: '#fb923c',
    rgb: '251, 146, 60',
    particles: ['#fb923c', '#fbbf24', '#f97316', '#fff7ed'],
    intensity: 0.6,
  },
  {
    min: 20,
    name: '狂熱',
    tagline: '你已經賭上一切了',
    color: '#FF71CE',
    rgb: '255, 113, 206',
    particles: ['#FF71CE', '#f472b6', '#fbbf24', '#ffffff'],
    intensity: 0.8,
  },
  {
    min: 35,
    name: '傳說',
    tagline: '傳說級的貪婪',
    color: '#c084fc',
    rgb: '192, 132, 252',
    particles: ['#c084fc', '#FF71CE', '#67e8f9', '#ffffff'],
    intensity: 0.92,
  },
  {
    min: 50,
    name: '神話',
    tagline: '神話。骰子在顫抖。',
    color: '#fff1a8',
    rgb: '255, 241, 168',
    particles: ['#fff1a8', '#fbbf24', '#FF71CE', '#67e8f9', '#ffffff'],
    intensity: 1,
  },
];

export const getTier = (streak: number): StreakTier => {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) {
    if (streak >= t.min) tier = t;
  }
  return tier;
};

export const getTierIndex = (streak: number): number => {
  let index = 0;
  STREAK_TIERS.forEach((t, i) => {
    if (streak >= t.min) index = i;
  });
  return index;
};

const MILESTONES = [3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/** Next celebration checkpoint above the current streak */
export const nextMilestone = (streak: number): number => {
  const found = MILESTONES.find((m) => m > streak);
  if (found !== undefined) return found;
  return Math.ceil((streak + 1) / 25) * 25;
};

const previousMilestone = (streak: number): number => {
  let prev = 0;
  for (const m of MILESTONES) {
    if (m <= streak) prev = m;
  }
  if (streak > 100) prev = Math.floor(streak / 25) * 25;
  return prev;
};

/** 0..1 progress towards the next milestone */
export const milestoneProgress = (streak: number): number => {
  const next = nextMilestone(streak);
  const prev = previousMilestone(streak);
  if (next <= prev) return 0;
  return Math.min(1, Math.max(0, (streak - prev) / (next - prev)));
};

export const isMilestone = (streak: number): boolean =>
  streak > 0 && (MILESTONES.includes(streak) || (streak > 100 && streak % 25 === 0));
