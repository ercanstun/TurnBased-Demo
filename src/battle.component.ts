import { Component, ChangeDetectionStrategy, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Skill, Opponent, GameStatus, AnimationState, EffectInfo, PlayerStats, BattleRewards, BattleResult } from './models';

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './battle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleComponent {
  initialOpponents = input.required<Opponent[]>();
  playerStats = input.required<PlayerStats & {maxHealth: number}>(); // Now receives effective stats
  battleRewards = input.required<BattleRewards | null>();
  battleEnded = output<BattleResult>();

  maxHealth = computed(() => this.playerStats().maxHealth);
  playerHealth = signal(100);
  
  opponents = signal<Opponent[]>([]);
  gameStatus = signal<GameStatus>('playing');
  isPlayerTurn = signal(true);
  
  playerAnimation = signal<AnimationState>('idle');
  playerEffectInfo = signal<EffectInfo | null>(null);

  isGameOver = computed(() => this.gameStatus() !== 'playing');

  skills: Skill[] = [
    { name: 'Yumruk', icon: '👊', color: 'bg-gray-500 hover:bg-gray-600', type: 'damage', multiplier: 1.0 },
    { name: 'Tekme', icon: '🦶', color: 'bg-orange-500 hover:bg-orange-600', type: 'damage', multiplier: 1.2 },
    { name: 'Can Basma', icon: '💚', color: 'bg-green-600 hover:bg-green-700', type: 'heal', healAmount: 20 },
    { name: 'Ateş Yağmuru', icon: '☄️', color: 'bg-red-700 hover:bg-red-800', type: 'aoe', multiplier: 0.7 }
  ];
  
  constructor() {
    effect(() => {
      const status = this.gameStatus();
      if (status === 'victory' || status === 'defeat') {
        setTimeout(() => {
          this.battleEnded.emit({ result: status, finalPlayerHealth: this.playerHealth() });
        }, 3000); 
      }
    });
  }

  ngOnInit() {
    this.resetGame();
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async playerAttack(skill: Skill) {
    if (!this.isPlayerTurn() || this.isGameOver()) return;
    this.isPlayerTurn.set(false);
    
    this.playerAnimation.set('attacking');
    await this.delay(400);

    const stats = this.playerStats();

    switch (skill.type) {
      case 'heal':
        const healAmount = (skill.healAmount ?? 20) + stats.int * 2; // Heal scales with INT
        this.playerHealth.update(h => Math.min(this.maxHealth(), h + healAmount));
        this.playerEffectInfo.set({ value: healAmount, key: Date.now(), type: 'heal' });
        setTimeout(() => this.playerEffectInfo.set(null), 1000);
        break;
      
      case 'aoe':
        const aoeBaseDamage = 5 + stats.int; // AoE scales with INT
        const aoeDamage = Math.round(aoeBaseDamage * (skill.multiplier ?? 0.7));
        this.opponents.update(opps => opps.map(o => {
          if (o.health > 0) {
            return { ...o, health: Math.max(0, o.health - aoeDamage), effectInfo: { value: aoeDamage, key: Date.now(), type: 'damage' }, animation: 'hit' };
          }
          return o;
        }));
        setTimeout(() => {
           this.opponents.update(opps => opps.map(o => ({ ...o, effectInfo: null, animation: 'idle' })));
        }, 1000);
        break;
      
      case 'damage':
        const livingOpponents = this.opponents().filter(o => o.health > 0);
        if (livingOpponents.length > 0) {
          const target = livingOpponents[Math.floor(Math.random() * livingOpponents.length)];
          const baseDamage = 8 + stats.str; // Damage scales with STR
          const damage = Math.round(baseDamage * (skill.multiplier ?? 1));
          
          this.opponents.update(opps => opps.map(o => 
              o.id === target.id 
              ? { ...o, health: Math.max(0, o.health - damage), effectInfo: { value: damage, key: Date.now(), type: 'damage' }, animation: 'hit' } 
              : o
          ));
          setTimeout(() => {
             this.opponents.update(opps => opps.map(o => o.id === target.id ? { ...o, effectInfo: null, animation: 'idle' } : o));
          }, 1000);
        }
        break;
    }
   
    this.playerAnimation.set('idle');
    
    if (this.opponents().every(o => o.health <= 0)) {
      this.gameStatus.set('victory');
      return;
    }

    await this.delay(1000);
    this.opponentsTurn();
  }

  async opponentsTurn() {
    if (this.isGameOver()) return;
    
    const livingOpponents = this.opponents().filter(o => o.health > 0);

    for (const opponent of livingOpponents) {
      this.opponents.update(opps => opps.map(o => o.id === opponent.id ? { ...o, animation: 'attacking' } : o));
      await this.delay(400);

      const defense = Math.floor(this.playerStats().vit / 2);
      const baseDamage = Math.floor(Math.random() * 5) + 6; // Base enemy damage
      const damage = Math.max(1, baseDamage - defense); // Damage reduction from VIT
      
      this.playerHealth.update(h => Math.max(0, h - damage));
      this.playerEffectInfo.set({ value: damage, key: Date.now(), type: 'damage' });
      setTimeout(() => this.playerEffectInfo.set(null), 1000);

      this.playerAnimation.set('hit');
      await this.delay(400);
      this.playerAnimation.set('idle');

      this.opponents.update(opps => opps.map(o => o.id === opponent.id ? { ...o, animation: 'idle' } : o));

      if (this.playerHealth() <= 0) {
        this.gameStatus.set('defeat');
        return;
      }
      await this.delay(500);
    }
    this.isPlayerTurn.set(true);
  }

  resetGame() {
    this.playerHealth.set(this.playerStats().currentHealth);
    this.gameStatus.set('playing');
    this.isPlayerTurn.set(true);
    this.playerAnimation.set('idle');
    this.playerEffectInfo.set(null);
    this.opponents.set(JSON.parse(JSON.stringify(this.initialOpponents())));
  }

  getHealthBarColor(health: number, maxHealth: number): string {
    const ratio = health / maxHealth;
    if (ratio > 0.6) return 'bg-green-500';
    if (ratio > 0.3) return 'bg-yellow-500';
    return 'bg-red-600';
  }
}
