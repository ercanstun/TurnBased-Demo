import { Component, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BattleComponent } from './battle.component';
import { ExplorationComponent } from './exploration.component';
import { InventoryComponent } from './inventory.component';
import { ClassSelectionComponent } from './class-selection.component';
import { CastleComponent } from './castle.component';
import { DungeonSelectionComponent } from './dungeon-selection.component';
import { MapEnemy, Opponent, Position, BattleStartEvent, PlayerStats, BattleRewards, BattleResult, Item, EquippedItems, EquipmentSlot, PlayerClass, InteractiveObject, ShrineBuff } from './models';

const STAMINA_REGEN_RATE_MS = 5 * 60 * 1000; // 1 stamina per 5 minutes
const STAMINA_REGEN_AMOUNT = 1;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, BattleComponent, ExplorationComponent, InventoryComponent, ClassSelectionComponent, CastleComponent, DungeonSelectionComponent],
})
export class AppComponent implements OnInit {
  scene = signal<'classSelection' | 'exploration' | 'combat' | 'castle'>('classSelection');
  isInventoryOpen = signal(false);
  isDungeonSelectionOpen = signal(false);

  currentEnemy = signal<MapEnemy | null>(null);

  private getInitialStatsByClass(playerClass: PlayerClass): Omit<PlayerStats, 'level' | 'xp' | 'xpToNextLevel' | 'currentHealth' | 'unallocatedStatPoints' | 'skillPoints' | 'clearedDungeonFloor' | 'stamina' | 'maxStamina' | 'lastStaminaUpdateTime' | 'shrineBuff'> {
    switch (playerClass) {
      case 'warrior':
        return { class: 'warrior', str: 8, vit: 7, int: 3 };
      case 'mage':
        return { class: 'mage', str: 3, vit: 5, int: 10 };
      case 'ranger':
        return { class: 'ranger', str: 6, vit: 6, int: 6 };
      default:
        return { class: 'warrior', str: 5, vit: 5, int: 5 };
    }
  }

  // --- Player State ---
  playerStats = signal<PlayerStats | null>(null);

  playerInventory = signal<Item[]>([
      { id: 101, name: "Paslı Kılıç", slot: 'weapon', stats: { str: 2 }, icon: '🗡️' },
      { id: 201, name: "Deri Zırh", slot: 'armor', stats: { vit: 3 }, icon: '👕' },
  ]);
  equippedItems = signal<EquippedItems>({});

  effectivePlayerStats = computed(() => {
      const base = this.playerStats();
      if (!base) return null;

      const equipped = this.equippedItems();
      
      let bonusStr = 0;
      let bonusVit = 0;
      let bonusInt = 0;

      Object.values(equipped).forEach(item => {
          if (item) {
              bonusStr += item.stats.str ?? 0;
              bonusVit += item.stats.vit ?? 0;
              bonusInt += item.stats.int ?? 0;
          }
      });
      
      const totalVit = base.vit + bonusVit;
      const maxHealth = 10 * totalVit;

      return {
          ...base,
          maxHealth: maxHealth,
          currentHealth: Math.min(base.currentHealth, maxHealth),
          str: base.str + bonusStr,
          vit: totalVit,
          int: base.int + bonusInt,
      };
  });


  playerGold = signal<number>(0);
  levelUpMessage = signal<string | null>(null);

  // --- Exploration State ---
  playerStartPosition: Position = { x: 50, y: 50 };
  playerMapPosition = signal<Position>(this.playerStartPosition);
  private lastPlayerMapPosition: Position = this.playerStartPosition;
  
  mapEnemies = signal<MapEnemy[]>([]);
  mapInteractiveObjects = signal<InteractiveObject[]>([]);
  currentDungeonFloor = signal<number>(0);


  // --- Battle State ---
  battleOpponents = signal<Opponent[]>([]);
  battleRewards = signal<BattleRewards | null>(null);
  private currentBattleEnemyId: number | null = null;
  
