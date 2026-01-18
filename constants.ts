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
  enemyReflect: '#00ffff', // 青/电光色 (反射)
  
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
  initialArenaSize: 900, // 稍微扩大一点初始场地
  minArenaSize: 400,
  shrinkRate: 5, 
  baseSpawnRate: 1400, 
  minSpawnRate: 300, 
  gravity: 0,
  friction: 0.9,
  enemySpeedBase: 45, 
  enemySpeedMax: 200, 
  playerDashSpeed: 10,
  comboDecay: 3000, 
  
  // Base Config
  baseMaxHp: 5,
  baseRadius: 40,
  
  // Item Config
  bombRadius: 250,
  slowDuration: 5000, // ms
  slowFactor: 0.4,
};

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";