import React, { useEffect, useState, useRef } from 'react';
import { Play, Globe, Users, FileText, ChevronUp } from 'lucide-react';
import { PeerData } from '../types.ts';
import { p2pService } from '../services/p2pService.ts';

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

export default MainMenu;