export interface Skill {
  name: string;
  icon: string;
  color: string;
  type: 'damage' | 'heal' | 'aoe';
  multiplier?: number;
  healAmount?: number;
  cooldown?: number;
}

export interface EffectInfo {
  value: number;
  key: number;
  type: 'damage' | 'heal';
}

export interface Opponent {
  id: number;
  health: number;
  maxHealth: number;
  animation: AnimationState;
  effectInfo: EffectInfo | null;
  isBoss?: boolean;
}

export type GameStatus = 'playing' | 'victory' | 'defeat';
export type AnimationState = 'idle' | 'attacking' | 'hit';

export interface Position {
  x: number;
  y: number;
}

export type EquipmentSlot = 'weapon' | 'armor' | 'helmet';

export interface StatBonus {
  str?: number;
  vit?: number;
  int?: number;
}

export interface Item {
  id: number;
  name: string;
  slot: EquipmentSlot;
  stats: StatBonus;
  icon: string;
  rarity?: 'common' | 'rare' | 'epic';
}

export interface MapEnemy {
  id: number;
  name: string;
  maxHealth: number;
  position: Position;
  type: 'goblin';
  opponentCount: number;
  xpYield: number;
  goldYield: number;
  loot?: Item[];
  isBoss?: boolean;
}

export interface BattleStartEvent {
    enemy: MapEnemy;
    playerPosition: Position;
}

export type PlayerClass = 'warrior' | 'mage' | 'ranger';

// Represents the player's BASE stats, without equipment bonuses
export interface PlayerStats {
  class: PlayerClass;
  level: number;
  xp: number;
  xpToNextLevel: number;
  currentHealth: number;
  str: number; // Strength: affects physical damage
  vit: number; // Vitality: affects max health & defense
  int: number; // Intelligence: affects magic damage and healing
  unallocatedStatPoints: number;
  skillPoints: number;
}

export interface BattleRewards {
    xp: number;
    gold: number;
    loot: Item[];
}

export interface BattleResult {
    result: 'victory' | 'defeat';
    finalPlayerHealth: number;
}

export type EquippedItems = {
  [key in EquipmentSlot]?: Item;
};