  ngOnInit() {
      // Stamina regeneration loop
      setInterval(() => this.regenerateStamina(), 1000 * 60); // Check every minute
  }

  private regenerateStamina() {
    this.playerStats.update(stats => {
      if (!stats || stats.stamina >= stats.maxStamina) {
        return stats;
      }
      const now = Date.now();
      const diffMs = now - stats.lastStaminaUpdateTime;
      const staminaToRegen = Math.floor(diffMs / STAMINA_REGEN_RATE_MS);
      
      if (staminaToRegen > 0) {
        const newStamina = Math.min(stats.maxStamina, stats.stamina + (staminaToRegen * STAMINA_REGEN_AMOUNT));
        return { ...stats, stamina: newStamina, lastStaminaUpdateTime: now };
      }
      return stats;
    });
  }

  onClassSelected(playerClass: PlayerClass) {
    const initialStats = this.getInitialStatsByClass(playerClass);
    const maxHealth = 10 * initialStats.vit;
    const now = Date.now();
    this.playerStats.set({
      ...initialStats,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      currentHealth: maxHealth,
      unallocatedStatPoints: 0,
      skillPoints: 0,
      clearedDungeonFloor: 0,
      stamina: 20,
      maxStamina: 20,
      lastStaminaUpdateTime: now,
      shrineBuff: null,
    });
    this.scene.set('castle'); // Start in the castle after class selection
  }
  
  onFloorSelected(floor: number) {
    const stats = this.playerStats();
    if (!stats) return;
    const cost = 5 + floor * 2;
    if (stats.stamina < cost) return;

    this.playerStats.update(s => s ? {...s, stamina: s.stamina - cost} : null);

    this.generateMapForFloor(floor);
    this.currentDungeonFloor.set(floor);
    this.isDungeonSelectionOpen.set(false);
    this.scene.set('exploration');
  }
  
  private generateMapForFloor(floor: number) {
    const numEnemies = 3 + floor;
    const newEnemies: MapEnemy[] = [];
    for (let i = 0; i < numEnemies; i++) {
        newEnemies.push({
            id: (floor * 100) + i + 1,
            name: 'Goblin',
            maxHealth: 30 + (floor * 10),
            position: { x: 100 + Math.random() * 600, y: 100 + Math.random() * 400 },
            type: 'goblin',
            opponentCount: 1 + Math.floor(Math.random() * 2),
            xpYield: 25 + (floor * 15),
            goldYield: 10 + (floor * 10)
        });
    }

    // Add a boss at the end
    const bossId = (floor * 100) + numEnemies + 1;
    newEnemies.push({
      id: bossId,
      name: `Floor ${floor} Warlord`,
      maxHealth: 130 + (floor * 40),
      xpYield: 100 + (floor * 50),
      goldYield: 250 + (floor * 100),
      type: 'goblin',
      position: { x: 600, y: 200 },
      opponentCount: 1,
      isBoss: true,
      loot: []
    });
    this.mapEnemies.set(newEnemies);

    // Generate interactive objects
    const newObjects: InteractiveObject[] = [];
    const numChests = Math.floor(Math.random() * 3) + 1; // 1-3 chests
    for(let i=0; i<numChests; i++) {
        newObjects.push({ id: (floor * 10) + i, type: 'chest', position: { x: 150 + Math.random() * 500, y: 150 + Math.random() * 300 }, isOpened: false });
    }
    if (Math.random() > 0.5) { // 50% chance for a shrine
        newObjects.push({ id: (floor * 10) + 9, type: 'shrine', position: { x: 150 + Math.random() * 500, y: 150 + Math.random() * 300 }, isOpened: false });
    }
    this.mapInteractiveObjects.set(newObjects);
  }

