import React, { useState, useRef } from 'react';
import { DiceOutcome, GameState } from './types';
import RiskDice from './components/RiskDice';
import { Sparkles, History, Trophy, RotateCcw } from 'lucide-react';

// Configuration
const SIDES = 20;

export default function App() {
  const [state, setState] = useState<GameState>({
    streak: 0,
    totalRolls: 0,
    outcome: DiceOutcome.IDLE,
    maxStreak: 0,
  });

  const [isRolling, setIsRolling] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null); // 預先決定的抽中面
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Audio Context on first interaction
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playSound = (type: 'roll' | 'win' | 'lose') => {
    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    if (type === 'roll') {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'win') {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(500, now);
      osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
      osc2.connect(gainNode);

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } else if (type === 'lose') {
      // Explosion Sound
      const bufferSize = ctx.sampleRate * 2.5; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/bufferSize, 2);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(10, now + 2.0);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 2.0);

      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      noise.start(now);
    }
  };

  const rollDice = () => {
    if (isRolling) return;
    initAudio();
    setShowExplosion(false);
    
    // 點擊按鈕時立即決定抽中的面（0-19的索引）和結果
    const selectedFace = Math.floor(Math.random() * SIDES); // 0 to 19
    const isBad = selectedFace === 0; // 第一個面是大凶
    
    // 設置預先決定的面
    setSelectedFaceIndex(selectedFace);
    
    // 先設置為滾動狀態
    setIsRolling(true);
    setState(prev => ({ ...prev, outcome: DiceOutcome.ROLLING }));

    let clickCount = 0;
    const clickInterval = setInterval(() => {
      playSound('roll');
      clickCount++;
      if (clickCount > 8) clearInterval(clickInterval);
    }, 100);

    // 滾動動畫持續時間
    setTimeout(() => {
      clearInterval(clickInterval);
      setIsRolling(false);
      
      // 滾動結束後，設置最終結果
      if (isBad) {
        playSound('lose');
        setShowExplosion(true);
        setState(prev => ({
          streak: 0,
          totalRolls: prev.totalRolls + 1,
          outcome: DiceOutcome.GREAT_MISFORTUNE,
          maxStreak: prev.maxStreak 
        }));
        setTimeout(() => setShowExplosion(false), 2000);
      } else {
        playSound('win');
        setState(prev => {
          const newStreak = prev.streak + 1;
          return {
            streak: newStreak,
            totalRolls: prev.totalRolls + 1,
            outcome: DiceOutcome.GREAT_FORTUNE,
            maxStreak: Math.max(prev.maxStreak, newStreak)
          };
        });
      }
    }, 1200); 
  };

  const resetGame = () => {
    setState({
      streak: 0,
      totalRolls: 0,
      outcome: DiceOutcome.IDLE,
      maxStreak: 0,
    });
    setShowExplosion(false);
    setSelectedFaceIndex(null);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center py-8 px-4 overflow-hidden relative ${showExplosion ? 'animate-shock' : ''}`}
         style={{
           backgroundColor: '#1A1A2E',
           backgroundImage: `
             repeating-linear-gradient(0deg, rgba(1, 205, 254, 0.05) 0px, transparent 2px, transparent 4px, rgba(1, 205, 254, 0.05) 6px),
             repeating-linear-gradient(90deg, rgba(1, 205, 254, 0.05) 0px, transparent 2px, transparent 4px, rgba(1, 205, 254, 0.05) 6px),
             radial-gradient(circle at 20% 30%, rgba(1, 205, 254, 0.2) 0%, transparent 50%),
             radial-gradient(circle at 80% 70%, rgba(255, 113, 206, 0.2) 0%, transparent 50%)
           `
         }}>
      
      {/* Intense Explosion Overlay */}
      {showExplosion && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
            {/* Red Flash */}
            <div className="absolute inset-0 bg-red-600 animate-explode opacity-0 mix-blend-hard-light"></div>
            {/* White Core Flash */}
            <div className="absolute inset-0 bg-white animate-flash opacity-0"></div>
            {/* Radial Shockwave */}
            <div className="absolute top-1/2 left-1/2 w-[200vw] h-[200vw] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-red-500/50 to-transparent rounded-full animate-shockwave opacity-0"></div>
            
            <h1 className="relative z-50 text-[150px] md:text-[250px] animate-text-slam uppercase leading-none glow-red" 
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  color: '#FF006E',
                  textShadow: "8px 8px 0px #000, 0 0 40px rgba(255, 0, 110, 1)"
                }}>
              大凶
            </h1>
        </div>
      )}

      {/* Card Game Grid Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-20">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute border-2 rounded-lg"
            style={{
              width: '180px',
              height: '250px',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 360}deg)`,
              borderColor: i % 2 === 0 ? 'rgba(1, 205, 254, 0.3)' : 'rgba(255, 113, 206, 0.3)',
              boxShadow: i % 2 === 0 ? '0 0 20px rgba(1, 205, 254, 0.3)' : '0 0 20px rgba(255, 113, 206, 0.3)'
            }}
          />
        ))}
      </div>

      {/* Header - Game Card Title */}
      <header className="z-10 text-center mb-8 relative">
        <div className="inline-block relative px-8 py-6 card-border bg-gradient-to-b from-cyan-950/80 to-pink-950/80 backdrop-blur-sm rounded-lg">
            <h1 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 via-pink-200 to-cyan-300 mb-3 glow-cyan tracking-wider"
                style={{fontFamily: "'Press Start 2P', cursive"}}>
              風險骰子
            </h1>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent mb-3"></div>
            <p className="text-cyan-300 text-xs md:text-sm tracking-widest uppercase" style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}>
              ★ The D20 of Fate ★
            </p>
            <p className="text-pink-400/80 text-xs tracking-wider mt-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
              1 Calamity • 19 Fortunes
            </p>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="z-10 flex flex-col items-center justify-center flex-grow w-full max-w-2xl">
        
        {/* Stats HUD - Card Game Style */}
        <div className="w-full grid grid-cols-3 gap-3 mb-12">
           <div className="card-border bg-gradient-to-b from-cyan-950/90 to-blue-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform">
             <div className="text-xs text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
               <History size={16} /> ROLLS
             </div>
             <div className="text-3xl md:text-4xl font-bold text-cyan-200 glow-text" style={{fontFamily: "'Press Start 2P', cursive"}}>{state.totalRolls}</div>
           </div>

           <div className="relative card-border-gold bg-gradient-to-b from-emerald-950/90 to-teal-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform">
             <div className="text-xs text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
               <Sparkles size={16} className="text-emerald-400" /> STREAK
             </div>
             <div className={`text-4xl md:text-6xl transition-all duration-300 glow-gold ${state.outcome === DiceOutcome.GREAT_MISFORTUNE ? 'text-pink-500' : 'text-emerald-300'}`}
                  style={{fontFamily: "'Press Start 2P', cursive"}}>
               {state.streak}
             </div>
             {state.outcome === DiceOutcome.GREAT_FORTUNE && !isRolling && (
                <div className="absolute -top-2 -right-2">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                    </span>
                </div>
             )}
           </div>

           <div className="card-border bg-gradient-to-b from-cyan-950/90 to-blue-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform">
             <div className="text-xs text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
               <Trophy size={16} /> BEST
             </div>
             <div className="text-3xl md:text-4xl font-bold text-cyan-200 glow-text" style={{fontFamily: "'Press Start 2P', cursive"}}>{state.maxStreak}</div>
           </div>
        </div>

        {/* The Dice - Card Slot Style */}
        <div className="mb-12 relative w-full flex justify-center h-[280px] items-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[300px] h-[300px] card-border bg-gradient-to-br from-cyan-950/50 to-pink-950/50 backdrop-blur-md rounded-lg flex items-center justify-center">
              <RiskDice 
                outcome={state.outcome} 
                isRolling={isRolling} 
                selectedFaceIndex={selectedFaceIndex}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Status Message - Card Text Style */}
        <div className="h-32 flex flex-col items-center justify-center mb-8 text-center px-4 w-full">
          {isRolling && (
            <div className="card-border bg-gradient-to-b from-cyan-950/90 to-pink-950/90 backdrop-blur-md px-8 py-4 rounded-lg animate-pulse">
              <p className="text-2xl text-cyan-300 tracking-widest glow-cyan" style={{fontFamily: "'Press Start 2P', cursive"}}>
                ROLLING...
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.IDLE && (
            <div className="card-border bg-gradient-to-b from-cyan-950/70 to-pink-950/70 backdrop-blur-sm px-8 py-4 rounded-lg">
              <p className="text-cyan-300 text-lg tracking-wider" style={{fontFamily: "'VT323', monospace", fontSize: '24px'}}>
                Press START to roll fate...
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.GREAT_FORTUNE && (
            <div className="card-border-gold bg-gradient-to-b from-emerald-950/90 to-teal-950/90 backdrop-blur-md px-8 py-6 rounded-lg animate-bounce-short">
              <p className="text-5xl md:text-6xl text-emerald-300 glow-gold mb-3" style={{fontFamily: "'Press Start 2P', cursive"}}>
                大吉
              </p>
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent mb-2"></div>
              <p className="text-emerald-400 text-sm uppercase tracking-widest" style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}>
                ★ FORTUNE SMILES ★
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.GREAT_MISFORTUNE && (
            <div className="card-border-red bg-gradient-to-b from-pink-950/90 to-rose-950/90 backdrop-blur-md px-8 py-6 rounded-lg animate-shake">
              <p className="text-5xl md:text-6xl glow-red mb-3" style={{fontFamily: "'Press Start 2P', cursive", color: '#FF006E'}}>
                大凶
              </p>
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-pink-500 to-transparent mb-2"></div>
              <p className="text-pink-400 text-sm uppercase tracking-widest" style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}>
                ☠ CALAMITY STRIKES ☠
              </p>
            </div>
          )}
        </div>

        {/* Controls - Greed Island Button Style */}
        <button
          onClick={rollDice}
          disabled={isRolling}
          className={`
            relative group w-full max-w-[320px] py-5 rounded-lg 
            text-lg tracking-[0.2em] uppercase transition-all duration-300
            ${isRolling 
              ? 'bg-slate-900 text-slate-600 cursor-not-allowed transform scale-95 border-4 border-slate-800' 
              : 'card-border bg-gradient-to-b from-cyan-700 to-pink-800 text-cyan-100 hover:from-cyan-600 hover:to-pink-700 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_40px_rgba(1,205,254,0.6)]'
            }
          `}
          style={{fontFamily: "'Press Start 2P', cursive"}}
        >
          <div className="flex items-center justify-center gap-3">
            <span className={isRolling ? '' : 'glow-cyan'}>
              {isRolling ? '◆ ROLLING ◆' : '▶ ROLL FATE ◀'}
            </span>
          </div>
        </button>
        
        {state.totalRolls > 0 && !isRolling && (
           <button 
             onClick={resetGame}
             className="mt-8 card-border bg-gradient-to-b from-pink-950/80 to-rose-950/80 backdrop-blur-sm px-6 py-3 rounded-lg text-pink-400 hover:text-pink-300 text-xs flex items-center gap-2 transition-all hover:scale-105 opacity-80 hover:opacity-100"
             style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}
           >
             <RotateCcw size={16} /> RESET GAME
           </button>
        )}
      </main>

      {/* Footer Info - Card Stats */}
      <footer className="mt-auto py-6 text-center">
        <div className="card-border bg-gradient-to-b from-cyan-950/70 to-pink-950/70 backdrop-blur-sm px-8 py-3 rounded-lg inline-block">
          <div className="flex justify-center gap-6 text-cyan-300" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(5,255,161,0.8)]"></span> 
                95% FORTUNE
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,0,110,0.8)]" style={{backgroundColor: '#FF006E'}}></span> 
                5% CALAMITY
              </span>
          </div>
        </div>
      </footer>
      
      <style>{`
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .animate-gradient {
            animation: gradient 3s ease infinite;
        }
        @keyframes shockwave {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        @keyframes flash {
           0%, 100% { opacity: 0; }
           10% { opacity: 1; }
           100% { opacity: 0; }
        }
        .animate-shockwave {
           animation: shockwave 0.8s ease-out forwards;
        }
        .animate-flash {
           animation: flash 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
