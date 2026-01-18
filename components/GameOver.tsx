import React, { useEffect, useState } from 'react';
import { GameStats } from '../types';
import { RefreshCw, Trophy, Target, Clock, Activity, Zap } from 'lucide-react';
import { generateBattleReport } from '../services/geminiService';
import { soundService } from '../services/soundService';

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
          onMouseEnter={() => soundService.playUIHover()}
          className="w-full py-4 bg-white text-black font-bold font-display uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} />
          重启系统
        </button>
      </div>
    </div>
  );
};

export default GameOver;