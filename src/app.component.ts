import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BattleComponent } from './battle.component';
import { ExplorationComponent } from './exploration.component';
import { InventoryComponent } from './inventory.component';
import { ClassSelectionComponent } from './class-selection.component';
import { MapEnemy, Opponent, Position, BattleStartEvent, PlayerStats, BattleRewards, BattleResult, Item, EquippedItems, EquipmentSlot, PlayerClass } from './models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, BattleComponent, ExplorationComponent, InventoryComponent, ClassSelectionComponent],
})
export class AppComponent {
  scene = signal<'classSelection' | 'exploration' | 'combat'>('classSelection');
  isInventoryOpen = signal(false);
  
  private getInitialStatsByClass(playerClass: PlayerClass): Omit<PlayerStats, 'level' | 'xp' | 'xpToNextLevel' | 'currentHealth' | 'unallocatedStatPoints' | 'skillPoints'> {
    switch (playerClass) {
      case 'warrior':
        return { class: 'warrior', str: 8, vit: 7, int: 3 };
      case 'mage':
        return { class: 'mage', str: 3, vit: 5, int: 10 };
      case 'ranger':
        return { class: 'ranger', str: 6, vit: 6, int: 6 };
      default:
        // This case should not be reached if UI is correct
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
  
  mapEnemies = signal<MapEnemy[]>([
    { id: 1, position: { x: 250, y: 100 }, type: 'goblin', opponentCount: 1, xpYield: 25, goldYield: 10, loot: [{ id: 301, name: "Eski Miğfer", slot: 'helmet', stats: { vit: 1 }, icon: '🪖' }] },
    { id: 2, position: { x: 400, y: 400 }, type: 'goblin', opponentCount: 2, xpYield: 50, goldYield: 25 },
    { id: 3, position: { x: 100, y: 300 }, type: 'goblin', opponentCount: 3, xpYield: 80, goldYield: 40, loot: [{ id: 102, name: "Keskin Hançer", slot: 'weapon', stats: { str: 4 }, icon: '🗡️' }] },
    { id: 4, position: { x: 600, y: 200 }, type: 'goblin', opponentCount: 2, xpYield: 55, goldYield: 30 },
  ]);

  // --- Battle State ---
  battleOpponents = signal<Opponent[]>([]);
  battleRewards = signal<BattleRewards | null>(null);
  private currentBattleEnemyId: number | null = null;

  onClassSelected(playerClass: PlayerClass) {
    const initialStats = this.getInitialStatsByClass(playerClass);
    const maxHealth = 10 * initialStats.vit;
    this.playerStats.set({
      ...initialStats,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      currentHealth: maxHealth,
      unallocatedStatPoints: 0,
      skillPoints: 0,
    });
    this.scene.set('exploration');
  }

  onBattleStarted(event: BattleStartEvent) {
    this.currentBattleEnemyId = event.enemy.id;
    this.lastPlayerMapPosition = event.playerPosition;
    this.battleRewards.set({ xp: event.enemy.xpYield, gold: event.enemy.goldYield, loot: event.enemy.loot ?? [] });
    
    const opponentsForBattle: Opponent[] = [];
    for (let i = 0; i < event.enemy.opponentCount; i++) {
        const health = 50;
        opponentsForBattle.push({
            id: i,
            health: health,
            maxHealth: health,
            animation: 'idle',
            effectInfo: null
        });
    }

    this.battleOpponents.set(opponentsForBattle);
    this.scene.set('combat');
  }

  onBattleEnded(event: BattleResult) {
    if (!this.playerStats()) return;

    if (event.result === 'victory' && this.battleRewards()) {
      const rewards = this.battleRewards()!;
      this.playerGold.update(g => g + rewards.gold);
      this.playerInventory.update(inv => [...inv, ...rewards.loot]);
      this.mapEnemies.update(enemies => enemies.filter(e => e.id !== this.currentBattleEnemyId));
      this.playerMapPosition.set(this.lastPlayerMapPosition);
      
      this.playerStats.update(stats => {
        if (!stats) return null;
        let updatedStats: PlayerStats = { ...stats, xp: stats.xp + rewards.xp, currentHealth: event.finalPlayerHealth };
        
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
          updatedStats.currentHealth = newMaxHealth; // Full heal on level up

          this.levelUpMessage.set(`SEVİYE ATLADIN! Seviye ${updatedStats.level}!`);
          setTimeout(() => this.levelUpMessage.set(null), 4000);
        }
        return updatedStats;
      });
    } else {
      this.playerMapPosition.set(this.playerStartPosition);
      this.playerStats.update(stats => {
        if (!stats) return null;
        const effectiveStats = this.effectivePlayerStats();
        return {...stats, currentHealth: Math.max(1, Math.floor((effectiveStats?.maxHealth ?? stats.vit * 10) / 10)) };
      });
    }
    this.scene.set('exploration');
    this.currentBattleEnemyId = null;
    this.battleRewards.set(null);
  }

  toggleInventory() {
      this.isInventoryOpen.update(v => !v);
  }

  onEquipItem(itemToEquip: Item) {
      this.equippedItems.update(current => {
          const newEquipped = { ...current };
          const oldItem = newEquipped[itemToEquip.slot];

          // Remove item from inventory, add old item back
          this.playerInventory.update(inv => {
              const newInv = inv.filter(i => i.id !== itemToEquip.id);
              if (oldItem) {
                  newInv.push(oldItem);
              }
              return newInv;
          });

          // Equip new item
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
              return current; // Not enough points, do nothing
          }

          const newStats: PlayerStats = { ...current };
          newStats.str += statsToAllocate.str;
          newStats.vit += statsToAllocate.vit;
          newStats.int += statsToAllocate.int;
          newStats.unallocatedStatPoints -= totalPointsSpent;

          // Update current health based on new vitality
          const effective = this.effectivePlayerStats();
          const bonusVit = (effective?.vit ?? newStats.vit) - current.vit;
          const oldMaxHealth = 10 * (current.vit + bonusVit);
          const newMaxHealth = 10 * (newStats.vit + bonusVit);
          const healthIncrease = newMaxHealth - oldMaxHealth;
          newStats.currentHealth = Math.min(newMaxHealth, newStats.currentHealth + healthIncrease);

          return newStats;
      });
  }
}
