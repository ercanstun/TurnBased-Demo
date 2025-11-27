import { Component, ChangeDetectionStrategy, input, output, signal, OnDestroy, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapEnemy, Position, BattleStartEvent, PlayerStats, InteractiveObject } from './models';

const PLAYER_SPEED = 2.5;
const ENEMY_SPEED = 1.5;
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const TILE_SIZE = 40;
const PROXIMITY_TRIGGER = TILE_SIZE * 3; 
const BATTLE_TRIGGER = TILE_SIZE * 0.8; 
const ENGAGE_DISTANCE = TILE_SIZE * 1.5;

@Component({
  selector: 'app-exploration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exploration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorationComponent implements OnDestroy {
  enemies = input.required<MapEnemy[]>();
  interactiveObjects = input.required<InteractiveObject[]>();
  startPosition = input.required<Position>();
  playerStats = input.required<PlayerStats & {maxHealth: number}>();
  playerGold = input.required<number>();
  levelUpMessage = input.required<string | null>();
  isActive = input.required<boolean>();

  battleStarted = output<BattleStartEvent>();
  inventoryToggled = output<void>();
  objectInteracted = output<InteractiveObject>();

  playerPosition = signal<Position>({ x: 0, y: 0 });
  private targetPosition = signal<Position | null>(null);
  
  private gameLoopId: number | null = null;

  constructor() {
    effect(() => {
        // This effect syncs the start position when it changes (e.g., after a battle)
        this.playerPosition.set(this.startPosition());
        this.targetPosition.set(this.startPosition());
    });

    // This effect manages the game loop based on the active state
    effect(() => {
        if (this.isActive()) {
            if (!this.gameLoopId) {
                this.gameLoopId = setInterval(() => this.updateGame(), 1000 / 60); // 60 FPS
            }
        } else {
            if (this.gameLoopId) {
                clearInterval(this.gameLoopId);
                this.gameLoopId = null;
            }
        }
    });
  }

  ngOnDestroy() {
    if (this.gameLoopId) {
      clearInterval(this.gameLoopId);
    }
  }
  
  onMapClick(event: MouseEvent) {
    if (!this.isActive()) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.targetPosition.set({ x: x - TILE_SIZE / 2, y: y - TILE_SIZE / 2 });
  }

  onEnemyClick(event: MouseEvent, enemy: MapEnemy) {
    if (!this.isActive()) return;
    event.stopPropagation(); // Prevent map click from firing
    this.tryEngageEnemy(enemy);
  }

  onObjectClick(event: MouseEvent, object: InteractiveObject) {
      if (!this.isActive() || object.isOpened) return;
      event.stopPropagation();
      if (this.isPlayerCloseTo(object)) {
        this.objectInteracted.emit(object);
      } else {
        this.targetPosition.set({x: object.position.x, y: object.position.y});
      }
  }

  isPlayerCloseTo(target: { position: Position }): boolean {
    const playerPos = this.playerPosition();
    const dx = playerPos.x - target.position.x;
    const dy = playerPos.y - target.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < ENGAGE_DISTANCE;
  }
  
  private tryEngageEnemy(enemy: MapEnemy) {
    if (this.isPlayerCloseTo(enemy)) {
        this.startBattle(enemy);
    } else {
        // If not close enough, set enemy as target to move towards
        this.targetPosition.set({x: enemy.position.x, y: enemy.position.y});
    }
  }

  private updateGame() {
    this.movePlayer();
    this.moveEnemies();
    this.checkCollisions();
  }

  private movePlayer() {
    const target = this.targetPosition();
    if (!target) return;

    this.playerPosition.update(pos => {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < PLAYER_SPEED) {
        return { ...target };
      }
      
      let newX = pos.x + (dx / distance) * PLAYER_SPEED;
      let newY = pos.y + (dy / distance) * PLAYER_SPEED;

      newX = Math.max(0, Math.min(MAP_WIDTH - TILE_SIZE, newX));
      newY = Math.max(0, Math.min(MAP_HEIGHT - TILE_SIZE, newY));
      return { x: newX, y: newY };
    });
  }
  
  private moveEnemies() {
      const playerPos = this.playerPosition();
      this.enemies().forEach(enemy => {
          const dx = playerPos.x - enemy.position.x;
          const dy = playerPos.y - enemy.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < PROXIMITY_TRIGGER && distance > BATTLE_TRIGGER) {
              enemy.position.x += (dx / distance) * ENEMY_SPEED;
              enemy.position.y += (dy / distance) * ENEMY_SPEED;
          }
      });
  }

  private checkCollisions() {
    const playerPos = this.playerPosition();
    for (const enemy of this.enemies()) {
      const dx = playerPos.x - enemy.position.x;
      const dy = playerPos.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < BATTLE_TRIGGER) {
        this.startBattle(enemy);
        return;
      }
    }
  }

  private startBattle(enemy: MapEnemy) {
    this.battleStarted.emit({ enemy: enemy, playerPosition: this.playerPosition() });
  }

  openInventory() {
    this.inventoryToggled.emit();
  }
}