  onBattleStarted(event: BattleStartEvent) {
    this.lastPlayerMapPosition = event.playerPosition;
    this.currentBattleEnemyId = event.enemy.id;

    const enemy = this.mapEnemies().find(e => e.id === event.enemy.id);
    this.currentEnemy.set(enemy ?? null);

    const opponents: Opponent[] = Array.from(
      { length: event.enemy.opponentCount ?? 1 }
    ).map((_, index) => {
      const isBoss = !!enemy?.isBoss && index === 0;
      const floor = this.currentDungeonFloor();
      const maxHp = isBoss ? (120 + floor * 40) : (40 + floor * 10);

      return {
        id: event.enemy.id * 10 + index,
        name: isBoss ? event.enemy.name : `Goblin Minion`,
        maxHealth: maxHp,
        health: maxHp,
        animation: 'idle',
        effectInfo: null,
        isBoss
      };
    });

    this.battleOpponents.set(opponents);

    const baseRewards = {
      xp: event.enemy.xpYield,
      gold: event.enemy.goldYield,
      loot: event.enemy.loot ?? []
    };

    const isBossFight = enemy?.isBoss === true;
    let bossLoot: Item[] = [];

    if (isBossFight) {
      const playerClass = this.playerStats()?.class;
      let epicWeapon: Item;
      if (playerClass === 'warrior') {
        epicWeapon = { id: 104, name: 'Blade of the Ancients', slot: 'weapon', rarity: 'epic', icon: '🗡️' , stats: { str: 10, vit: 5 } };
      } else if (playerClass === 'mage') {
        epicWeapon = { id: 105, name: 'Staff of Fallen Stars', slot: 'weapon', rarity: 'epic', icon: '🪄' , stats: { int: 12 } };
      } else { // Ranger
        epicWeapon = { id: 106, name: 'Eaglefang Longbow', slot: 'weapon', rarity: 'epic', icon: '🏹' , stats: { str: 8, int: 4 } };
      }
      bossLoot = [epicWeapon];
    }

    this.battleRewards.set({
      xp: baseRewards.xp,
      gold: baseRewards.gold,
      loot: [...(baseRewards.loot ?? []), ...bossLoot]
    });

    this.scene.set('combat');
  }

  onBattleEnded(event: BattleResult) {
    const stats = this.playerStats();
    if (!stats) return;

    const enemyThatWasFought = this.currentEnemy();

    // Consume shrine buff
    this.playerStats.update(s => s ? {...s, shrineBuff: null} : null);

    if (event.result === 'victory' && this.battleRewards()) {
      const defeatedId = this.currentBattleEnemyId;
      const rewards = this.battleRewards()!;
      
      this.playerGold.update(g => g + rewards.gold);
      this.playerInventory.update(inv => [...inv, ...rewards.loot]);
      
      if (defeatedId !== null) {
          this.mapEnemies.update(enemies => enemies.filter(e => e.id !== defeatedId));
      }

      this.playerMapPosition.set(this.lastPlayerMapPosition);

      this.playerStats.update(s => {
        if (!s) return null;
        let updatedStats: PlayerStats = { ...s, xp: s.xp + rewards.xp, currentHealth: event.finalPlayerHealth };
        
        if (updatedStats.xp >= updatedStats.xpToNextLevel) {
          const excessXp = updatedStats.xp - updatedStats.xpToNextLevel;
          updatedStats = {
            ...updatedStats,
            level: updatedStats.level + 1,
            xp: excessXp,
            xpToNextLevel: Math.floor(updatedStats.xpToNextLevel * 1.5),
            unallocatedStatPoints: updatedStats.unallocatedStatPoints + 3,
            skillPoints: updatedStats.skillPoints + 1,
          };
          const newMaxHealth = 10 * (this.effectivePlayerStats()?.vit ?? updatedStats.vit);
          updatedStats.currentHealth = newMaxHealth;
          this.levelUpMessage.set(`SEVİYE ATLADIN! Seviye ${updatedStats.level}!`);
          setTimeout(() => this.levelUpMessage.set(null), 4000);
        }
        return updatedStats;
      });

      if (enemyThatWasFought?.isBoss) {
        this.playerStats.update(s => {
            if (!s) return null;
            if (s.clearedDungeonFloor === this.currentDungeonFloor()) {
                return {...s, clearedDungeonFloor: s.clearedDungeonFloor + 1};
            }
            return s;
        });
        this.scene.set('castle');
      } else {
        // If all non-boss enemies are defeated, go back to castle, else exploration
        if (this.mapEnemies().every(e => e.isBoss)) {
            this.scene.set('castle');
        } else {
            this.scene.set('exploration');
        }
      }
    } else { // Defeat
      this.playerMapPosition.set(this.playerStartPosition);
      this.playerStats.update(s => {
        if (!s) return null;
        const effectiveStats = this.effectivePlayerStats();
        return {...s, currentHealth: Math.max(1, Math.floor((effectiveStats?.maxHealth ?? s.vit * 10) / 10)) };
      });
      this.scene.set('castle');
    }

    this.currentEnemy.set(null);
    this.currentBattleEnemyId = null;
    this.battleRewards.set(null);
  }

