export type Vector2 = {
  x: number;
  y: number;
};

export enum GameState {
  INIT = 'INIT', // Name Input
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum EnemyType {
  NORMAL = 'NORMAL',
  SHIELD = 'SHIELD', 
  FAST = 'FAST',    
  ROTATING = 'ROTATING', // New: Spinning text
  ELITE = 'ELITE',       // New: High HP, Big, Glowing
  REFLECT = 'REFLECT',   // New: Chain reaction
}

export enum BonusType {
  NONE = 'NONE',
  HEAL = 'HEAL', // +1 Base HP
  SLOW = 'SLOW', // Slow enemies globally
  BOMB = 'BOMB', // AOE Damage
}

export interface Entity {
  id: string;
  pos: Vector2;
  radius: number;
  color: string;
}

export interface Player extends Entity {
  trail: Vector2[];
  energy: number; // 0-100
  isAlive: boolean;
}

export interface Enemy extends Entity {
  char: string;
  type: EnemyType;
  bonus: BonusType;
  speed: number;
  spawnTime: number;
  maxHp: number;
  hp: number;
}

export interface Particle {
  id: string;
  pos: Vector2;
  targetPos?: Vector2; // For beams
  vel: Vector2;
  life: number; // 0-1
  decay: number;
  color: string;
  size: number;
  type: 'spark' | 'text' | 'ring' | 'shockwave' | 'beam';
  text?: string;
}

export interface GameStats {
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  kills: number;
  accuracy: number; 
  misses: number;
  timeAlive: number;
  finalBaseHp?: number;
}

export interface PeerData {
  id: string;
  name: string;
  totalScore: number; 
  lastSeen: number;
  // New Status Fields
  status?: 'LOBBY' | 'PLAYING';
  currentScore?: number;
  currentTime?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}