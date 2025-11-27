import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dungeon-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dungeon-selection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonSelectionComponent {
  clearedFloor = input.required<number>();
  stamina = input.required<number>();
  
  floorSelected = output<number>();
  close = output<void>();

  maxFloors = 10;
  
  get floors() {
    return Array.from({length: this.maxFloors}, (_, i) => {
      const floor = i + 1;
      const isUnlocked = floor <= this.clearedFloor() + 1;
      const cost = 5 + floor * 2;
      return {
        number: floor,
        isUnlocked,
        isCleared: floor <= this.clearedFloor(),
        cost,
        canEnter: isUnlocked && this.stamina() >= cost,
      }
    });
  }

  selectFloor(floor: { number: number, canEnter: boolean }) {
    if (floor.canEnter) {
      this.floorSelected.emit(floor.number);
    }
  }
}