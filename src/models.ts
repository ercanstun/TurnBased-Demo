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
  name: string;
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

export interface ShrineBuff {
    type: 'damage' | 'defense';
    multiplier: number;
    duration: number; // in number of fights
}

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
  // New properties for dungeon system
  clearedDungeonFloor: number;
  stamina: number;
  maxStamina: number;
  lastStaminaUpdateTime: number; // timestamp
  shrineBuff: ShrineBuff | null;
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

export interface InteractiveObject {
    id: number;
    type: 'chest' | 'shrine';
    position: Position;
    isOpened: boolean;
}