import React, { useState } from 'react';
import { Terminal, ChevronRight } from 'lucide-react';

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
           * 此代号将用于全球防御网络 (P2P) 的识别。<br/>
           * 系统不保存任何个人数据。
         </div>
       </div>
    </div>
  );
};

export default NameInput;