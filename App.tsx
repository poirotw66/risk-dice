import React, { useState, useRef, useEffect } from 'react';
import { DiceOutcome, GameState } from './types';
import RiskDice from './components/RiskDice';
import { Sparkles, History, Trophy, AlertTriangle, Skull, Zap, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  listenToGlobalStreak,
  listenToGlobalMaxStreak,
  getGlobalStreak,
  getGlobalMaxStreak,
  incrementGlobalStreak, 
  resetGlobalStreak,
  isFirebaseAvailable 
} from './src/firebase';

// Configuration
const SIDES = 20;
const LOCAL_STORAGE_KEY = 'risk-dice-state';

// 從 localStorage 載入初始狀態
const loadLocalState = (): GameState => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('Loaded from localStorage:', parsed);
      return {
        streak: parsed.streak || 0,
        totalRolls: parsed.totalRolls || 0,
        outcome: DiceOutcome.IDLE,
        maxStreak: parsed.maxStreak || 0,
      };
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return {
    streak: 0,
    totalRolls: 0,
    outcome: DiceOutcome.IDLE,
    maxStreak: 0,
  };
};

export default function App() {
  const [state, setState] = useState<GameState>(loadLocalState());

  const [isRolling, setIsRolling] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null); // 預先決定的抽中面
  const [useGlobalStreak, setUseGlobalStreak] = useState(false); // 是否使用全域 streak
  const [showDescription, setShowDescription] = useState(false); // 是否顯示說明
  const audioContextRef = useRef<AudioContext | null>(null);

  // 自動儲存 state 到 localStorage
  useEffect(() => {
    const stateToSave = {
      streak: state.streak,
      totalRolls: state.totalRolls,
      maxStreak: state.maxStreak,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state.streak, state.totalRolls, state.maxStreak]);

  // 監聽 Firebase 全域 streak 和 maxStreak
  useEffect(() => {
    if (!isFirebaseAvailable()) {
      console.log('Firebase not configured, using local streak with localStorage persistence');
      return;
    }

    setUseGlobalStreak(true);
    console.log('Firebase configured, using global streak');

    // 先載入初始數據
    const loadInitialData = async () => {
      const [initialStreak, initialMaxStreak] = await Promise.all([
        getGlobalStreak(),
        getGlobalMaxStreak()
      ]);
      
      console.log('Loaded initial data from Firebase:', { streak: initialStreak, maxStreak: initialMaxStreak });
      
      setState(prev => ({
        ...prev,
        streak: initialStreak,
        maxStreak: initialMaxStreak
      }));
    };

    loadInitialData();

    // 設置即時監聽器
    const unsubscribeStreak = listenToGlobalStreak((globalStreak) => {
      console.log('Global streak updated:', globalStreak);
      setState(prev => ({
        ...prev,
        streak: globalStreak
      }));
    });

    const unsubscribeMaxStreak = listenToGlobalMaxStreak((globalMaxStreak) => {
      console.log('Global max streak updated:', globalMaxStreak);
      setState(prev => ({
        ...prev,
        maxStreak: globalMaxStreak
      }));
    });

    return () => {
      if (unsubscribeStreak) {
        unsubscribeStreak();
      }
      if (unsubscribeMaxStreak) {
        unsubscribeMaxStreak();
      }
    };
  }, []);

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
    setTimeout(async () => {
      clearInterval(clickInterval);
      setIsRolling(false);
      
      // 滾動結束後，設置最終結果
      if (isBad) {
        playSound('lose');
        setShowExplosion(true);
        
        // 重置 streak（全域或本地）
        if (useGlobalStreak) {
          // Firebase 模式：只更新 Firebase，streak 會透過 listener 同步
          await resetGlobalStreak();
          setState(prev => ({
            ...prev,
            totalRolls: prev.totalRolls + 1,
            outcome: DiceOutcome.GREAT_MISFORTUNE,
          }));
        } else {
          // 本地模式：直接更新 state
          setState(prev => ({
            streak: 0,
            totalRolls: prev.totalRolls + 1,
            outcome: DiceOutcome.GREAT_MISFORTUNE,
            maxStreak: prev.maxStreak 
          }));
        }
        
        setTimeout(() => setShowExplosion(false), 2000);
      } else {
        playSound('win');
        
        // 增加 streak（全域或本地）
        if (useGlobalStreak) {
          // Firebase 模式：只更新 Firebase，streak 會透過 listener 同步
          await incrementGlobalStreak();
          setState(prev => ({
            ...prev,
            totalRolls: prev.totalRolls + 1,
            outcome: DiceOutcome.GREAT_FORTUNE,
          }));
        } else {
          // 本地模式：直接更新 state
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
      }
    }, 1200);
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
      <header className="z-10 text-center mb-8 relative max-w-4xl w-full">
        <div className="inline-block relative px-8 py-6 card-border bg-gradient-to-b from-cyan-950/90 to-pink-950/90 backdrop-blur-sm rounded-lg hover:shadow-[0_0_40px_rgba(1,205,254,0.3)] transition-all duration-300">
            <h1 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 via-pink-200 to-cyan-300 mb-3 glow-cyan tracking-wider"
                style={{fontFamily: "'Press Start 2P', cursive"}}>
              風險骰子
            </h1>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent mb-3"></div>
            <p className="text-cyan-200 text-xs md:text-sm tracking-widest uppercase font-medium" style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}>
              ★ RISK DICE - D20 OF FATE ★
            </p>
            <p className="text-pink-300 text-xs tracking-wider mt-1 font-medium" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
              1 Calamity • 19 Fortunes
            </p>
            <button 
              onClick={() => setShowDescription(!showDescription)}
              className="mt-4 text-cyan-300 hover:text-cyan-100 text-sm transition-all duration-200 flex items-center gap-2 mx-auto cursor-pointer hover:scale-105 px-4 py-2 rounded-md bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-700/30"
              style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}
            >
              {showDescription ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span>{showDescription ? '隱藏說明' : '查看說明'}</span>
            </button>
        </div>
        
        {/* Description Panel */}
        {showDescription && (
          <div className="mt-4 card-border bg-gradient-to-b from-gray-900/95 to-red-950/95 backdrop-blur-md rounded-lg p-6 md:p-8 text-left border-2 border-red-800/60 shadow-[0_0_30px_rgba(139,0,0,0.5)] animate-slideDown">
            <div className="space-y-5 text-sm md:text-base" style={{fontFamily: "'VT323', monospace", fontSize: '17px', lineHeight: '1.75'}}>
              <div>
                <h3 className="text-red-300 text-xl font-bold mb-3 flex items-center gap-3">
                  <AlertTriangle size={24} className="text-red-400" />
                  <span>風險骰子（Risk Dice）</span>
                </h3>
                <p className="text-gray-200 leading-relaxed">
                  《獵人（Hunter x Hunter）》貪婪之島篇中登場的特殊關鍵道具，<br/>
                  也是將「<span className="text-cyan-300 font-semibold">命運</span>」與「<span className="text-pink-300 font-semibold">運氣</span>」具象化的極端博弈工具。
                </p>
              </div>
              
              <div className="border-l-4 border-yellow-500/60 pl-4 bg-yellow-900/20 py-3 rounded-r">
                <p className="text-yellow-200 leading-relaxed">
                  外型是一顆標準的<span className="font-bold text-yellow-300">二十面骰（D20）</span>，但其結構卻極不公平——<br/>
                  在 20 個面中：<br/>
                  <span className="text-green-400 font-bold text-lg">19 面刻著「大吉」</span><br/>
                  <span className="text-red-400 font-bold text-lg">僅有 1 面刻著「大凶」</span>
                </p>
              </div>
              
              <div>
                <h4 className="text-cyan-300 font-bold mb-3 text-lg flex items-center gap-2">
                  <Zap size={20} className="text-cyan-400" />
                  <span>擲骰規則與本質</span>
                </h4>
                <div className="space-y-3 text-gray-200 leading-relaxed">
                  <p>每一次擲出風險骰子，都是一次與<span className="text-pink-300 font-semibold">命運</span>的交易：</p>
                  <div className="pl-4 border-l-2 border-green-500/40 bg-green-950/20 py-2 rounded-r">
                    <p className="text-green-300 leading-relaxed">
                      <span className="font-bold text-green-200">擲出「大吉」</span>：<br/>
                      你將獲得強力的幸運效果、加成或特殊收益，彷彿世界暫時站在你這一邊。
                    </p>
                  </div>
                  <div className="pl-4 border-l-2 border-red-500/60 bg-red-950/20 py-2 rounded-r">
                    <p className="text-red-300 leading-relaxed">
                      <span className="font-bold text-red-200">擲出「大凶」</span>：<br/>
                      將立即觸發極度不幸的事件，<span className="text-red-200 font-semibold">不但會抵消先前累積的好運</span>，還可能帶來災難性的後果。
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-900/30 border border-red-800/60 rounded-lg p-4">
                <h4 className="text-red-200 font-bold mb-3 text-lg flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-300" />
                  <span>真正的風險，不在機率</span>
                </h4>
                <p className="text-gray-200 leading-relaxed">
                  從數學上看，「大凶」出現的機率只有 <span className="text-yellow-300 font-bold text-lg">1/20 (5%)</span>。<br/>
                  但風險骰子的可怕之處在於：
                </p>
                <p className="text-red-200 text-center text-xl font-bold mt-3 mb-3 italic leading-relaxed">
                  「你不知道這顆『大凶』，會在第幾次擲出。」
                </p>
                <p className="text-gray-300 text-center leading-relaxed">
                  它不考驗運氣，<br/>
                  <span className="text-cyan-300 font-semibold">它考驗的是——你什麼時候該停手。</span>
                </p>
              </div>
              
              <div>
                <h4 className="text-pink-300 font-bold mb-3 text-lg flex items-center gap-2">
                  <TrendingUp size={20} className="text-pink-400" />
                  <span>道具哲學</span>
                </h4>
                <p className="text-gray-200 leading-relaxed">
                  風險骰子並不是單純的「賭運氣」道具，而是：
                </p>
                <p className="text-yellow-200 italic text-center mt-3 mb-3 text-lg leading-relaxed">
                  一個將「<span className="text-red-300 font-semibold">貪婪</span>」、「<span className="text-orange-300 font-semibold">自信</span>」、「<span className="text-pink-300 font-semibold">僥倖心理</span>」逐步放大的陷阱。
                </p>
                <p className="text-gray-300 text-center leading-relaxed">
                  用得越久，得到的越多，<br/>
                  <span className="text-red-300 font-semibold">失去的時候，也會一次全部吐回去。</span>
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-red-900/40 to-gray-900/40 border-2 border-red-700/70 rounded-lg p-5">
                <h4 className="text-red-200 font-bold mb-3 text-lg flex items-center gap-2 justify-center">
                  <Skull size={20} className="text-red-300" />
                  <span>使用警告</span>
                  <Skull size={20} className="text-red-300" />
                </h4>
                <p className="text-gray-200 italic text-center leading-relaxed">
                  「幾乎每個使用風險骰子的玩家，<br/>
                  在前期都會覺得——<span className="text-yellow-300 font-semibold">自己不可能那麼倒楣</span>。」
                </p>
                <p className="text-red-300 text-center mt-3 font-bold text-lg leading-relaxed">
                  直到他們擲出那一面為止。
                </p>
                <div className="mt-4 p-4 bg-red-950/40 border border-red-800/50 rounded-lg">
                  <p className="text-red-200 text-center leading-relaxed">
                    在獵人世界中，風險骰子並非玩具或測運工具，而是一種<span className="text-red-300 font-semibold">強制契約的念能力具現化道具</span>。<br/>
                    每一次擲骰，你都在與自己的「<span className="text-yellow-300 font-semibold">念</span>」、與世界的「<span className="text-cyan-300 font-semibold">因果</span>」達成交易。<br/>
                    而交易一旦開始，就無法單方面取消。
                  </p>
                  <p className="text-red-100 font-bold text-lg mt-3 text-center leading-relaxed">
                    只有兩種結果：享受好運直到崩潰，或及時收手全身而退。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Game Area */}
      <main className="z-10 flex flex-col items-center justify-center flex-grow w-full max-w-2xl">
        
        {/* Stats HUD - Card Game Style */}
        <div className="w-full grid grid-cols-3 gap-3 mb-12">
           <div className="card-border bg-gradient-to-b from-cyan-950/90 to-blue-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
             <div className="text-xs text-cyan-300 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
               <History size={16} /> ROLLS
             </div>
             <div className="text-3xl md:text-4xl font-bold text-cyan-200 glow-text" style={{fontFamily: "'Press Start 2P', cursive"}}>{state.totalRolls}</div>
           </div>

           <div className="relative card-border-gold bg-gradient-to-b from-emerald-950/90 to-teal-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/30 transition-all">
             <div className="text-xs text-emerald-300 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
               <Sparkles size={16} className="text-emerald-300" /> STREAK
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

           <div className="card-border bg-gradient-to-b from-cyan-950/90 to-blue-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
             <div className="text-xs text-cyan-300 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
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
            <div className="card-border-gold bg-gradient-to-b from-emerald-950/90 to-teal-950/90 backdrop-blur-md px-8 py-6 rounded-lg animate-bounce-short flex flex-col items-center">
              <p className="text-5xl md:text-6xl text-emerald-300 glow-gold mb-3" style={{fontFamily: "'Press Start 2P', cursive", writingMode: 'vertical-rl', textOrientation: 'upright'}}>
                大吉
              </p>
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent mb-2"></div>
              <p className="text-emerald-300 text-sm uppercase tracking-widest" style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}>
                ★ FORTUNE SMILES ★
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.GREAT_MISFORTUNE && (
            <div className="card-border-red bg-gradient-to-b from-pink-950/90 to-rose-950/90 backdrop-blur-md px-8 py-6 rounded-lg animate-shake flex flex-col items-center">
              <p className="text-5xl md:text-6xl glow-red mb-3" style={{fontFamily: "'Press Start 2P', cursive", color: '#FF006E', writingMode: 'vertical-rl', textOrientation: 'upright'}}>
                大凶
              </p>
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-pink-500 to-transparent mb-2"></div>
              <p className="text-pink-300 text-sm uppercase tracking-widest" style={{fontFamily: "'VT323', monospace", fontSize: '18px'}}>
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
      </main>

      {/* Footer Info - Card Stats */}
      <footer className="mt-auto py-6 text-center">
        <div className="card-border bg-gradient-to-b from-cyan-950/70 to-pink-950/70 backdrop-blur-sm px-8 py-3 rounded-lg inline-block">
          <div className="flex justify-center gap-6 text-cyan-200" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
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
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out forwards;
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
