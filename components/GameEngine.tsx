import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, GameStats, Player, Enemy, EnemyType, BonusType, Particle, Vector2 } from '../types';
import { COLORS, GAME_CONFIG, ALPHABET } from '../constants';
import { Shield, Zap, Heart, Snowflake, Bomb } from 'lucide-react';
import { soundService } from '../services/soundService';
import { p2pService } from '../services/p2pService';

interface GameEngineProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onGameOver: (stats: GameStats) => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ gameState, setGameState, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Game State Refs
  const statsRef = useRef<GameStats>({
    score: 0, highScore: 0, combo: 0, maxCombo: 0, kills: 0, accuracy: 0, misses: 0, timeAlive: 0
  });
  const playerRef = useRef<Player>({
    id: 'p1', pos: { x: 0, y: 0 }, radius: 10, color: COLORS.player, trail: [], energy: 100, isAlive: true
  });
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const baseHpRef = useRef<number>(GAME_CONFIG.baseMaxHp);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const slowTimerRef = useRef<number>(0); // Global slow effect timer
  const arenaSizeRef = useRef<number>(GAME_CONFIG.initialArenaSize);
  const cameraShakeRef = useRef<number>(0);
  const comboTimerRef = useRef<number>(0);
  const requestIdRef = useRef<number>(0);
  const screenFlashRef = useRef<{color: string, life: number} | null>(null);
  const broadcastIntervalRef = useRef<number>(0);
  
  // React State for HUD
  const [hudScore, setHudScore] = useState(0);
  const [hudCombo, setHudCombo] = useState(0);
  const [hudBaseHp, setHudBaseHp] = useState(GAME_CONFIG.baseMaxHp);
  const [activeEffects, setActiveEffects] = useState<string[]>([]);

  // Helper: Random Range
  const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

  // Helper: Add Particle
  const addParticle = (pos: Vector2, count: number, color: string, type: Particle['type'] = 'spark', text?: string, sizeScale: number = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(50, 200);
      particlesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        pos: { ...pos },
        vel: type === 'text' 
          ? { x: 0, y: -50 } 
          : type === 'shockwave' 
             ? {x:0, y:0} // Stationary expanding ring
             : { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 1.0,
        decay: type === 'text' ? 1.0 : randomRange(1.5, 3.0),
        color: color,
        size: (type === 'text' ? 20 : randomRange(2, 5)) * sizeScale,
        type,
        text
      });
    }
  };

  // Helper: Trigger Screen Flash
  const triggerScreenFlash = (color: string, life: number = 0.5) => {
    screenFlashRef.current = { color, life };
  };

  // Helper: Spawn Enemy
  const spawnEnemy = () => {
    const side = Math.floor(Math.random() * 4);
    const size = arenaSizeRef.current;
    const offset = 60; // Increased offset so big enemies don't spawn onscreen
    let x = 0, y = 0;

    switch (side) {
      case 0: x = randomRange(-size/2, size/2); y = -size/2 - offset; break;
      case 1: x = size/2 + offset; y = randomRange(-size/2, size/2); break;
      case 2: x = randomRange(-size/2, size/2); y = size/2 + offset; break;
      case 3: x = -size/2 - offset; y = randomRange(-size/2, size/2); break;
    }

    const existingChars = new Set(enemiesRef.current.map(e => e.char));
    const availableChars = ALPHABET.split('').filter(c => !existingChars.has(c));
    const char = availableChars.length > 0 
      ? availableChars[Math.floor(Math.random() * availableChars.length)] 
      : ALPHABET[Math.floor(Math.random() * 26)]; 

    // Difficulty Progression
    const kills = statsRef.current.kills;
    const difficulty = Math.min(kills / 100, 1.0);
    const rand = Math.random();
    
    let type = EnemyType.NORMAL;
    let color = COLORS.enemyNormal;
    let hp = 1;
    let radius = 18;
    let bonus = BonusType.NONE;

    // Enemy Type Logic
    // Elite (Starts appearing after 30 kills)
    if (kills > 30 && rand < 0.05 + (difficulty * 0.1)) {
      type = EnemyType.ELITE;
      color = COLORS.enemyElite;
      hp = Math.floor(randomRange(5, 8)); // 5 to 7 HP
      radius = 28; // Bigger
    } 
    // Rotating (Starts appearing after 15 kills)
    else if (kills > 15 && rand < 0.2 + (difficulty * 0.15)) {
      type = EnemyType.ROTATING;
      color = COLORS.enemyRotating;
      hp = 1;
    }
    // Shield
    else if (rand < 0.2 + (difficulty * 0.15)) {
      type = EnemyType.SHIELD;
      color = COLORS.enemyShield;
      hp = 2; 
    } 
    // Fast
    else if (rand < 0.35 + (difficulty * 0.2)) {
      type = EnemyType.FAST;
      color = COLORS.enemyFast;
      hp = 1;
    }

    // Bonus Item Logic (15% chance, independent of type)
    if (Math.random() < 0.15) {
      const bonusRand = Math.random();
      if (bonusRand < 0.4) {
        bonus = BonusType.HEAL;
        color = COLORS.bonusHeal;
      } else if (bonusRand < 0.7) {
        bonus = BonusType.BOMB;
        color = COLORS.bonusBomb;
      } else {
        bonus = BonusType.SLOW;
        color = COLORS.bonusSlow;
      }
    }

    // Speed scaling
    const speedMultiplier = 1 + (difficulty * 2.0);
    let baseSpeed = GAME_CONFIG.enemySpeedBase;
    
    if (type === EnemyType.FAST) baseSpeed *= 1.5;
    if (type === EnemyType.ELITE) baseSpeed *= 0.6; // Elites are slower

    const finalSpeed = Math.min(baseSpeed * speedMultiplier, GAME_CONFIG.enemySpeedMax);

    enemiesRef.current.push({
      id: Math.random().toString(),
      pos: { x, y },
      radius: radius,
      color: color,
      char: char,
      type: type,
      bonus: bonus,
      speed: finalSpeed,
      spawnTime: performance.now(),
      maxHp: hp,
      hp: hp
    });
  };

  // --- Input Handling ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameState !== GameState.PLAYING) return;

    const char = e.key.toUpperCase();
    if (!ALPHABET.includes(char)) return;

    const targetIndex = enemiesRef.current.findIndex(en => en.char === char);

    if (targetIndex !== -1) {
      const target = enemiesRef.current[targetIndex];
      const player = playerRef.current;

      // Dodge Mechanic
      if (target.type === EnemyType.FAST && Math.random() < 0.25) {
        const dodgeAngle = Math.random() * Math.PI * 2;
        const dodgeDist = 60;
        target.pos.x += Math.cos(dodgeAngle) * dodgeDist;
        target.pos.y += Math.sin(dodgeAngle) * dodgeDist;
        addParticle(target.pos, 5, COLORS.enemyFast, 'text', '闪避!');
        cameraShakeRef.current = 2;
        soundService.playMiss(); // Dodge sounds like a miss
        return; 
      }

      // Move Player
      soundService.playLaser(); // Shoot/Dash sound
      player.trail.push({ ...player.pos });
      if (player.trail.length > 10) player.trail.shift();
      player.pos = { ...target.pos };

      // Damage Logic
      target.hp -= 1;

      // Check Combo Buff (Pre-calculation for 5-hit streaks)
      // We check logic inside hit/kill blocks, but we need to know if this hit contributes to combo
      // If we don't kill, combo still goes up.
      
      let comboTriggered = false;

      if (target.hp > 0) {
        // HIT (Shield or Elite)
        // soundService.playHit(); // Removed default hit sound to use combo sound
        cameraShakeRef.current = 5;
        addParticle(target.pos, 5, target.color, 'spark');
        
        let hitText = 'HIT';
        if (target.type === EnemyType.SHIELD) hitText = '格挡';
        if (target.type === EnemyType.ELITE) hitText = `HP ${target.hp}`;
        
        addParticle(target.pos, 1, '#fff', 'text', hitText);
        statsRef.current.score += 50;
        statsRef.current.combo++;
        
        // Combo Sound & Visuals
        soundService.playCombo(statsRef.current.combo);

        comboTriggered = true;
        comboTimerRef.current = GAME_CONFIG.comboDecay;
      } else {
        // KILL
        // soundService.playExplosion(); // Removed to prioritize combo sound, or layer them? Let's use combo sound for flow
        soundService.playCombo(statsRef.current.combo);

        statsRef.current.score += 100 * (1 + statsRef.current.combo * 0.1);
        statsRef.current.kills++;
        statsRef.current.combo++;
        
        comboTriggered = true;
        if (statsRef.current.combo > statsRef.current.maxCombo) {
          statsRef.current.maxCombo = statsRef.current.combo;
        }
        comboTimerRef.current = GAME_CONFIG.comboDecay;

        // Apply Entity Bonuses
        if (target.bonus === BonusType.HEAL) {
          soundService.playHeal();
          baseHpRef.current = Math.min(baseHpRef.current + 1, GAME_CONFIG.baseMaxHp);
          setHudBaseHp(baseHpRef.current);
          
          triggerScreenFlash(COLORS.bonusHeal, 0.4);
          addParticle({x:0, y:0}, 20, COLORS.bonusHeal, 'spark');
          addParticle({x:0, y:0}, 1, COLORS.bonusHeal, 'text', 'HP +1', 2.0);
          addParticle({x:0, y:0}, 1, COLORS.bonusHeal, 'shockwave', '', 0.5);

        } else if (target.bonus === BonusType.SLOW) {
          soundService.playSlow();
          slowTimerRef.current = GAME_CONFIG.slowDuration;
          setActiveEffects(prev => [...prev, 'SLOW']);
          
          triggerScreenFlash(COLORS.bonusSlow, 0.4);
          addParticle(target.pos, 1, COLORS.bonusSlow, 'text', '时间减速!', 2.0);
          addParticle(target.pos, 20, COLORS.bonusSlow, 'spark');

        } else if (target.bonus === BonusType.BOMB) {
          soundService.playBombExplosion();
          // AOE Logic
          const bombPos = target.pos;
          triggerScreenFlash(COLORS.bonusBomb, 0.6);
          
          cameraShakeRef.current = 30; // HUGE shake
          addParticle(bombPos, 1, COLORS.bonusBomb, 'shockwave', '', 3.0); // Big shockwave
          addParticle(bombPos, 40, COLORS.bonusBomb, 'spark');
          
          let bombKills = 0;
          for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const other = enemiesRef.current[i];
            if (other.id === target.id) continue;
            
            const dx = other.pos.x - bombPos.x;
            const dy = other.pos.y - bombPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < GAME_CONFIG.bombRadius) {
              other.hp = 0; // Instant kill for simplicity in bomb
              addParticle(other.pos, 10, COLORS.bonusBomb, 'spark');
              bombKills++;
            }
          }
          if (bombKills > 0) {
             addParticle(bombPos, 1, COLORS.bonusBomb, 'text', `连爆 x${bombKills}`, 1.5);
             statsRef.current.kills += bombKills;
             statsRef.current.score += bombKills * 150;
          }
        }

        // Cleanup
        enemiesRef.current.splice(targetIndex, 1);
        
        // Remove dead from AOE just in case
        enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

        // Standard Effects
        if (target.bonus === BonusType.NONE) {
            cameraShakeRef.current = 10;
        }
        addParticle(target.pos, 10, target.color, 'spark');
        addParticle(target.pos, 1, '#fff', 'ring');
      }

      // --- COMBO VISUAL PROMPT (Every 5) ---
      if (comboTriggered && statsRef.current.combo > 0 && statsRef.current.combo % 5 === 0) {
        addParticle(player.pos, 1, '#ffdd00', 'text', `${statsRef.current.combo}连击!`, 2.5); // Large text
        triggerScreenFlash(COLORS.player, 0.2); // Brief flash
      }

      // --- COMBO BUFF SYSTEM ---
      if (comboTriggered && statsRef.current.combo > 0 && statsRef.current.combo % 5 === 0) {
        const buffType = Math.random();
        
        // Only give major buffs occasionally or if base HP is low to balance
        if (buffType > 0.5) {
          // Heal
          if (baseHpRef.current < GAME_CONFIG.baseMaxHp) {
             soundService.playPowerup();
             baseHpRef.current += 1;
             setHudBaseHp(baseHpRef.current);
             addParticle(player.pos, 15, COLORS.bonusHeal, 'spark');
             addParticle(player.pos, 1, COLORS.bonusHeal, 'text', '连击奖励: +1 HP', 1.5);
          } else {
             statsRef.current.score += 500;
             addParticle(player.pos, 1, COLORS.player, 'text', '连击奖励: 500分', 1.2);
          }
        } else {
          // Slow
          soundService.playPowerup(); // Subtle sound for buff
          slowTimerRef.current = Math.max(slowTimerRef.current, 10000); // 10 seconds
          if (!activeEffects.includes('SLOW')) setActiveEffects(prev => [...prev, 'SLOW']);
          addParticle(player.pos, 15, COLORS.bonusSlow, 'spark');
          addParticle(player.pos, 1, COLORS.bonusSlow, 'text', '连击奖励: 减速10s', 1.5);
        }
      }
      
    } else {
      soundService.playMiss();
      statsRef.current.combo = 0;
      statsRef.current.misses++;
      cameraShakeRef.current = 5;
      addParticle(playerRef.current.pos, 1, '#ff0000', 'text', 'MISS');
    }
    
    setHudScore(Math.floor(statsRef.current.score));
    setHudCombo(statsRef.current.combo);

  }, [gameState, activeEffects]);


  // --- Game Loop ---
  const loop = (time: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    const rawDt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;
    
    // Slow Motion Logic
    let dt = rawDt;
    if (slowTimerRef.current > 0) {
      dt = rawDt * GAME_CONFIG.slowFactor;
      slowTimerRef.current -= rawDt * 1000;
      if (slowTimerRef.current <= 0) {
        setActiveEffects(prev => prev.filter(e => e !== 'SLOW'));
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (canvas && ctx && containerRef.current) {
      // 1. Update
      
      if (arenaSizeRef.current > GAME_CONFIG.minArenaSize) {
        arenaSizeRef.current -= GAME_CONFIG.shrinkRate * rawDt; // Arena shrinks at normal time
      }

      // Update Screen Flash
      if (screenFlashRef.current) {
          screenFlashRef.current.life -= rawDt * 2.0; // Flash fades out fast
          if (screenFlashRef.current.life <= 0) {
              screenFlashRef.current = null;
          }
      }

      spawnTimerRef.current -= rawDt * 1000; // Spawn timer runs on real time
      if (spawnTimerRef.current <= 0) {
        spawnEnemy();
        const difficulty = Math.min(statsRef.current.kills / 80, 0.9);
        const nextSpawnTime = GAME_CONFIG.baseSpawnRate * (1 - difficulty);
        spawnTimerRef.current = Math.max(nextSpawnTime, GAME_CONFIG.minSpawnRate);
      }

      // Update Enemies
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const enemy = enemiesRef.current[i];
        
        // Move towards Base (0,0)
        const dx = 0 - enemy.pos.x;
        const dy = 0 - enemy.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > GAME_CONFIG.baseRadius + enemy.radius) {
          const moveX = (dx / dist) * enemy.speed * dt;
          const moveY = (dy / dist) * enemy.speed * dt;
          enemy.pos.x += moveX;
          enemy.pos.y += moveY;
        } else {
          // HIT BASE
          soundService.playBaseAlarm();
          baseHpRef.current -= 1;
          setHudBaseHp(baseHpRef.current);
          cameraShakeRef.current = 20;
          addParticle(enemy.pos, 20, '#ff0000', 'spark');
          addParticle({x:0, y:0}, 1, '#ff0000', 'ring');
          enemiesRef.current.splice(i, 1); // Enemy dies on impact
          
          if (baseHpRef.current <= 0) {
            setGameState(GameState.GAME_OVER);
            onGameOver({ ...statsRef.current, finalBaseHp: 0 });
            return;
          }
        }
      }

      if (statsRef.current.combo > 0) {
        comboTimerRef.current -= rawDt * 1000;
        if (comboTimerRef.current <= 0) {
          statsRef.current.combo = 0;
          setHudCombo(0);
        }
      }

      statsRef.current.timeAlive += rawDt;

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        if (p.type === 'shockwave') {
             p.size += 500 * rawDt; // Expand
             p.life -= 2.0 * rawDt;
        } else {
            p.pos.x += p.vel.x * rawDt;
            p.pos.y += p.vel.y * rawDt;
            p.life -= p.decay * rawDt;
        }
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // 2. Render
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Camera Shake
      let shakeX = 0;
      let shakeY = 0;
      if (cameraShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * cameraShakeRef.current;
        shakeY = (Math.random() - 0.5) * cameraShakeRef.current;
        cameraShakeRef.current *= 0.9;
        if (cameraShakeRef.current < 0.5) cameraShakeRef.current = 0;
      }

      ctx.save();
      ctx.translate(centerX + shakeX, centerY + shakeY);

      // Arena
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      const halfArena = arenaSizeRef.current / 2;
      ctx.beginPath();
      ctx.rect(-halfArena, -halfArena, arenaSizeRef.current, arenaSizeRef.current);
      ctx.clip();

      const gridSize = 50;
      for (let x = -halfArena; x <= halfArena; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, -halfArena); ctx.lineTo(x, halfArena); ctx.stroke();
      }
      for (let y = -halfArena; y <= halfArena; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(-halfArena, y); ctx.lineTo(halfArena, y); ctx.stroke();
      }
      
      // Arena Border
      ctx.strokeStyle = arenaSizeRef.current < 400 ? COLORS.arenaBorderCritical : COLORS.arenaBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(-halfArena, -halfArena, arenaSizeRef.current, arenaSizeRef.current);
      
      ctx.restore(); 
      ctx.save();
      ctx.translate(centerX + shakeX, centerY + shakeY);

      // DRAW BASE
      const baseRadius = GAME_CONFIG.baseRadius;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const bx = Math.cos(angle) * baseRadius;
        const by = Math.sin(angle) * baseRadius;
        if (i === 0) ctx.moveTo(bx, by);
        else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fillStyle = baseHpRef.current <= 2 ? COLORS.baseLow : COLORS.base;
      ctx.shadowBlur = 20;
      ctx.shadowColor = baseHpRef.current <= 2 ? COLORS.baseLow : COLORS.player;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Base Core Pulse
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.4 + Math.sin(time/200)*2, 0, Math.PI*2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Draw Player Trail
      if (playerRef.current.trail.length > 0) {
        ctx.beginPath();
        ctx.moveTo(playerRef.current.trail[0].x, playerRef.current.trail[0].y);
        for (const point of playerRef.current.trail) {
          ctx.lineTo(point.x, point.y);
        }
        ctx.lineTo(playerRef.current.pos.x, playerRef.current.pos.y);
        ctx.strokeStyle = COLORS.particles.trail;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Enemies
      ctx.font = 'bold 20px "Share Tech Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      enemiesRef.current.forEach(enemy => {
        // Body
        ctx.beginPath();
        ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2);
        ctx.fillStyle = enemy.color;
        
        if (enemy.type === EnemyType.ELITE) {
            // Pulsing Glow for Elite
            const glowSize = Math.sin(time / 150) * 10 + 20;
            ctx.shadowBlur = glowSize;
            ctx.shadowColor = enemy.color;
            // Pulsing inner fill
            ctx.globalAlpha = 0.8 + Math.sin(time / 100) * 0.2;
        } else if (enemy.bonus !== BonusType.NONE) {
           ctx.shadowBlur = 15;
           ctx.shadowColor = enemy.color;
        } else {
           ctx.shadowBlur = 5;
           ctx.shadowColor = enemy.color;
        }
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        // Extra Rings
        if (enemy.type === EnemyType.SHIELD || enemy.hp > 1) {
          ctx.beginPath();
          ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = enemy.type === EnemyType.ELITE ? '#ffaa00' : '#ffffff';
          ctx.lineWidth = enemy.type === EnemyType.ELITE ? 4 : 2;
          ctx.stroke();
        }
        
        // Elite Extra Ring
        if (enemy.type === EnemyType.ELITE) {
            ctx.beginPath();
            ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius + 12, 0 + (time/500), Math.PI + (time/500));
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Letter
        ctx.save();
        if (enemy.type === EnemyType.ROTATING) {
            ctx.translate(enemy.pos.x, enemy.pos.y);
            ctx.rotate(time / 200); // Rotate based on time
            ctx.translate(-enemy.pos.x, -enemy.pos.y);
        }

        ctx.fillStyle = '#000';
        if (enemy.type === EnemyType.ELITE) {
            ctx.font = 'bold 24px "Share Tech Mono"';
        } else {
            ctx.font = 'bold 20px "Share Tech Mono"';
        }
        ctx.fillText(enemy.char, enemy.pos.x, enemy.pos.y + 2);
        
        ctx.restore();
        
        // Bonus Icon Indicator (Small dot or symbol)
        if (enemy.bonus === BonusType.HEAL) {
          ctx.fillStyle = '#fff';
          ctx.font = '10px Arial';
          ctx.fillText('+', enemy.pos.x + 12, enemy.pos.y - 12);
        } else if (enemy.bonus === BonusType.BOMB) {
           ctx.fillStyle = '#fff';
           ctx.font = '10px Arial';
           ctx.fillText('!', enemy.pos.x + 12, enemy.pos.y - 12);
        }
      });

      // Draw Player
      ctx.beginPath();
      ctx.arc(playerRef.current.pos.x, playerRef.current.pos.y, playerRef.current.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.player;
      ctx.shadowBlur = 15;
      ctx.shadowColor = COLORS.player;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Particles
      particlesRef.current.forEach(p => {
        if (p.type === 'shockwave') {
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 170, 0, ${p.life})`;
          ctx.lineWidth = 4;
          ctx.stroke();
        } else if (p.type === 'text') {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
          ctx.font = 'bold 16px "sans-serif"';
          ctx.fillText(p.text || '', p.pos.x, p.pos.y);
        } else if (p.type === 'ring') {
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, (1 - p.life) * 30 + 15, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.life})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });

      ctx.restore();

      // --- Post-Processing Layer (Full Screen Effects) ---
      // 1. Screen Flash (Bomb/Heal)
      if (screenFlashRef.current) {
         ctx.fillStyle = screenFlashRef.current.color;
         ctx.globalAlpha = screenFlashRef.current.life * 0.4;
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.globalAlpha = 1.0;
      }

      // 2. Slow Motion Vignette
      if (slowTimerRef.current > 0) {
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
          canvas.width / 2, canvas.height / 2, canvas.height * 0.8
        );
        gradient.addColorStop(0, "rgba(0, 204, 255, 0)");
        gradient.addColorStop(1, "rgba(0, 204, 255, 0.2)");
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Border Pulse
        const pulse = (Math.sin(time / 200) + 1) * 0.5;
        ctx.strokeStyle = `rgba(0, 204, 255, ${0.3 + pulse * 0.2})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
      }

      requestIdRef.current = requestAnimationFrame(loop);
    }
  };

  // --- 1. Game Initialization & Loop (Runs ONLY when entering PLAYING state) ---
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      soundService.startBGM(); // Start music
      playerRef.current = {
        id: 'p1', pos: { x: 0, y: 0 }, radius: 10, color: COLORS.player, trail: [], energy: 100, isAlive: true
      };
      enemiesRef.current = [];
      particlesRef.current = [];
      statsRef.current = {
        score: 0, highScore: 0, combo: 0, maxCombo: 0, kills: 0, accuracy: 1, misses: 0, timeAlive: 0
      };
      baseHpRef.current = GAME_CONFIG.baseMaxHp;
      arenaSizeRef.current = GAME_CONFIG.initialArenaSize;
      spawnTimerRef.current = 0;
      slowTimerRef.current = 0;
      screenFlashRef.current = null;
      
      setHudScore(0);
      setHudCombo(0);
      setHudBaseHp(GAME_CONFIG.baseMaxHp);
      lastTimeRef.current = performance.now();
      
      // Update Network Status to Playing
      p2pService.updateGameStatus('PLAYING', 0, 0);

      // Start periodic broadcast
      broadcastIntervalRef.current = window.setInterval(() => {
        p2pService.updateGameStatus('PLAYING', statsRef.current.score, statsRef.current.timeAlive);
      }, 1000); // 1Hz update

      // Start loop
      requestIdRef.current = requestAnimationFrame(loop);
    }

    return () => {
      // Stop loop
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
      if (broadcastIntervalRef.current) clearInterval(broadcastIntervalRef.current);
    };
  }, [gameState]); // Dependencies: ONLY gameState

  // --- 2. Event Listener Binding (Re-binds when handleKeyDown updates, but DOES NOT reset game) ---
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, handleKeyDown]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* HUD Layer */}
      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Bar */}
          <div className="flex justify-between items-start p-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <span className="text-gray-400 text-sm font-display tracking-widest">分数</span>
                <span className="text-4xl text-white font-mono font-bold">{hudScore.toLocaleString()}</span>
              </div>
              {/* Base HP Display */}
               <div className="flex items-center gap-1">
                 {Array.from({ length: GAME_CONFIG.baseMaxHp }).map((_, i) => (
                   <Heart 
                     key={i} 
                     size={24} 
                     className={`${i < hudBaseHp ? 'text-red-500 fill-red-500' : 'text-gray-800 fill-gray-900'} transition-all`}
                   />
                 ))}
               </div>
            </div>
            
            <div className={`flex flex-col items-center transition-transform ${hudCombo > 5 ? 'scale-110' : 'scale-100'}`}>
              <div className="relative">
                <span className={`text-6xl font-black font-display italic ${hudCombo > 10 ? 'text-yellow-400' : 'text-cyan-400'}`}>
                  {hudCombo}x
                </span>
                {hudCombo > 10 && (
                   <span className="absolute -bottom-4 left-0 w-full text-center text-xs text-red-500 font-bold tracking-[0.3em] animate-pulse">
                     暴走
                   </span>
                )}
              </div>
              
              {/* Active Effects Indicator */}
              {slowTimerRef.current > 0 && (
                <div className="mt-4 flex items-center gap-2 text-cyan-300 animate-pulse bg-cyan-900/40 px-3 py-1 rounded-full">
                  <Snowflake size={16} /> <span className="text-xs font-bold tracking-widest">时缓中</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end">
              <span className="text-gray-400 text-sm font-display tracking-widest">生存时间</span>
              <span className="text-xl text-white font-mono">{statsRef.current.timeAlive.toFixed(1)}s</span>
            </div>
          </div>

          {/* Combo Bar */}
          {hudCombo > 0 && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-cyan-400 transition-all duration-100 ease-linear"
                 style={{ width: `${(comboTimerRef.current / GAME_CONFIG.comboDecay) * 100}%` }}
               />
            </div>
          )}

          {/* Legend for new mechanics */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-2 items-end opacity-50 text-xs font-mono">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#00ff55]"></span> 修复基地</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#00ccff]"></span> 减速领域</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ffaa00]"></span> 连锁爆炸</div>
          </div>

          <div className="absolute bottom-8 left-0 w-full text-center opacity-30">
            <p className="text-sm font-mono tracking-widest">守护核心 - 击退来犯者</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameEngine;