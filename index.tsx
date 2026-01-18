import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Play, Globe, Users, FileText, ChevronUp, RefreshCw, Trophy, Target, Clock, Activity, Zap, Terminal, ChevronRight, Shield, Heart, Snowflake, Bomb } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { joinRoom } from 'trystero/torrent';

// --- TYPES ---
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
  vel: Vector2;
  life: number; // 0-1
  decay: number;
  color: string;
  size: number;
  type: 'spark' | 'text' | 'ring' | 'shockwave';
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
}

// --- CONSTANTS ---
const COLORS = {
  background: '#050505',
  player: '#00ffff', // 青色
  base: '#ffffff', // 基地核心颜色
  baseLow: '#ff0000', // 基地低血量颜色
  enemyNormal: '#ff0055', // 玫红 (普通)
  enemyFast: '#ffff00', // 黄色 (闪避/高速)
  enemyShield: '#888888', // 灰色/银色 (护盾)
  
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

const GAME_CONFIG = {
  initialArenaSize: 900,
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

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// --- SERVICES ---

// P2P Service
const ROOM_ID = 'alpha_strike_lobby_v1';

class P2PService {
  private room: any;
  private sendStatus: any;
  private onStatus: any;
  private peers: Map<string, PeerData> = new Map();
  private selfData: PeerData = { id: '', name: 'Unknown', totalScore: 0, lastSeen: Date.now() };
  private listeners: ((peers: PeerData[]) => void)[] = [];

  constructor() {
    // Singleton initialization
  }

  public init(name: string, initialTotalScore: number) {
    if (this.room) return; // Already initialized

    try {
      const config = { appId: 'alpha-strike-game' };
      this.room = joinRoom(config, ROOM_ID);
      
      // Actions
      const [sendStatus, onStatus] = this.room.makeAction('status');
      this.sendStatus = sendStatus;
      this.onStatus = onStatus;

      // Self ID 
      this.selfData.id = this.room.selfId;
      this.selfData.name = name;
      this.selfData.totalScore = initialTotalScore;

      // Handle incoming status
      this.onStatus((data: Partial<PeerData>, peerId: string) => {
        this.peers.set(peerId, {
          id: peerId,
          name: data.name || 'Unknown',
          totalScore: data.totalScore || 0,
          lastSeen: Date.now()
        });
        this.notifyListeners();
      });

      // Handle peer leaving
      this.room.onPeerLeave((peerId: string) => {
        this.peers.delete(peerId);
        this.notifyListeners();
      });

      // Handle peer joining
      this.room.onPeerJoin((peerId: string) => {
        // Send them our status immediately
        this.broadcastStatus();
      });

      // Periodic broadcast (heartbeat)
      setInterval(() => {
          this.broadcastStatus();
          this.prunePeers();
      }, 5000);

      console.log('Network Service Initialized for:', name);
    } catch (e) {
      console.error("Network Init Error:", e);
    }
  }

  public updateTotalScore(newTotal: number) {
    this.selfData.totalScore = newTotal;
    this.broadcastStatus();
  }

  private broadcastStatus() {
    if (this.sendStatus) {
      this.sendStatus({
        name: this.selfData.name,
        totalScore: this.selfData.totalScore
      });
    }
  }

  private prunePeers() {
    const now = Date.now();
    let changed = false;
    this.peers.forEach((peer, id) => {
      if (now - peer.lastSeen > 15000) { // 15s timeout
        this.peers.delete(id);
        changed = true;
      }
    });
    if (changed) this.notifyListeners();
  }

  public subscribe(callback: (peers: PeerData[]) => void) {
    this.listeners.push(callback);
    callback(this.getPeers()); // Initial call
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    const list = this.getPeers();
    this.listeners.forEach(l => l(list));
  }

  public getPeers(): PeerData[] {
    return Array.from(this.peers.values()).sort((a, b) => b.totalScore - a.totalScore);
  }

  public getSelf(): PeerData {
      return this.selfData;
  }
}

const p2pService = new P2PService();

// Gemini Service
const getSystemInstruction = () => `
你是一个名为“阿尔法”的赛博朋克战斗模拟系统的AI指挥官。
你的任务是分析“猎人”（玩家）的战斗数据，并生成一份简短、风格化、略带中二或严厉的中文战报。

语气：赛博朋克风格、冷酷、战术化、如果分数低可以嘲讽，分数高则表示认可。
长度：最多2-3句话。
格式：纯文本。
语言：简体中文。

提供的指标：
- 分数 (Score)：总得分。
- 最大连击 (Max Combo)：最高连杀数。
- 击杀 (Kills)：消灭敌人数量。
- 生存时间 (Time Alive)：存活秒数。
`;

const generateBattleReport = async (stats: GameStats): Promise<string> => {
  // Safe check for process.env
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : null;

  if (!apiKey) {
    return "指挥官连接离线：缺少 API 密钥。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const prompt = `
      分析本次战斗数据:
      得分: ${stats.score}
      最大连击: ${stats.maxCombo}
      击杀数: ${stats.kills}
      生存时间: ${stats.timeAlive.toFixed(1)}秒
      
      请给出战术评估。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(),
        temperature: 0.8,
        maxOutputTokens: 100,
      },
    });

    return response.text || "数据分析失败。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "指挥官连接不稳定，无法生成战报。";
  }
};

