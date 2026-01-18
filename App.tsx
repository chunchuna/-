import React, { useState, useEffect } from 'react';
import { GameState, GameStats } from './types';
import GameEngine from './components/GameEngine';
import MainMenu from './components/MainMenu';
import GameOver from './components/GameOver';
import NameInput from './components/NameInput';
import { p2pService } from './services/p2pService';
import { soundService } from './services/soundService';
import { Volume2, VolumeX } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INIT);
  const [lastStats, setLastStats] = useState<GameStats>({
    score: 0, highScore: 0, combo: 0, maxCombo: 0, kills: 0, accuracy: 0, misses: 0, timeAlive: 0
  });
  const [isMuted, setIsMuted] = useState(soundService.getMuted());
  
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

    // Try to init sound context early
    const initSound = () => soundService.init();
    window.addEventListener('click', initSound, { once: true });
    window.addEventListener('keydown', initSound, { once: true });

    return () => {
      window.removeEventListener('click', initSound);
      window.removeEventListener('keydown', initSound);
    };
  }, []);

  const toggleSound = () => {
    soundService.init(); // Ensure initialized
    const muted = soundService.toggleMute();
    setIsMuted(muted);
    soundService.playUIConfirm();
  };

  const handleNameConfirm = (name: string) => {
    soundService.playUIConfirm();
    localStorage.setItem('alpha_strike_agent_name', name);
    // New user starts with 0
    localStorage.setItem('alpha_strike_total_score', '0');
    p2pService.init(name, 0);
    setGameState(GameState.MENU);
  };

  const handleStart = () => {
    soundService.playUIConfirm();
    setLastRunScore(0); // Reset for the new run
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (stats: GameStats) => {
    soundService.stopBGM(); // Stop music on game over
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
    soundService.playUIConfirm();
    // Go back to Menu instead of direct replay to show score animation
    setGameState(GameState.MENU);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      
      {/* Sound Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={toggleSound}
          className="p-2 bg-gray-800/50 hover:bg-cyan-900/50 rounded-full border border-gray-700 transition-colors"
        >
          {isMuted ? <VolumeX size={20} className="text-gray-400" /> : <Volume2 size={20} className="text-cyan-400" />}
        </button>
      </div>

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

export default App;