import { EnemyType } from './types';

export const COLORS = {
  background: '#050505',
  player: '#00ffff', // 青色
  base: '#ffffff', // 基地核心颜色
  baseLow: '#ff0000', // 基地低血量颜色
  enemyNormal: '#ff0055', // 玫红 (普通)
  enemyFast: '#ffff00', // 黄色 (闪避/高速)
  enemyShield: '#888888', // 灰色/银色 (护盾)
  enemyRotating: '#bd00ff', // 紫色 (旋转)
  enemyElite: '#ffaa00', // 金色 (精英)
  enemyReflect: '#00ffff', // 青/电光色 (反射/爆发)
  enemyChain: '#39ff14',   // 霓虹绿 (连锁)
  
  // Bonus Colors
  bonusHeal: '#00ff55', // 绿色
  bonusSlow: '#00ccff', // 冰蓝
  bonusBomb: '#ffaa00', // 橙色

  text: '#ffffff',
  arenaBorder: '#333333',
  arenaBorderCritical: '#ff0000',
  particles: {
    hit: '#ffffff',
    trail: 'rgba(0, 255, 255, 0.5)',
  }
};

export const GAME_CONFIG = {
  initialArenaSize: 900, 
  minArenaSize: 400,
  shrinkRate: 5, 
  
  // Note: SpawnRate and Speed are now controlled by DIFFICULTY_CURVE below
  minSpawnRate: 300, 
  gravity: 0,
  friction: 0.9,
  enemySpeedBase: 45, 
  enemySpeedMax: 250, 
  playerDashSpeed: 10,
  comboDecay: 3000, 
  
  // Projectile Config
  projectileSpeed: 600, // Pixels per second (Slower than instant)
  
  // Base Config
  baseMaxHp: 5,
  baseRadius: 40,
  
  // Item Config
  bombRadius: 250,
  slowDuration: 5000, // ms
  slowFactor: 0.4,
};

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// --- 难度配置表 ---
// 游戏会根据当前的击杀数(kills)，在两个阶段之间进行线性插值(Lerp)。
// 例如：当前击杀 5，处于 Stage 3(kills:3) 和 Stage 15(kills:15) 之间，数值会自动计算。
// weights: 敌人生成的权重比例 (数值越大，出现概率越高)
export const DIFFICULTY_CURVE = [
  { 
    kills: 0, 
    spawnInterval: 1400, // 毫秒
    speedMulti: 1.0,     // 速度倍率
    weights: { 
      [EnemyType.NORMAL]: 100, 
      [EnemyType.FAST]: 0, 
      [EnemyType.SHIELD]: 0, 
      [EnemyType.ROTATING]: 0, 
      [EnemyType.ELITE]: 0, 
      [EnemyType.REFLECT]: 0,
      [EnemyType.CHAIN]: 0
    } 
  },
  { 
    kills: 3, // 早期引入新机制
    spawnInterval: 1300, 
    speedMulti: 1.1, 
    weights: { 
      [EnemyType.NORMAL]: 60, 
      [EnemyType.FAST]: 10, 
      [EnemyType.SHIELD]: 10, 
      [EnemyType.ROTATING]: 0, 
      [EnemyType.ELITE]: 0, 
      [EnemyType.REFLECT]: 10, // 爆发怪
      [EnemyType.CHAIN]: 10    // 连锁怪
    } 
  },
  { 
    kills: 15, 
    spawnInterval: 1100, 
    speedMulti: 1.3, 
    weights: { 
      [EnemyType.NORMAL]: 30, 
      [EnemyType.FAST]: 20, 
      [EnemyType.SHIELD]: 20, 
      [EnemyType.ROTATING]: 10, 
      [EnemyType.ELITE]: 0, 
      [EnemyType.REFLECT]: 10,
      [EnemyType.CHAIN]: 10
    } 
  },
  { 
    kills: 30, // 精英怪开始出现
    spawnInterval: 1100, 
    speedMulti: 1.3, 
    weights: { 
      [EnemyType.NORMAL]: 25, 
      [EnemyType.FAST]: 15, 
      [EnemyType.SHIELD]: 15, 
      [EnemyType.ROTATING]: 15, 
      [EnemyType.ELITE]: 5, 
      [EnemyType.REFLECT]: 12,
      [EnemyType.CHAIN]: 13
    } 
  },
  { 
    kills: 60, // 高压阶段
    spawnInterval: 1000, 
    speedMulti: 1.5, 
    weights: { 
      [EnemyType.NORMAL]: 15, 
      [EnemyType.FAST]: 20, 
      [EnemyType.SHIELD]: 20, 
      [EnemyType.ROTATING]: 15, 
      [EnemyType.ELITE]: 10, 
      [EnemyType.REFLECT]: 10,
      [EnemyType.CHAIN]: 10
    } 
  },
  { 
    kills: 100, // 极限阶段
    spawnInterval: 500, 
    speedMulti: 3.0, 
    weights: { 
      [EnemyType.NORMAL]: 10, 
      [EnemyType.FAST]: 25, 
      [EnemyType.SHIELD]: 20, 
      [EnemyType.ROTATING]: 15, 
      [EnemyType.ELITE]: 15, 
      [EnemyType.REFLECT]: 7,
      [EnemyType.CHAIN]: 8
    } 
  },
  { 
    kills: 200, // 地狱阶段
    spawnInterval: 300, 
    speedMulti: 4.0, 
    weights: { 
      [EnemyType.NORMAL]: 5, 
      [EnemyType.FAST]: 25, 
      [EnemyType.SHIELD]: 20, 
      [EnemyType.ROTATING]: 20, 
      [EnemyType.ELITE]: 20, 
      [EnemyType.REFLECT]: 5,
      [EnemyType.CHAIN]: 5
    } 
  }
];