// --- COMPONENTS ---

// 1. NameInput
interface NameInputProps {
  onConfirm: (name: string) => void;
}

const NameInput: React.FC<NameInputProps> = ({ onConfirm }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length > 0) {
      onConfirm(name.trim().substring(0, 12)); // Limit length
    }
  };

  return (
    <div className="relative z-50 flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-mono">
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,255,0.1)_0%,transparent_70%)]" />
       
       <div className="max-w-md w-full bg-black/80 border border-cyan-800 p-8 shadow-[0_0_30px_rgba(0,255,255,0.2)] backdrop-blur-md">
         <div className="flex items-center gap-2 mb-6 text-cyan-400">
            <Terminal size={24} />
            <h2 className="text-xl font-bold font-display tracking-widest">身份登记</h2>
         </div>
         
         <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="block text-gray-500 text-xs mb-2 tracking-widest uppercase">输入代号 Agent Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border-b-2 border-gray-700 focus:border-cyan-400 outline-none py-2 text-2xl font-bold text-white placeholder-gray-800 transition-colors uppercase"
                placeholder="UNKNOWN"
                autoFocus
                maxLength={12}
              />
            </div>
            
            <button 
              type="submit"
              disabled={!name.trim()}
              className="group flex items-center justify-between px-6 py-4 bg-cyan-900/30 border border-cyan-700 hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-bold tracking-widest">确认接入</span>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
         </form>

         <div className="mt-8 text-[10px] text-gray-600 leading-relaxed">
           * 此代号将用于全球防御网络的识别。<br/>
           * 系统不保存任何个人数据。
         </div>
       </div>
    </div>
  );
};

