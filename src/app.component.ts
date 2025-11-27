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

  // Şu an engage ettiğimiz düşman (boss mu değil mi buradan anlayacağız)
  currentEnemy = signal<MapEnemy | null>(null);

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
    { id: 1, name: 'Goblin', maxHealth: 30, position: { x: 250, y: 100 }, type: 'goblin', opponentCount: 1, xpYield: 25, goldYield: 10, loot: [{ id: 101, name: "Eski Miğfer", slot: 'helmet', stats: { vit: 1 }, icon: '🪖' }] },
    { id: 2, name: 'Goblin', maxHealth: 30, position: { x: 400, y: 400 }, type: 'goblin', opponentCount: 2, xpYield: 50, goldYield: 25 },
    { id: 3, name: 'Goblin', maxHealth: 30, position: { x: 100, y: 300 }, type: 'goblin', opponentCount: 3, xpYield: 80, goldYield: 40, loot: [{ id: 102, name: "Keskin Hançer", slot: 'weapon', stats: { str: 4 }, icon: '🗡️' }] },
    {
      id: 4,
      name: 'Ancient Warlord',
      maxHealth: 130,
      xpYield: 100,
      goldYield: 250,
      type: 'goblin',
      position: { x: 600, y: 200 },
      opponentCount: 1,
      isBoss: true, // <<< boss
      loot: []
    }
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
    this.lastPlayerMapPosition = event.playerPosition;
    this.currentBattleEnemyId = event.enemy.id;

    // Haritadaki enemy kaydını bul
    const enemy = this.mapEnemies().find(e => e.id === event.enemy.id);
    this.currentEnemy.set(enemy ?? null);

    // Opponent listesini hazırla
    const opponents: Opponent[] = Array.from(
      { length: event.enemy.opponentCount ?? 1 }
    ).map((_, index) => {
      const isBoss = !!enemy?.isBoss && index === 0;
      const maxHp = isBoss ? 120 : 40; // boss için daha yüksek HP

      return {
        id: event.enemy.id * 10 + index,
        name: isBoss ? event.enemy.name : `${event.enemy.name} Minion`,
        maxHealth: maxHp,
        health: maxHp,
        animation: 'idle',
        effectInfo: null,
        isBoss
      };
    });

    this.battleOpponents.set(opponents);

    // Temel ödüller
    const baseRewards = {
      xp: event.enemy.xpYield,
      gold: event.enemy.goldYield,
      loot: event.enemy.loot ?? []
    };

    // Boss ise class'a göre EPIC silah ekle
    const isBossFight = enemy?.isBoss === true;
    let bossLoot: Item[] = [];

    if (isBossFight) {
      const playerClass = this.playerStats()?.class;

      let epicWeapon: Item;

      if (playerClass === 'warrior') {
        epicWeapon = {
          id: 104,
          name: 'Blade of the Ancients',
          slot: 'weapon',
          rarity: 'epic',
          icon: '🗡️' ,
          stats: { str: 10, vit: 5 },
        };
      } else if (playerClass === 'mage') {
        epicWeapon = {
          id: 105,
          name: 'Staff of Fallen Stars',
          slot: 'weapon',
          rarity: 'epic',
          icon: '🪄' ,
          stats: { int: 12 },
        };
      } else { // Ranger
        epicWeapon = {
          id: 106,
          name: 'Eaglefang Longbow',
          slot: 'weapon',
          rarity: 'epic',
          icon: '🏹' ,
          stats: { str: 8, int: 4 },
        };
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
    if (!this.playerStats()) return;

    if (event.result === 'victory' && this.battleRewards()) {
      const defeatedId = this.currentBattleEnemyId;
      const rewards = this.battleRewards()!;
      
      this.playerGold.update(g => g + rewards.gold);
      this.playerInventory.update(inv => [...inv, ...rewards.loot]);
      
      if (defeatedId !== null) {
          this.mapEnemies.update(enemies => enemies.filter(e => e.id !== defeatedId));
      }

      this.playerMapPosition.set(this.lastPlayerMapPosition);
      this.currentEnemy.set(null);

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