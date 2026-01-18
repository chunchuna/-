import React, { useState, useEffect } from 'react';
import { GameState, GameStats } from './types';
import GameEngine from './components/GameEngine';
import MainMenu from './components/MainMenu';
import GameOver from './components/GameOver';
import NameInput from './components/NameInput';
import { p2pService } from './services/p2pService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INIT);
  const [lastStats, setLastStats] = useState<GameStats>({
    score: 0, highScore: 0, combo: 0, maxCombo: 0, kills: 0, accuracy: 0, misses: 0, timeAlive: 0
  });

  useEffect(() => {
    // Check for existing name
    const savedName = localStorage.getItem('alpha_strike_agent_name');
    if (savedName) {
      p2pService.init(savedName);
      setGameState(GameState.MENU);
    }
  }, []);

  const handleNameConfirm = (name: string) => {
    localStorage.setItem('alpha_strike_agent_name', name);
    p2pService.init(name);
    setGameState(GameState.MENU);
  };

  const handleStart = () => {
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (stats: GameStats) => {
    setLastStats(stats);
    // Send score to P2P network
    p2pService.updateScore(stats.score);
    setGameState(GameState.GAME_OVER);
  };

  const handleRestart = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      
      {gameState === GameState.INIT && (
        <NameInput onConfirm={handleNameConfirm} />
      )}

      {gameState === GameState.MENU && (
        <MainMenu onStart={handleStart} />
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