  toggleInventory() {
      this.isInventoryOpen.update(v => !v);
  }

  onOpenDungeonSelection() {
      this.isDungeonSelectionOpen.set(true);
  }

  onObjectInteracted(object: InteractiveObject) {
      this.mapInteractiveObjects.update(objects => objects.map(o => o.id === object.id ? {...o, isOpened: true} : o));

      if (object.type === 'chest') {
          const goldFound = Math.floor(Math.random() * 50) + 10;
          this.playerGold.update(g => g + goldFound);
      } else if (object.type === 'shrine') {
          const buff: ShrineBuff = { type: 'damage', multiplier: 1.2, duration: 1 };
          this.playerStats.update(s => s ? {...s, shrineBuff: buff} : null);
      }
  }

  onEquipItem(itemToEquip: Item) {
      this.equippedItems.update(current => {
          const newEquipped = { ...current };
          const oldItem = newEquipped[itemToEquip.slot];
          this.playerInventory.update(inv => {
              const newInv = inv.filter(i => i.id !== itemToEquip.id);
              if (oldItem) {
                  newInv.push(oldItem);
              }
              return newInv;
          });
          newEquipped[itemToEquip.slot] = itemToEquip;
          return newEquipped;
      });
  }

  onUnequipItem(slot: EquipmentSlot) {
      this.equippedItems.update(current => {
          const itemToUnequip = current[slot];
          if (itemToUnequip) {
              const newEquipped = { ...current };
              delete newEquipped[slot];
              this.playerInventory.update(inv => [...inv, itemToUnequip]);
              return newEquipped;
          }
          return current;
      });
  }

  onAllocateStats(statsToAllocate: { str: number, vit: number, int: number }) {
      this.playerStats.update(current => {
          if (!current) return null;
          const totalPointsSpent = statsToAllocate.str + statsToAllocate.vit + statsToAllocate.int;
          if (totalPointsSpent > current.unallocatedStatPoints) {
              return current;
          }
          const newStats: PlayerStats = { ...current };
          newStats.str += statsToAllocate.str;
          newStats.vit += statsToAllocate.vit;
          newStats.int += statsToAllocate.int;
          newStats.unallocatedStatPoints -= totalPointsSpent;
          
          const effective = this.effectivePlayerStats();
          const oldBaseVit = current.vit;
          const bonusVit = (effective?.vit ?? oldBaseVit) - oldBaseVit;
          
          const oldMaxHealth = 10 * (oldBaseVit + bonusVit);
          const newMaxHealth = 10 * (newStats.vit + bonusVit);
          
          const healthIncrease = newMaxHealth - oldMaxHealth;
          newStats.currentHealth = Math.min(newMaxHealth, newStats.currentHealth + healthIncrease);

          return newStats;
      });
  }
}