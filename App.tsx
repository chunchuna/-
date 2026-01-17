import React, { useState } from 'react';
import { GameState, GameStats } from './types';
import GameEngine from './components/GameEngine';
import MainMenu from './components/MainMenu';
import GameOver from './components/GameOver';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [lastStats, setLastStats] = useState<GameStats>({
    score: 0, highScore: 0, combo: 0, maxCombo: 0, kills: 0, accuracy: 0, misses: 0, timeAlive: 0
  });

  const handleStart = () => {
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (stats: GameStats) => {
    setLastStats(stats);
    // Slight delay to allow the death animation/frame to register visually if needed
    // But since GameEngine handles the loop stopping, we can swap immediately or after a short timer
    setGameState(GameState.GAME_OVER);
  };

  const handleRestart = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden font-mono text-white select-none">
      {/* Background layer could go here if global */}
      
      {gameState === GameState.MENU && (
        <MainMenu onStart={handleStart} />
      )}

      {/* GameEngine is always mounted to maintain canvas context if needed, 
          but usually we want to unmount/remount to reset or handle via props. 
          Here, we let it render but hide it or handle state internally.
          Actually, conditionally rendering ensures clean cleanup. */}
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