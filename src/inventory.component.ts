import { Component, ChangeDetectionStrategy, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStats, Item, EquippedItems, EquipmentSlot } from './models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent implements OnInit {
  playerStats = input.required<PlayerStats>();
  effectiveStats = input.required<PlayerStats & { maxHealth: number }>();
  inventory = input.required<Item[]>();
  equippedItems = input.required<EquippedItems>();
  
  close = output<void>();
  equipItem = output<Item>();
  unequipItem = output<EquipmentSlot>();
  allocateStats = output<{ str: number; vit: number; int: number; }>();

  equipmentSlots: EquipmentSlot[] = ['helmet', 'armor', 'weapon'];

  // Temp signals for stat allocation
  tempStr = signal(0);
  tempVit = signal(0);
  tempInt = signal(0);

  remainingPoints = computed(() => {
    const basePoints = this.playerStats()?.unallocatedStatPoints ?? 0;
    return basePoints - (this.tempStr() + this.tempVit() + this.tempInt());
  });

  hasPendingChanges = computed(() => this.tempStr() > 0 || this.tempVit() > 0 || this.tempInt() > 0);

  ngOnInit() {
    this.resetTempStats();
  }

  getBonusStat(stat: 'str' | 'vit' | 'int'): number {
    return this.effectiveStats()[stat] - this.playerStats()[stat];
  }

  increaseStat(stat: 'str' | 'vit' | 'int') {
    if (this.remainingPoints() > 0) {
      if (stat === 'str') this.tempStr.update(v => v + 1);
      if (stat === 'vit') this.tempVit.update(v => v + 1);
      if (stat === 'int') this.tempInt.update(v => v + 1);
    }
  }

  decreaseStat(stat: 'str' | 'vit' | 'int') {
    if (stat === 'str' && this.tempStr() > 0) this.tempStr.update(v => v - 1);
    if (stat === 'vit' && this.tempVit() > 0) this.tempVit.update(v => v - 1);
    if (stat === 'int' && this.tempInt() > 0) this.tempInt.update(v => v - 1);
  }

  confirmAllocation() {
    if (this.hasPendingChanges()) {
      this.allocateStats.emit({
        str: this.tempStr(),
        vit: this.tempVit(),
        int: this.tempInt(),
      });
      this.resetTempStats();
    }
  }

  private resetTempStats() {
    this.tempStr.set(0);
    this.tempVit.set(0);
    this.tempInt.set(0);
  }
}
