import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStats } from './models';

interface BuildingSlot {
  id: string;
  name: string;
  description: string;
  level: number;
  icon: string;
}

@Component({
  selector: 'app-castle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './castle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CastleComponent {
  playerStats = input.required<PlayerStats>();
  effectivePlayerStats = input.required<PlayerStats & { maxHealth: number }>();
  playerGold = input.required<number>();

  openDungeonSelection = output<void>();
  openInventory = output<void>();

  buildingSlots: BuildingSlot[] = [
    { id: 'townhall', name: 'Belediye Binası', description: 'Krallığınızın merkezi. Buradan şehrinizi yönetin.', level: 1, icon: '🏰' },
    { id: 'barracks', name: 'Kışla', description: 'Askerlerinizi eğitin ve ordunuzu güçlendirin.', level: 1, icon: '⚔️' },
    { id: 'blacksmith', name: 'Demirci', description: 'Yeni silahlar ve zırhlar üretin.', level: 1, icon: '🛡️' },
    { id: 'farm', name: 'Çiftlik', description: 'Krallığınız için kaynak ve yiyecek üretin.', level: 1, icon: '🌾' },
    { id: 'magic_tower', name: 'Büyü Kulesi', description: 'Yıkıcı büyüler araştırın ve büyücülerinizi eğitin.', level: 1, icon: '🔮' },
  ];
}