// 2. MainMenu
interface MainMenuProps {
  onStart: () => void;
  lastRunScore?: number;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, lastRunScore = 0 }) => {
  const [updateLog, setUpdateLog] = useState<string>('读取服务器日志...');
  const [onlinePeers, setOnlinePeers] = useState<PeerData[]>([]);
  const [selfData, setSelfData] = useState<PeerData | null>(null);
  
  // Animation State
  const [displayScore, setDisplayScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Load Update Log
    fetch('./update.txt')
      .then(res => res.text())
      .then(text => setUpdateLog(text))
      .catch(() => setUpdateLog("无法连接到更新服务器。"));

    // Subscribe to Network Peers
    const unsubscribe = p2pService.subscribe((peers) => {
      setOnlinePeers(peers);
    });
    
    // Initial Self Data
    const currentSelf = p2pService.getSelf();
    setSelfData(currentSelf);

    // Animation Logic
    if (lastRunScore > 0 && currentSelf) {
      const finalScore = currentSelf.totalScore;
      const startScore = finalScore - lastRunScore;
      setDisplayScore(startScore);
      setIsAnimating(true);

      const duration = 2000; // 2 seconds
      const startTime = performance.now();

      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out quart
        const ease = 1 - Math.pow(1 - progress, 4);
        
        const current = Math.floor(startScore + (lastRunScore * ease));
        setDisplayScore(current);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          setDisplayScore(finalScore);
        }
      };
      
      requestAnimationFrame(animate);
    } else {
      setDisplayScore(currentSelf?.totalScore || 0);
    }

    return () => unsubscribe();
  }, [lastRunScore]);

  return (
    <div className="relative z-10 flex flex-col md:flex-row h-screen bg-black/90 text-white overflow-hidden">
      
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      {/* Left Panel: Game Title & Actions */}
      <div className="w-full md:w-2/3 p-8 md:p-12 flex flex-col justify-center relative z-10">
        <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 w-fit rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            全球网络已连接
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black font-display tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-800">
            字母<br/><span className="text-cyan-400">守护者</span>
          </h1>
          
          <p className="text-gray-400 font-mono mb-12 tracking-widest text-sm">
            // 塔防式战术打字 //
          </p>

          <button 
            onClick={onStart}
            disabled={isAnimating}
            className={`w-full md:w-auto group relative px-12 py-4 text-black font-bold text-xl font-display uppercase tracking-widest transition-all clip-path-polygon hover:scale-105 active:scale-95 mb-8 ${isAnimating ? 'bg-gray-600 cursor-wait' : 'bg-cyan-600 hover:bg-cyan-500'}`}
            style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
          >
            <span className="flex items-center justify-center gap-3">
              <Play className="w-5 h-5 fill-current" />
              {isAnimating ? '积分结算中...' : '启动防御协议'}
            </span>
          </button>

          {/* Update Log Panel */}
          <div className="mt-auto border-t border-gray-800 pt-6">
            <div className="flex items-center gap-2 text-gray-500 mb-2 font-mono text-xs">
              <FileText size={14} />
              系统更新日志
            </div>
            <div className="font-mono text-sm text-gray-300 leading-relaxed opacity-80 max-w-xl">
              {updateLog}
            </div>
          </div>
      </div>

      {/* Right Panel: Network Status & Leaderboard */}
      <div className="w-full md:w-1/3 border-l border-gray-800 bg-black/40 backdrop-blur-sm p-6 flex flex-col relative z-10">
         <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
           <div className="flex items-center gap-2 text-cyan-400">
             <Globe size={18} />
             <span className="font-display font-bold tracking-widest">在线特工</span>
           </div>
           <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
             <Users size={14} />
             <span>{onlinePeers.length + 1} 在线</span>
           </div>
         </div>

         {/* Self Status with Animation */}
         <div className="mb-6 p-4 bg-cyan-900/20 border border-cyan-800/50 rounded transition-all duration-300">
            <div className="flex justify-between items-center mb-2">
               <div className="text-[10px] text-cyan-500 uppercase tracking-widest">本机连接</div>
               {isAnimating && (
                 <div className="flex items-center text-yellow-400 text-xs font-bold animate-pulse">
                   <ChevronUp size={12} /> +{lastRunScore}
                 </div>
               )}
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xl font-bold text-white">{selfData?.name || 'Unknown'}</span>
              <div className="flex flex-col items-end">
                 <span className="text-[10px] text-gray-400 tracking-wider">总贡献分</span>
                 <span className={`font-mono text-xl ${isAnimating ? 'text-yellow-400 scale-110' : 'text-cyan-400'} transition-all duration-100`}>
                   {displayScore.toLocaleString()}
                 </span>
              </div>
            </div>
         </div>

         {/* Leaderboard List */}
         <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
           <div className="space-y-2">
             {onlinePeers.length === 0 ? (
               <div className="text-gray-600 text-sm font-mono text-center py-10">
                 正在扫描附近信号...<br/>(暂无其他玩家在线)
               </div>
             ) : (
               onlinePeers.map((peer, idx) => (
                 <div key={peer.id} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded transition-colors border border-transparent hover:border-white/20 group">
                   <div className="flex items-center gap-3">
                     <span className={`font-mono font-bold w-6 text-center ${idx < 3 ? 'text-yellow-400' : 'text-gray-600'}`}>
                       #{idx + 1}
                     </span>
                     <span className="text-sm font-bold text-gray-300 group-hover:text-white">{peer.name}</span>
                   </div>
                   <span className="font-mono text-cyan-400 text-sm">{peer.totalScore.toLocaleString()}</span>
                 </div>
               ))
             )}
           </div>
         </div>
      </div>

    </div>
  );
};

