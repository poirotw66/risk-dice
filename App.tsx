import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DiceOutcome, GameState } from './types';
import RiskDice from './components/RiskDice';
import ParticleField, { ParticleFieldHandle } from './components/ParticleField';
import { Sparkles, History, Trophy, AlertTriangle, Skull, Zap, TrendingUp, ChevronDown, ChevronUp, Volume2, VolumeX, Flame } from 'lucide-react';
import { getTier, getTierIndex, nextMilestone, milestoneProgress, isMilestone } from './src/streak';
import * as sfx from './src/sound';
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
const ROLL_DURATION = 1800;
/** The die is still spinning down when the roll timer ends — pay off on landing */
const REVEAL_DELAY = 520;

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported — no-op */
  }
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// 從 localStorage 載入初始狀態
const loadLocalState = (): GameState => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (import.meta.env.DEV) console.log('Loaded from localStorage:', parsed);
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
  const [performanceMode, setPerformanceMode] = useState<boolean>(() => {
    // ponytail: default ON for small screens or very high DPR
    if (typeof window === 'undefined') return false;
    const isSmall = window.matchMedia ? window.matchMedia('(max-width: 768px)').matches : false;
    const dpr = (window as any).devicePixelRatio || 1;
    return isSmall || dpr > 2.5;
  });
  const [muted, setMuted] = useState(false);

  // --- Feedback layer -----------------------------------------------------
  const [displayStreak, setDisplayStreak] = useState(state.streak); // animated counter
  const [streakPop, setStreakPop] = useState(0); // bump key, retriggers the pop animation
  const [gainFloat, setGainFloat] = useState<{ id: number; text: string } | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<{ value: number; label: string } | null>(null);
  const [recordFlash, setRecordFlash] = useState(false);

  const particlesRef = useRef<ParticleFieldHandle>(null);
  const diceAreaRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const displayStreakRef = useRef(state.streak);
  const streakRafRef = useRef<number | null>(null);
  const revealGateRef = useRef(true);
  const timeoutsRef = useRef<number[]>([]);
  const stopRollSoundRef = useRef<(() => void) | null>(null);

  stateRef.current = state;

  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    if (streakRafRef.current !== null) cancelAnimationFrame(streakRafRef.current);
    stopRollSoundRef.current?.();
  }, []);

  /** Roll the displayed streak up (or down) instead of snapping it */
  const animateStreak = useCallback((target: number, duration = 480) => {
    if (streakRafRef.current !== null) cancelAnimationFrame(streakRafRef.current);
    const from = displayStreakRef.current;
    if (from === target) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (target - from) * easeOutCubic(t));
      displayStreakRef.current = value;
      setDisplayStreak(value);
      if (t < 1) {
        streakRafRef.current = requestAnimationFrame(step);
      } else {
        streakRafRef.current = null;
      }
    };
    streakRafRef.current = requestAnimationFrame(step);
  }, []);

  // Keep the counter in sync with externally driven changes (Firebase, load),
  // but never while a roll is mid-reveal — the payoff owns that moment.
  useEffect(() => {
    if (revealGateRef.current) animateStreak(state.streak, 380);
  }, [state.streak, animateStreak]);

  const tier = useMemo(() => getTier(displayStreak), [displayStreak]);
  const tierIndex = useMemo(() => getTierIndex(displayStreak), [displayStreak]);
  const goal = useMemo(() => nextMilestone(displayStreak), [displayStreak]);
  const goalProgress = useMemo(() => milestoneProgress(displayStreak), [displayStreak]);

  /** Viewport centre of the die, so bursts originate from the object itself */
  const diceCenter = useCallback(() => {
    const rect = diceAreaRef.current?.getBoundingClientRect();
    if (!rect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, []);

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
      if (import.meta.env.DEV) console.log('Firebase not configured, using local streak with localStorage persistence');
      return;
    }

    setUseGlobalStreak(true);
    if (import.meta.env.DEV) console.log('Firebase configured, using global streak');

    // 先載入初始數據
    const loadInitialData = async () => {
      const [initialStreak, initialMaxStreak] = await Promise.all([
        getGlobalStreak(),
        getGlobalMaxStreak()
      ]);
      
      if (import.meta.env.DEV) console.log('Loaded initial data from Firebase:', { streak: initialStreak, maxStreak: initialMaxStreak });
      
      setState(prev => ({
        ...prev,
        streak: initialStreak,
        maxStreak: initialMaxStreak
      }));
    };

    loadInitialData();

    // 設置即時監聽器
    const unsubscribeStreak = listenToGlobalStreak((globalStreak) => {
      if (import.meta.env.DEV) console.log('Global streak updated:', globalStreak);
      setState(prev => ({
        ...prev,
        streak: globalStreak
      }));
    });

    const unsubscribeMaxStreak = listenToGlobalMaxStreak((globalMaxStreak) => {
      if (import.meta.env.DEV) console.log('Global max streak updated:', globalMaxStreak);
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

  /** Everything that fires the instant the die actually lands */
  const celebrate = useCallback((isBad: boolean, streakBefore: number, maxBefore: number) => {
    const particles = particlesRef.current;
    const { x, y } = diceCenter();
    revealGateRef.current = true;

    if (isBad) {
      setShowExplosion(true);
      sfx.playLose();
      vibrate([50, 60, 140]);
      const reach = Math.max(window.innerWidth, window.innerHeight);
      particles?.ring({ x, y, color: '#FF006E', from: 20, to: reach, life: 0.9, width: 14 });
      particles?.burst({
        x, y, count: 130, colors: ['#FF006E', '#ef4444', '#fb7185', '#ffffff'],
        speed: 980, gravity: 1100, life: 1.5, size: 8, radius: 30,
      });
      particles?.burst({
        x, y, count: 44, colors: ['#7f1d1d', '#450a0a', '#FF006E'],
        speed: 640, gravity: 1500, life: 1.9, size: 13, shape: 'confetti',
      });
      // Watching the streak drain to zero hurts more than a hard cut
      animateStreak(0, 720);
      setStreakPop((n) => n + 1);
      if (streakBefore > 0) {
        setGainFloat({ id: Date.now(), text: `-${streakBefore}` });
        addTimeout(() => setGainFloat(null), 1400);
      }
      addTimeout(() => setShowExplosion(false), 2000);
      return;
    }

    const streak = Math.max(stateRef.current.streak, streakBefore + 1);
    const level = getTierIndex(streak);
    const palette = getTier(streak).particles;
    const color = getTier(streak).color;

    sfx.playWin(streak, level);
    vibrate(16 + level * 8);
    animateStreak(streak, 420);
    setStreakPop((n) => n + 1);
    setGainFloat({ id: Date.now(), text: '+1' });
    addTimeout(() => setGainFloat(null), 1100);

    particles?.ring({ x, y, color, from: 24, to: 170 + level * 55, life: 0.6 + level * 0.06, width: 4 + level });
    particles?.burst({
      x, y,
      count: 24 + level * 18,
      colors: palette,
      speed: 360 + level * 110,
      gravity: 700,
      life: 1 + level * 0.12,
      size: 5 + level,
      radius: 28,
    });
    if (level >= 2) {
      particles?.burst({
        x, y: y - 40,
        count: 14 + level * 8,
        colors: palette,
        speed: 460 + level * 90,
        angle: -Math.PI / 2,
        spread: Math.PI * 0.9,
        gravity: 900,
        life: 1.6,
        size: 9,
        shape: 'confetti',
      });
    }

    if (isMilestone(streak)) {
      setMilestoneBanner({ value: streak, label: `${streak} 連勝` });
      addTimeout(() => setMilestoneBanner(null), 2100);
      addTimeout(() => {
        sfx.playMilestone();
        vibrate([25, 40, 25, 40, 60]);
        particles?.ring({ x, y, color, from: 40, to: 620, life: 1.1, width: 10 });
        // Side cannons for the full confetti-cannon feel
        [0, 1].forEach((side) => {
          particles?.burst({
            x: side ? window.innerWidth : 0,
            y: window.innerHeight * 0.72,
            count: 60,
            colors: palette,
            speed: 1250,
            angle: side ? -Math.PI * 0.72 : -Math.PI * 0.28,
            spread: Math.PI * 0.35,
            gravity: 1000,
            life: 2.2,
            size: 10,
            shape: 'confetti',
          });
        });
      }, 180);
    }

    if (streak > maxBefore && maxBefore > 0) {
      setRecordFlash(true);
      addTimeout(() => {
        sfx.playRecord();
        particles?.burst({
          x, y, count: 40, colors: ['#fff1a8', '#fbbf24', '#ffffff'],
          speed: 520, gravity: 300, life: 1.7, size: 5,
        });
      }, 320);
      addTimeout(() => setRecordFlash(false), 2400);
    }
  }, [addTimeout, animateStreak, diceCenter]);

  const rollDice = () => {
    if (isRolling) return;
    sfx.initAudio();
    setShowExplosion(false);
    setMilestoneBanner(null);
    setGainFloat(null);

    // 點擊按鈕時立即決定抽中的面（0-19的索引）和結果
    const selectedFace = Math.floor(Math.random() * SIDES); // 0 to 19
    const isBad = selectedFace === 0; // 第一個面是大凶
    const streakBefore = stateRef.current.streak;
    const maxBefore = stateRef.current.maxStreak;

    // 設置預先決定的面
    setSelectedFaceIndex(selectedFace);

    // 先設置為滾動狀態
    setIsRolling(true);
    setState(prev => ({ ...prev, outcome: DiceOutcome.ROLLING }));

    // 揭曉前先鎖住計數器，讓數字在骰子真正落定時才跳動
    revealGateRef.current = false;
    vibrate(12);
    stopRollSoundRef.current?.();
    stopRollSoundRef.current = sfx.playRoll(ROLL_DURATION);

    // 滾動動畫持續時間
    addTimeout(async () => {
      stopRollSoundRef.current?.();
      stopRollSoundRef.current = null;
      setIsRolling(false);
      sfx.playImpact();

      // 滾動結束後，設置最終結果
      if (isBad) {
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
      } else {
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

      // 骰子還在收斂，等它真的停穩再放獎勵
      addTimeout(() => celebrate(isBad, streakBefore, maxBefore), REVEAL_DELAY);
    }, ROLL_DURATION);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center py-8 px-4 overflow-hidden relative ${showExplosion ? 'animate-shock' : ''}`}
         style={{
           '--tier-rgb': tier.rgb,
           '--tier-color': tier.color,
           backgroundColor: '#1A1A2E',
           backgroundImage: `
             repeating-linear-gradient(0deg, rgba(1, 205, 254, 0.05) 0px, transparent 2px, transparent 4px, rgba(1, 205, 254, 0.05) 6px),
             repeating-linear-gradient(90deg, rgba(1, 205, 254, 0.05) 0px, transparent 2px, transparent 4px, rgba(1, 205, 254, 0.05) 6px),
             radial-gradient(circle at 20% 30%, rgba(1, 205, 254, 0.2) 0%, transparent 50%),
             radial-gradient(circle at 80% 70%, rgba(255, 113, 206, 0.2) 0%, transparent 50%)
           `
         } as React.CSSProperties}>

      {/* Reward particles (bursts, confetti cannons, shockwave rings) */}
      <ParticleField ref={particlesRef} />

      {/* Heat haze — the room glows in the current tier's colour as the run grows */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
        style={{
          opacity: tier.intensity * 0.55,
          background:
            'radial-gradient(circle at 50% 62%, rgba(var(--tier-rgb), 0.22) 0%, transparent 55%)',
        }}
      />

      {/* Tension vignette that closes in while the die is in the air */}
      <div className={`fixed inset-0 pointer-events-none z-30 roll-tension ${isRolling ? 'roll-tension-active' : ''}`} />

      {/* Milestone celebration banner */}
      {milestoneBanner && (
        <div className="fixed inset-0 z-[46] pointer-events-none flex items-start justify-center pt-[12vh]">
          <div className="animate-milestone-slam text-center px-10 py-6 rounded-xl backdrop-blur-sm"
               style={{
                 border: `4px solid ${tier.color}`,
                 backgroundColor: 'rgba(10, 8, 24, 0.72)',
                 boxShadow: `0 0 60px rgba(${tier.rgb}, 0.75), inset 0 0 40px rgba(${tier.rgb}, 0.25)`,
               }}>
            <p className="text-6xl md:text-8xl leading-none"
               style={{
                 fontFamily: "'Press Start 2P', cursive",
                 color: tier.color,
                 textShadow: `0 0 20px rgba(${tier.rgb}, 1), 0 0 50px rgba(${tier.rgb}, 0.7)`,
               }}>
              {milestoneBanner.value}
            </p>
            <p className="mt-4 tracking-[0.35em] uppercase"
               style={{ fontFamily: "'VT323', monospace", fontSize: '26px', color: tier.color }}>
              {milestoneBanner.label} · {tier.name}
            </p>
          </div>
        </div>
      )}

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
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={() => setPerformanceMode(v => !v)}
                className={`px-3 py-1 rounded-md border text-xs tracking-wider ${performanceMode ? 'border-emerald-600/60 bg-emerald-900/30 text-emerald-200' : 'border-cyan-700/60 bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-200'}`}
                style={{fontFamily: "'VT323', monospace", fontSize: '14px'}}
                title="切換效能模式"
              >
                {performanceMode ? '效能模式：開' : '效能模式：關'}
              </button>
              <button
                onClick={() => {
                  sfx.initAudio();
                  const next = !muted;
                  setMuted(next);
                  sfx.setMuted(next);
                  if (!next) sfx.playClick();
                }}
                className="px-3 py-1 rounded-md border border-cyan-700/60 bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-200 flex items-center gap-1"
                style={{fontFamily: "'VT323', monospace", fontSize: '14px'}}
                title={muted ? '開啟音效' : '關閉音效'}
                aria-label={muted ? '開啟音效' : '關閉音效'}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {muted ? '音效：關' : '音效：開'}
              </button>
            </div>
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

           <div className={`relative overflow-visible streak-card ${tierIndex >= 3 ? 'streak-card-hot' : ''} backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center transition-all`}>
             <div className="text-xs uppercase tracking-widest mb-1 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px', color: tier.color}}>
               {tierIndex >= 3 ? <Flame size={16} /> : <Sparkles size={16} />} STREAK
             </div>

             {/* Floating gain / loss readout */}
             {gainFloat && (
               <span key={gainFloat.id}
                     className="absolute -top-1 right-3 animate-gain-float pointer-events-none"
                     style={{
                       fontFamily: "'Press Start 2P', cursive",
                       fontSize: '18px',
                       color: gainFloat.text.startsWith('-') ? '#FF006E' : tier.color,
                       textShadow: `0 0 14px ${gainFloat.text.startsWith('-') ? '#FF006E' : tier.color}`,
                     }}>
                 {gainFloat.text}
               </span>
             )}

             <div key={streakPop}
                  className="text-4xl md:text-6xl animate-streak-pop leading-none"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    color: state.outcome === DiceOutcome.GREAT_MISFORTUNE ? '#FF006E' : tier.color,
                    textShadow: `0 0 10px rgba(${tier.rgb}, 1), 0 0 26px rgba(${tier.rgb}, ${0.4 + tier.intensity * 0.6}), 0 0 50px rgba(${tier.rgb}, ${tier.intensity * 0.6})`,
                  }}>
               {displayStreak}
             </div>

             <div className="mt-1 px-2 py-0.5 rounded-full text-[11px] tracking-[0.2em] uppercase"
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '14px',
                    color: tier.color,
                    border: `1px solid rgba(${tier.rgb}, 0.5)`,
                    backgroundColor: `rgba(${tier.rgb}, 0.12)`,
                  }}>
               {tier.name}
             </div>

             {/* Progress towards the next milestone — the goal-gradient hook */}
             <div className="w-full mt-3">
               <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                 <div className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.round(goalProgress * 100)}%`,
                        background: `linear-gradient(90deg, rgba(${tier.rgb}, 0.5), ${tier.color})`,
                        boxShadow: `0 0 12px rgba(${tier.rgb}, 0.9)`,
                      }} />
               </div>
               <div className="mt-1 text-center opacity-70" style={{fontFamily: "'VT323', monospace", fontSize: '13px', color: tier.color}}>
                 下一站 {goal}
               </div>
             </div>
           </div>

           <div className={`relative card-border bg-gradient-to-b from-cyan-950/90 to-blue-950/90 backdrop-blur-md p-4 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 transition-all ${recordFlash ? 'animate-record-flash' : ''}`}>
             <div className="text-xs text-cyan-300 uppercase tracking-widest mb-2 flex items-center gap-1" style={{fontFamily: "'VT323', monospace", fontSize: '16px'}}>
               <Trophy size={16} /> BEST
             </div>
             <div className="text-3xl md:text-4xl font-bold text-cyan-200 glow-text" style={{fontFamily: "'Press Start 2P', cursive"}}>{state.maxStreak}</div>
             {recordFlash && (
               <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full animate-gain-float"
                     style={{
                       fontFamily: "'VT323', monospace", fontSize: '15px',
                       color: '#0b0715', backgroundColor: '#fff1a8',
                       boxShadow: '0 0 18px rgba(255, 241, 168, 0.9)',
                     }}>
                 新紀錄！
               </span>
             )}
           </div>
        </div>

        {/* The Dice - Card Slot Style */}
        <div className="mb-6 relative w-full flex justify-center h-[280px] items-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div ref={diceAreaRef}
                 className={`w-[300px] h-[300px] dice-pedestal rounded-full flex items-center justify-center ${isRolling ? 'dice-pedestal-charging' : ''}`}
                 style={{ '--tier-rgb': tier.rgb } as React.CSSProperties}>
              <RiskDice
                outcome={state.outcome}
                isRolling={isRolling}
                performanceMode={performanceMode}
                selectedFaceIndex={selectedFaceIndex}
              />
            </div>
          </div>
        </div>

        {/* What this roll puts on the line */}
        <div className="mb-6 h-8 flex items-center justify-center">
          {displayStreak > 0 && (
            <p className={`tracking-widest ${displayStreak >= 10 ? 'animate-risk-throb' : ''}`}
               style={{fontFamily: "'VT323', monospace", fontSize: '20px', color: displayStreak >= 10 ? '#FF71CE' : 'rgba(226, 232, 240, 0.6)'}}>
              ⚠ 這一擲押上 <span style={{ color: tier.color, fontWeight: 700 }}>{displayStreak}</span> 連勝
            </p>
          )}
        </div>

        {/* Dynamic Status Message - Card Text Style */}
        <div className="min-h-[210px] flex flex-col items-center justify-center mb-8 text-center px-4 w-full">
          {isRolling && (
            <div className="card-border bg-gradient-to-b from-cyan-950/90 to-pink-950/90 backdrop-blur-md px-8 py-4 rounded-lg animate-rolling-tension">
              <p className="text-2xl text-cyan-300 tracking-widest glow-cyan" style={{fontFamily: "'Press Start 2P', cursive"}}>
                ROLLING<span className="animate-ellipsis"></span>
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.IDLE && (
            <div className="card-border bg-gradient-to-b from-cyan-950/70 to-pink-950/70 backdrop-blur-sm px-8 py-4 rounded-lg">
              <p className="text-cyan-300 text-lg tracking-wider" style={{fontFamily: "'VT323', monospace", fontSize: '24px'}}>
                {tier.tagline}
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.GREAT_FORTUNE && (
            <div className="backdrop-blur-md px-8 py-6 rounded-lg animate-fortune-pop flex flex-col items-center"
                 style={{
                   border: `4px solid ${tier.color}`,
                   background: `linear-gradient(180deg, rgba(${tier.rgb}, 0.16), rgba(8, 6, 20, 0.9))`,
                   boxShadow: `0 0 ${20 + tier.intensity * 45}px rgba(${tier.rgb}, ${0.5 + tier.intensity * 0.5}), inset 0 0 24px rgba(${tier.rgb}, 0.18)`,
                 }}>
              {/* Stacked as two lines — `writing-mode: vertical-rl` collapses to
                  zero height here and lets the glyphs escape the card. */}
              <p className="text-5xl md:text-6xl mb-3 flex flex-col items-center gap-2 leading-none"
                 style={{
                   fontFamily: "'Press Start 2P', cursive",
                   color: tier.color,
                   textShadow: `0 0 10px rgba(${tier.rgb}, 1), 0 0 30px rgba(${tier.rgb}, 0.7)`,
                 }}>
                <span>大</span>
                <span>吉</span>
              </p>
              <div className="h-1 w-full mb-2" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }}></div>
              <p className="text-sm uppercase tracking-widest" style={{fontFamily: "'VT323', monospace", fontSize: '18px', color: tier.color}}>
                ★ {displayStreak} 連勝 · {tier.name} ★
              </p>
            </div>
          )}
          {!isRolling && state.outcome === DiceOutcome.GREAT_MISFORTUNE && (
            <div className="card-border-red bg-gradient-to-b from-pink-950/90 to-rose-950/90 backdrop-blur-md px-8 py-6 rounded-lg animate-shake flex flex-col items-center">
              <p className="text-5xl md:text-6xl glow-red mb-3 flex flex-col items-center gap-2 leading-none"
                 style={{fontFamily: "'Press Start 2P', cursive", color: '#FF006E'}}>
                <span>大</span>
                <span>凶</span>
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
            relative group w-full max-w-[320px] py-5 rounded-lg overflow-hidden
            text-lg tracking-[0.2em] uppercase transition-all duration-300
            ${isRolling
              ? 'bg-slate-900 text-slate-600 cursor-not-allowed transform scale-95 border-4 border-slate-800'
              : 'roll-button card-border bg-gradient-to-b from-cyan-700 to-pink-800 text-cyan-100 hover:from-cyan-600 hover:to-pink-700 hover:scale-105 active:scale-95 cursor-pointer'
            }
          `}
          style={{fontFamily: "'Press Start 2P', cursive"}}
        >
          {/* Shine sweep — keeps the idle button feeling alive and clickable */}
          {!isRolling && <span className="roll-button-shine" aria-hidden="true" />}
          <div className="relative flex flex-col items-center justify-center gap-2">
            <span className={isRolling ? '' : 'glow-cyan'}>
              {isRolling ? '◆ ROLLING ◆' : '▶ ROLL FATE ◀'}
            </span>
            <span className="tracking-[0.3em] opacity-80"
                  style={{fontFamily: "'VT323', monospace", fontSize: '15px', color: isRolling ? '#475569' : tier.color}}>
              {isRolling ? '命運計算中' : `95% 大吉 · 目標 ${goal}`}
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
