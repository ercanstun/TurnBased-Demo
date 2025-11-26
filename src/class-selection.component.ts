import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerClass } from './models';

interface ClassInfo {
  id: PlayerClass;
  name: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-class-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './class-selection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClassSelectionComponent {
  classSelected = output<PlayerClass>();

  selectedClass = signal<PlayerClass | null>(null);

  classes: ClassInfo[] = [
    { 
      id: 'warrior', 
      name: 'Savaşçı', 
      description: 'Yakın dövüş ustası. Yüksek can ve zırhıyla ön saflarda savaşır.', 
      icon: '⚔️' 
    },
    { 
      id: 'mage', 
      name: 'Büyücü', 
      description: 'Elementlerin efendisi. Yıkıcı büyüleriyle düşman gruplarını yok eder.', 
      icon: '🔥' 
    },
    { 
      id: 'ranger', 
      name: 'Okçu', 
      description: 'Usta bir iz sürücü ve nişancı. Uzaktan hassas ve ölümcül saldırılar yapar.', 
      icon: '🏹' 
    }
  ];

  selectClass(playerClass: PlayerClass) {
    this.selectedClass.set(playerClass);
  }

  confirmSelection() {
    if (this.selectedClass()) {
      this.classSelected.emit(this.selectedClass()!);
    }
  }
}