// 3. GameOver
interface GameOverProps {
  stats: GameStats;
  onRestart: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ stats, onRestart }) => {
  const [report, setReport] = useState<string>('正在分析战斗数据...');
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const fetchReport = async () => {
      // Small delay for dramatic effect
      await new Promise(r => setTimeout(r, 1000));
      const text = await generateBattleReport(stats);
      if (mounted) {
        setReport(text);
        setIsAnalyzing(false);
      }
    };

    fetchReport();

    return () => { mounted = false; };
  }, [stats]);

  return (
    <div className="relative z-20 flex flex-col items-center justify-center min-h-screen bg-black/95 text-white p-4">
      <div className="w-full max-w-md border-t-4 border-red-600 bg-[#0a0a0a] p-8 shadow-2xl shadow-red-900/20">
        
        <div className="text-center mb-8">
          <h2 className="text-5xl font-black font-display text-red-600 tracking-tighter animate-pulse mb-2">
            连接中断
          </h2>
          <p className="text-gray-500 font-mono text-sm">任务失败</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 p-4 rounded border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs uppercase tracking-wider">
              <Trophy size={14} /> 分数
            </div>
            <div className="text-2xl font-bold font-mono text-white">{stats.score.toLocaleString()}</div>
          </div>

          <div className="bg-white/5 p-4 rounded border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs uppercase tracking-wider">
              <Zap size={14} /> 最大连击
            </div>
            <div className="text-2xl font-bold font-mono text-yellow-400">{stats.maxCombo}x</div>
          </div>

          <div className="bg-white/5 p-4 rounded border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs uppercase tracking-wider">
              <Target size={14} /> 击杀数
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-400">{stats.kills}</div>
          </div>

          <div className="bg-white/5 p-4 rounded border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 mb-1 text-xs uppercase tracking-wider">
              <Clock size={14} /> 存活时间
            </div>
            <div className="text-2xl font-bold font-mono text-white">{stats.timeAlive.toFixed(1)}s</div>
          </div>
        </div>

        {/* Gemini Analysis */}
        <div className="mb-8 p-4 border border-cyan-500/30 bg-cyan-900/10 rounded relative overflow-hidden">
          <div className="absolute top-0 left-0 px-2 py-1 bg-cyan-900/50 text-[10px] text-cyan-300 font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity size={10} className={isAnalyzing ? "animate-spin" : ""} />
            指挥官战报
          </div>
          <p className={`mt-6 font-mono text-sm leading-relaxed ${isAnalyzing ? 'text-gray-400 animate-pulse' : 'text-cyan-100'}`}>
            {report}
          </p>
        </div>

        <button 
          onClick={onRestart}
          className="w-full py-4 bg-white text-black font-bold font-display uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} />
          重启系统
        </button>
      </div>
    </div>
  );
};

