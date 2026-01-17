import React from 'react';
import { Play, Keyboard, Shield } from 'lucide-react';

interface MainMenuProps {
  onStart: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen bg-black/90 text-white p-4">
      <div className="max-w-2xl w-full border border-cyan-900 bg-black/50 p-12 backdrop-blur-sm relative overflow-hidden group">
        
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            核心系统上线
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black font-display tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-800">
            字母<br/><span className="text-cyan-400">守护者</span>
          </h1>
          
          <p className="text-gray-400 font-mono mb-12 tracking-widest text-sm">
            // 塔防式战术打字 //
          </p>

          <button 
            onClick={onStart}
            className="group relative px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xl font-display uppercase tracking-widest transition-all clip-path-polygon hover:scale-105 active:scale-95"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
          >
            <span className="flex items-center gap-3">
              <Play className="w-5 h-5 fill-current" />
              启动防御协议
            </span>
          </button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 text-left w-full">
            <div className="p-4 border border-white/10 bg-white/5 rounded">
              <div className="flex items-center gap-3 mb-2 text-cyan-400">
                <Shield size={20} />
                <h3 className="font-bold font-display">守护</h3>
              </div>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                保护中央核心基地。任何敌人的触碰都会造成损伤。
              </p>
            </div>
            
            <div className="p-4 border border-white/10 bg-white/5 rounded">
              <div className="flex items-center gap-3 mb-2 text-magenta-500 text-[#ff0055]">
                <Keyboard size={20} />
                <h3 className="font-bold font-display">拦截</h3>
              </div>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                输入字母进行拦截。优先击杀靠近核心的敌人。
              </p>
            </div>

            <div className="p-4 border border-white/10 bg-white/5 rounded">
              <div className="flex items-center gap-3 mb-2 text-yellow-400">
                <Play size={20} className="rotate-90" />
                <h3 className="font-bold font-display">道具</h3>
              </div>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                利用特殊字母：回复血量、全屏减速或连锁爆炸。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;