// 4. GameEngine
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
  const requestIdRef = useRef<number>();
  
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

  // Helper: Spawn Enemy
  const spawnEnemy = () => {
    const side = Math.floor(Math.random() * 4);
    const size = arenaSizeRef.current;
    const offset = 50;
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

    const difficulty = Math.min(statsRef.current.kills / 100, 1.0);
    const rand = Math.random();
    
    let type = EnemyType.NORMAL;
    let color = COLORS.enemyNormal;
    let hp = 1;
    let bonus = BonusType.NONE;

    // Enemy Type Logic
    if (rand < 0.15 + (difficulty * 0.2)) {
      type = EnemyType.SHIELD;
      color = COLORS.enemyShield;
      hp = 2; 
    } else if (rand < 0.3 + (difficulty * 0.3)) {
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
    const baseSpeed = type === EnemyType.FAST 
      ? GAME_CONFIG.enemySpeedBase * 1.5 
      : GAME_CONFIG.enemySpeedBase;
    const finalSpeed = Math.min(baseSpeed * speedMultiplier, GAME_CONFIG.enemySpeedMax);

    enemiesRef.current.push({
      id: Math.random().toString(),
      pos: { x, y },
      radius: 18, // Slightly larger targets
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
        return; 
      }

      // Move Player
      player.trail.push({ ...player.pos });
      if (player.trail.length > 10) player.trail.shift();
      player.pos = { ...target.pos };

      // Damage Logic
      target.hp -= 1;

      if (target.hp > 0) {
        // Shield Hit
        cameraShakeRef.current = 5;
        addParticle(target.pos, 5, target.color, 'spark');
        addParticle(target.pos, 1, '#fff', 'text', '格挡');
        statsRef.current.score += 50;
        statsRef.current.combo++;
        comboTimerRef.current = GAME_CONFIG.comboDecay;
      } else {
        // Kill Logic
        statsRef.current.score += 100 * (1 + statsRef.current.combo * 0.1);
        statsRef.current.kills++;
        statsRef.current.combo++;
        if (statsRef.current.combo > statsRef.current.maxCombo) {
          statsRef.current.maxCombo = statsRef.current.combo;
        }
        comboTimerRef.current = GAME_CONFIG.comboDecay;

        // Apply Bonuses
        if (target.bonus === BonusType.HEAL) {
          baseHpRef.current = Math.min(baseHpRef.current + 1, GAME_CONFIG.baseMaxHp);
          setHudBaseHp(baseHpRef.current);
          addParticle({x:0, y:0}, 10, COLORS.bonusHeal, 'spark');
          addParticle({x:0, y:0}, 1, COLORS.bonusHeal, 'text', '基地修复!', 1.5);
        } else if (target.bonus === BonusType.SLOW) {
          slowTimerRef.current = GAME_CONFIG.slowDuration;
          setActiveEffects(prev => [...prev, 'SLOW']);
          addParticle(target.pos, 1, COLORS.bonusSlow, 'text', '全域减速!');
        } else if (target.bonus === BonusType.BOMB) {
          // AOE Logic
          const bombPos = target.pos;
          addParticle(bombPos, 1, COLORS.bonusBomb, 'shockwave');
          addParticle(bombPos, 15, COLORS.bonusBomb, 'spark');
          
          let bombKills = 0;
          for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const other = enemiesRef.current[i];
            if (other.id === target.id) continue;
            
            const dx = other.pos.x - bombPos.x;
            const dy = other.pos.y - bombPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < GAME_CONFIG.bombRadius) {
              other.hp = 0; // Instant kill for simplicity in bomb
              addParticle(other.pos, 5, COLORS.bonusBomb, 'spark');
              bombKills++;
            }
          }
          if (bombKills > 0) {
             addParticle(bombPos, 1, COLORS.bonusBomb, 'text', `连爆 x${bombKills}`);
             statsRef.current.kills += bombKills;
             statsRef.current.score += bombKills * 150;
          }
        }

        // Cleanup
        enemiesRef.current.splice(targetIndex, 1);
        
        // Remove dead from AOE just in case
        enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

        // Standard Effects
        cameraShakeRef.current = 10;
        addParticle(target.pos, 10, target.color, 'spark');
        addParticle(target.pos, 1, '#fff', 'ring');
      }
      
    } else {
      statsRef.current.combo = 0;
      statsRef.current.misses++;
      cameraShakeRef.current = 5;
      addParticle(playerRef.current.pos, 1, '#ff0000', 'text', 'MISS');
    }
    
    setHudScore(Math.floor(statsRef.current.score));
    setHudCombo(statsRef.current.combo);

  }, [gameState]);


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
        
        if (enemy.bonus !== BonusType.NONE) {
           ctx.shadowBlur = 15;
           ctx.shadowColor = enemy.color;
        } else {
           ctx.shadowBlur = 5;
           ctx.shadowColor = enemy.color;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shield Ring
        if (enemy.hp > 1) {
          ctx.beginPath();
          ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Letter
        ctx.fillStyle = '#000';
        ctx.fillText(enemy.char, enemy.pos.x, enemy.pos.y + 2);
        
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

      requestIdRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
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
      
      setHudScore(0);
      setHudCombo(0);
      setHudBaseHp(GAME_CONFIG.baseMaxHp);
      lastTimeRef.current = performance.now();
      
      window.addEventListener('keydown', handleKeyDown);
      requestIdRef.current = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
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

// 5. Main App
const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INIT);
  const [lastStats, setLastStats] = useState<GameStats>({
    score: 0, highScore: 0, combo: 0, maxCombo: 0, kills: 0, accuracy: 0, misses: 0, timeAlive: 0
  });
  
  // Track the score obtained in the most recent run to animate it in the menu
  const [lastRunScore, setLastRunScore] = useState(0);

  useEffect(() => {
    // Check for existing name
    const savedName = localStorage.getItem('alpha_strike_agent_name');
    
    // Initialize total score
    const savedTotalScore = parseInt(localStorage.getItem('alpha_strike_total_score') || '0', 10);
    
    if (savedName) {
      p2pService.init(savedName, savedTotalScore);
      setGameState(GameState.MENU);
    }
  }, []);

  const handleNameConfirm = (name: string) => {
    localStorage.setItem('alpha_strike_agent_name', name);
    // New user starts with 0
    localStorage.setItem('alpha_strike_total_score', '0');
    p2pService.init(name, 0);
    setGameState(GameState.MENU);
  };

  const handleStart = () => {
    setLastRunScore(0); // Reset for the new run
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (stats: GameStats) => {
    setLastStats(stats);
    
    // Accumulate Score
    const currentTotal = parseInt(localStorage.getItem('alpha_strike_total_score') || '0', 10);
    const newTotal = currentTotal + stats.score;
    
    // Save locally
    localStorage.setItem('alpha_strike_total_score', newTotal.toString());
    
    // Update Network
    p2pService.updateTotalScore(newTotal);
    
    // Set for animation reference
    setLastRunScore(stats.score);
    
    setGameState(GameState.GAME_OVER);
  };

  const handleRestart = () => {
    // Go back to Menu instead of direct replay to show score animation
    setGameState(GameState.MENU);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      
      {gameState === GameState.INIT && (
        <NameInput onConfirm={handleNameConfirm} />
      )}

      {gameState === GameState.MENU && (
        <MainMenu onStart={handleStart} lastRunScore={lastRunScore} />
      )}

      {/* GameEngine handles its own internal state loop, we just mount/unmount or show/hide */}
      {gameState === GameState.PLAYING && (
        <GameEngine 
          gameState={gameState} 
          setGameState={setGameState}
          onGameOver={handleGameOver}
        />
      )}

      {gameState === GameState.GAME_OVER && (
        <GameOver stats={lastStats} onRestart={handleRestart} />
      )}
    </div>
  );
};

// --- ROOT RENDER ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);