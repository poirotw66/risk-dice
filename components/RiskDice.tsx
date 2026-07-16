import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DiceOutcome } from '../types';

interface RiskDiceProps {
  outcome: DiceOutcome;
  isRolling: boolean;
  selectedFaceIndex?: number | null; // 預先決定的抽中面（0-19）
  performanceMode?: boolean; // ponytail: simple perf toggle
}

type FaceVariant = 'fortune' | 'calamity' | 'neutral' | 'rolling' | 'mystery';

const FACE_PALETTE: Record<FaceVariant, { base: string; emissive: string }> = {
  neutral: { base: '#12081f', emissive: '#1a1035' },
  fortune: { base: '#064e3b', emissive: '#10b981' },
  calamity: { base: '#3b0515', emissive: '#dc2626' },
  rolling: { base: '#0c2d4a', emissive: '#06b6d4' },
  mystery: { base: '#1e1b4b', emissive: '#6366f1' },
};

const createFaceTexture = (text: string, variant: FaceVariant, highlighted: boolean): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const styles: Record<FaceVariant, { grad: [string, string, string]; text: string; stroke: string; glow: string }> = {
    neutral: { grad: ['#1f1535', '#0d0618', '#12081f'], text: '#8b7355', stroke: '#4a3728', glow: '#b8860b' },
    fortune: { grad: ['#065f46', '#064e3b', '#047857'], text: '#fde68a', stroke: '#b45309', glow: '#fbbf24' },
    calamity: { grad: ['#450a0a', '#2d0a0a', '#7f1d1d'], text: '#fecaca', stroke: '#991b1b', glow: '#ef4444' },
    rolling: { grad: ['#0c4a6e', '#0c2d4a', '#155e75'], text: '#67e8f9', stroke: '#0891b2', glow: '#22d3ee' },
    mystery: { grad: ['#312e81', '#1e1b4b', '#3730a3'], text: '#c4b5fd', stroke: '#6d28d9', glow: '#a78bfa' },
  };
  const s = styles[variant];

  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 280);
  grad.addColorStop(0, s.grad[0]);
  grad.addColorStop(0.7, s.grad[1]);
  grad.addColorStop(1, s.grad[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(256, 256, 195, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const textColor = highlighted || variant !== 'neutral' ? s.text : '#5c4d3a';
  const fontSize = text.length <= 1 ? 220 : 155;
  ctx.font = `bold ${fontSize}px "VT323", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (highlighted) {
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 30;
  }

  const chars = text.split('');
  const charSpacing = text.length === 2 ? 165 : 190;
  const startY = 256 - (chars.length - 1) * charSpacing / 2;

  chars.forEach((char, index) => {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = highlighted ? 5 : 3;
    ctx.strokeText(char, 256, startY + index * charSpacing);
    ctx.fillStyle = textColor;
    ctx.fillText(char, 256, startY + index * charSpacing);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
};

// 單個面的組件
const DiceFace: React.FC<{
  vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  normal: THREE.Vector3;
  text: string;
  variant: FaceVariant;
  isHighlighted: boolean;
  performanceMode: boolean;
}> = ({ vertices, normal, text, variant, isHighlighted, performanceMode }) => {
  const palette = FACE_PALETTE[variant];
  // 計算面的中心位置
  const center = useMemo(() => {
    return new THREE.Vector3()
      .add(vertices[0])
      .add(vertices[1])
      .add(vertices[2])
      .divideScalar(3);
  }, [vertices]);

  // 創建三角形幾何體 - 使用絕對頂點坐標，確保所有面正確連接
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    // 直接使用絕對頂點坐標，不轉換為相對坐標
    const positions = new Float32Array([
      vertices[0].x, vertices[0].y, vertices[0].z,
      vertices[1].x, vertices[1].y, vertices[1].z,
      vertices[2].x, vertices[2].y, vertices[2].z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [vertices]);

  const texture = useMemo(
    () => createFaceTexture(text, variant, isHighlighted),
    [text, variant, isHighlighted]
  );

  // 計算旋轉以讓面朝向正確方向
  const quaternion = useMemo(() => {
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 0, 1);
    quat.setFromUnitVectors(up, normal.clone().normalize());
    return quat;
  }, [normal]);

  // 計算三角形的大致尺寸（用於文字平面）
  const faceSize = useMemo(() => {
    const v1 = vertices[0];
    const v2 = vertices[1];
    const v3 = vertices[2];
    const edge1 = v1.distanceTo(v2);
    const edge2 = v2.distanceTo(v3);
    const edge3 = v3.distanceTo(v1);
    return Math.max(edge1, edge2, edge3) * 0.6;
  }, [vertices]);

  return (
    <group>
      {/* 三角形面 - 使用絕對坐標，不移動位置 */}
      <mesh geometry={geometry}>
        {performanceMode ? (
          <meshStandardMaterial
            color={palette.base}
            metalness={0.7}
            roughness={0.35}
            side={THREE.DoubleSide}
            emissive={isHighlighted ? new THREE.Color(palette.emissive) : new THREE.Color(0x000000)}
            emissiveIntensity={isHighlighted ? 0.6 : 0.05}
          />
        ) : (
          <meshPhysicalMaterial
            color={palette.base}
            metalness={0.9}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.08}
            side={THREE.DoubleSide}
            emissive={isHighlighted ? new THREE.Color(palette.emissive) : new THREE.Color(palette.emissive)}
            emissiveIntensity={isHighlighted ? 0.85 : 0.08}
            reflectivity={1}
          />
        )}
      </mesh>
      {/* 文字平面 - 放在面的中心 */}
      <group position={center} quaternion={quaternion}>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[faceSize, faceSize]} />
          <meshBasicMaterial
            map={texture}
            transparent={true}
            alphaTest={0.1}
          />
        </mesh>
      </group>
    </group>
  );
};

// 創建標準正二十面體（使用 Three.js 的標準定義）
const createStandardIcosahedron = () => {
  const radius = 2;
  const phi = (1.0 + Math.sqrt(5.0)) / 2.0; // 黃金比例
  
  // 正二十面體的12個頂點（標準坐標）
  const vertices = [
    new THREE.Vector3(-1, phi, 0).normalize().multiplyScalar(radius),
    new THREE.Vector3(1, phi, 0).normalize().multiplyScalar(radius),
    new THREE.Vector3(-1, -phi, 0).normalize().multiplyScalar(radius),
    new THREE.Vector3(1, -phi, 0).normalize().multiplyScalar(radius),
    new THREE.Vector3(0, -1, phi).normalize().multiplyScalar(radius),
    new THREE.Vector3(0, 1, phi).normalize().multiplyScalar(radius),
    new THREE.Vector3(0, -1, -phi).normalize().multiplyScalar(radius),
    new THREE.Vector3(0, 1, -phi).normalize().multiplyScalar(radius),
    new THREE.Vector3(phi, 0, -1).normalize().multiplyScalar(radius),
    new THREE.Vector3(phi, 0, 1).normalize().multiplyScalar(radius),
    new THREE.Vector3(-phi, 0, -1).normalize().multiplyScalar(radius),
    new THREE.Vector3(-phi, 0, 1).normalize().multiplyScalar(radius),
  ];

  // 正二十面體的20個面的頂點索引（確保頂點順序正確，法向量指向外）
  // 每個面的頂點順序應該是逆時針（從外看）
  const faceIndices = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const faceData: { vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; normal: THREE.Vector3 }[] = [];

  for (const indices of faceIndices) {
    const v1 = vertices[indices[0]].clone();
    const v2 = vertices[indices[1]].clone();
    const v3 = vertices[indices[2]].clone();

    // 計算面的法向量（使用叉積）
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    let normal = new THREE.Vector3()
      .crossVectors(edge1, edge2)
      .normalize();

    // 確保法向量指向外（從原點指向面的中心）
    const faceCenter = new THREE.Vector3()
      .add(v1)
      .add(v2)
      .add(v3)
      .divideScalar(3);
    
    // 如果法向量與中心向量方向相反，則翻轉
    if (normal.dot(faceCenter) < 0) {
      normal.negate();
    }

    faceData.push({
      vertices: [v1, v2, v3],
      normal: normal,
    });
  }

  return faceData;
};

const DiceWireAura: React.FC<{ performanceMode: boolean; isRolling: boolean }> = ({ performanceMode, isRolling }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * (isRolling ? 0.4 : 0.12);
  });

  if (performanceMode) return null;

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[2.08, 0]} />
      <meshBasicMaterial
        color={isRolling ? '#FF71CE' : '#B8860B'}
        wireframe
        transparent
        opacity={isRolling ? 0.28 : 0.18}
      />
    </mesh>
  );
};

// 正二十面體組件
const IcosahedronDice: React.FC<{
  outcome: DiceOutcome;
  isRolling: boolean;
  faceTexts: string[];
  faceVariants: FaceVariant[];
  faceHighlights: boolean[];
  selectedFaceIndex?: number | null;
  performanceMode: boolean;
}> = ({ outcome, isRolling, faceTexts, faceVariants, faceHighlights, selectedFaceIndex, performanceMode }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isPageVisibleRef = useRef<boolean>(true);
  const [detectedFaceIndex, setDetectedFaceIndex] = useState<number | null>(null);
  const rotationCompleteRef = useRef(false);
  const verificationRetryCountRef = useRef(0); // 驗證重試計數器，防止無限循環
  
  // 物理模擬：角速度（用於真實世界的轉動）
  const angularVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const targetAngularVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const randomOffsetRef = useRef(new THREE.Vector3(0, 0, 0)); // 穩定的隨機偏移，避免每幀變化

  // 創建正二十面體的頂點和面 - 使用標準定義
  const faces = useMemo(() => {
    return createStandardIcosahedron();
  }, []);

  // ponytail: pause animation when tab not visible
  useEffect(() => {
    const onVis = () => { isPageVisibleRef.current = document.visibilityState === 'visible'; };
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 檢測當前朝向相機的面
  const detectFacingFace = useCallback(() => {
    if (!groupRef.current || faces.length === 0) return -1;
    
    const cameraDirection = new THREE.Vector3(0, 0, 1); // 相機方向（Z軸正方向）
    let maxDot = -Infinity;
    let facingFaceIndex = 0;
    
    // 遍歷所有面，找到法向量與相機方向點積最大的面
    faces.forEach((face, index) => {
      // 將面的法向量轉換到世界坐標系
      const worldNormal = face.normal.clone();
      worldNormal.applyQuaternion(groupRef.current!.quaternion);
      
      // 計算點積（越大表示越朝向相機）
      const dot = worldNormal.dot(cameraDirection);
      
      if (dot > maxDot) {
        maxDot = dot;
        facingFaceIndex = index;
      }
    });
    
    return facingFaceIndex;
  }, [faces]);

  // 計算讓指定面朝向相機的旋轉（使用四元數，更精確）
  const calculateTargetQuaternion = useCallback((faceIndex: number) => {
    if (faces.length === 0 || faceIndex < 0 || faceIndex >= faces.length) {
      return new THREE.Quaternion();
    }
    
    // 指定面的法向量
    const faceNormal = faces[faceIndex].normal.clone().normalize();
    
    // 目標方向是朝向相機（Z軸正方向，即 [0, 0, 1]）
    const targetDirection = new THREE.Vector3(0, 0, 1);
    
    // 計算旋轉四元數，將法向量對齊到目標方向
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(faceNormal, targetDirection);
    
    return quaternion;
  }, [faces]);

  // 當開始滾動時，重置旋轉完成標記和物理狀態
  useEffect(() => {
    if (isRolling) {
      rotationCompleteRef.current = false;
      verificationRetryCountRef.current = 0; // 重置驗證重試計數
      // 重置角速度，給一個更平滑的初始隨機角速度
      angularVelocityRef.current.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
      );
      targetAngularVelocityRef.current.set(0, 0, 0);
      // 生成穩定的隨機偏移（在滾動期間保持不變，降低幅度）
      randomOffsetRef.current.set(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      );
    } else {
      // 停止滾動時，清除角速度以便快速對齊到目標面
      angularVelocityRef.current.set(0, 0, 0);
    }
  }, [isRolling]);

  // 計算目標旋轉四元數（讓上色的那一面完整朝向使用者）
  const targetQuaternion = useMemo(() => {
    // 必須使用上色的那一面（selectedFaceIndex），如果還沒有則不旋轉
    // 只有在 selectedFaceIndex 設置後才開始旋轉
    const faceIndex = selectedFaceIndex !== null && selectedFaceIndex !== undefined
      ? selectedFaceIndex
      : null; // 如果還沒有上色，返回 null，不旋轉
    
    // 如果目標面改變，重置旋轉完成標記
    if (faceIndex !== null && faceIndex !== detectedFaceIndex && !isRolling) {
      rotationCompleteRef.current = false;
    }
    
    return faceIndex !== null ? calculateTargetQuaternion(faceIndex) : new THREE.Quaternion();
  }, [selectedFaceIndex, detectedFaceIndex, calculateTargetQuaternion, isRolling]);

  // 真實世界的物理轉動模擬
  useFrame((state, delta) => {
    if (!isPageVisibleRef.current) return;
    if (isRolling && groupRef.current) {
      // 滾動時：模擬真實世界的物理轉動
      rotationCompleteRef.current = false;
      
      if (selectedFaceIndex !== null && selectedFaceIndex !== undefined) {
        // 簡化滾動邏輯：使用穩定的旋轉，朝向目標面但不過度修正
        const currentQuat = groupRef.current.quaternion;
        const targetQuat = targetQuaternion;
        
        // 計算朝向目標的角速度（溫和的引導）
        const diffQuat = new THREE.Quaternion().multiplyQuaternions(
          targetQuat.clone().invert(),
          currentQuat
        );
        
        const axis = new THREE.Vector3();
        const angle = Math.acos(Math.max(-1, Math.min(1, diffQuat.w))) * 2;
        
        if (angle > 0.0001) {
          const s = Math.sin(angle / 2);
          axis.set(diffQuat.x / s, diffQuat.y / s, diffQuat.z / s).normalize();
        } else {
          axis.set(0, 0, 1);
        }
        
        // 使用更溫和的目標速度
        const targetSpeed = 3.0; // 降低速度使動畫更自然
        
        // 計算目標角速度（朝著目標方向）加上穩定的隨機偏移
        targetAngularVelocityRef.current.copy(axis).multiplyScalar(angle * targetSpeed);
        targetAngularVelocityRef.current.add(randomOffsetRef.current);
      } else {
        // 如果還不知道目標面，則使用溫和的隨機旋轉
        targetAngularVelocityRef.current.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        );
      }
      
      // 平滑地插值到目標角速度（更高的阻尼係數）
      const damping = 0.15; // 使用更溫和的插值
      angularVelocityRef.current.lerp(targetAngularVelocityRef.current, damping);
      
      // 應用角速度到旋轉
      const rotationQuat = new THREE.Quaternion();
      const axis = new THREE.Vector3();
      const length = angularVelocityRef.current.length();
      if (length > 0.0001) {
        axis.copy(angularVelocityRef.current).normalize();
        rotationQuat.setFromAxisAngle(axis, length * delta);
        groupRef.current.quaternion.multiplyQuaternions(rotationQuat, groupRef.current.quaternion);
      }
      
      // 模擬摩擦力：逐漸減速
      angularVelocityRef.current.multiplyScalar(0.96);
      
    } else if (groupRef.current && !isRolling && selectedFaceIndex !== null && selectedFaceIndex !== undefined) {
      // 如果已經完成對齊，完全停止所有操作（避免抖動）
      if (rotationCompleteRef.current) {
        angularVelocityRef.current.set(0, 0, 0);
        return;
      }
      
      // 停止滾動後：快速對齊到目標面
      const currentQuat = groupRef.current.quaternion;
      const targetQuat = targetQuaternion;
      
      // 計算當前角度差
      const angle = currentQuat.angleTo(targetQuat);
      
      // 直接使用球面插值對齊到目標面（快速且流暢）
      const speed = 8.0; // 使用較快的速度確保快速對齊
      const lerpFactor = Math.min(1, delta * speed);
      currentQuat.slerp(targetQuat, lerpFactor);
      
      // 當非常接近目標時，直接設置為目標值並停止
      const threshold = 0.01; // 放寬閾值
      if (angle < threshold) {
        // 強制對齊到目標面
        groupRef.current.quaternion.copy(targetQuat);
        angularVelocityRef.current.set(0, 0, 0);
        
        // 標記為完成
        rotationCompleteRef.current = true;
        
        // 驗證並同步狀態
        const actualFacingFace = detectFacingFace();
        if (actualFacingFace === selectedFaceIndex) {
          if (detectedFaceIndex !== selectedFaceIndex) {
            setDetectedFaceIndex(selectedFaceIndex);
          }
          verificationRetryCountRef.current = 0;
        } else {
          verificationRetryCountRef.current += 1;
          if (verificationRetryCountRef.current < 3) {
            console.warn(`Rotation verification failed (attempt ${verificationRetryCountRef.current}): expected face ${selectedFaceIndex}, got ${actualFacingFace}. Re-aligning...`);
            rotationCompleteRef.current = false;
          } else {
            console.warn(`Rotation verification failed after ${verificationRetryCountRef.current} attempts. Forcing alignment to face ${selectedFaceIndex}.`);
            setDetectedFaceIndex(selectedFaceIndex);
            verificationRetryCountRef.current = 0;
          }
        }
      }
    }
  });

  // 確保有20個面
  useEffect(() => {
    if (faces.length !== 20 && import.meta.env.DEV) {
      console.warn(`Expected 20 faces, got ${faces.length}`);
    }
  }, [faces.length]);

  if (faces.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {!performanceMode && (
        <mesh>
          <icosahedronGeometry args={[1.88, 0]} />
          <meshBasicMaterial color="#05FFA1" transparent opacity={0.05} />
        </mesh>
      )}
      <DiceWireAura performanceMode={performanceMode} isRolling={isRolling} />
      {faces.map((face, index) => (
        <DiceFace
          key={`face-${index}`}
          vertices={face.vertices}
          normal={face.normal}
          text={faceTexts[index] || '大吉'}
          variant={faceVariants[index] || 'neutral'}
          isHighlighted={faceHighlights[index] || false}
          performanceMode={performanceMode}
        />
      ))}
    </group>
  );
};

const RiskDice: React.FC<RiskDiceProps> = ({ outcome, isRolling, selectedFaceIndex: propSelectedFaceIndex, performanceMode = false }) => {
  // 使用傳入的預先決定的面索引，如果沒有則為 null
  const selectedFaceIndex = propSelectedFaceIndex !== undefined ? propSelectedFaceIndex : null;

  // 計算每個面的文字、顏色和高亮狀態
  // 使用預先決定的面索引（selectedFaceIndex）作為抽中的面，根據結果上色
  const { faceTexts, faceVariants, faceHighlights } = useMemo(() => {
    const texts: string[] = [];
    const variants: FaceVariant[] = [];
    const highlights: boolean[] = [];

    for (let i = 0; i < 20; i++) {
      let text = '大吉';
      let variant: FaceVariant = 'neutral';
      let highlight = false;

      if (i === selectedFaceIndex && selectedFaceIndex !== null) {
        if (outcome === DiceOutcome.GREAT_MISFORTUNE) {
          text = '大凶';
          variant = 'calamity';
          highlight = true;
        } else if (outcome === DiceOutcome.GREAT_FORTUNE) {
          text = '大吉';
          variant = 'fortune';
          highlight = true;
        } else if (outcome === DiceOutcome.ROLLING) {
          text = '??';
          variant = 'rolling';
        } else {
          text = '??';
          variant = 'mystery';
        }
      }

      texts.push(text);
      variants.push(variant);
      highlights.push(highlight);
    }

    return { faceTexts: texts, faceVariants: variants, faceHighlights: highlights };
  }, [outcome, selectedFaceIndex]);

  return (
    <div className={`relative w-64 h-64 z-20 dice-slot ${isRolling ? 'dice-slot-rolling' : ''}`} style={{ minHeight: '256px' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 100 }}
        frameloop={isRolling ? 'always' : 'demand'}
        dpr={performanceMode ? [1, 1.25] : [1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
        gl={{ 
          antialias: !performanceMode, 
          alpha: true,
          powerPreference: "high-performance"
        }}
        shadows={false}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0); // 透明背景
        }}
      >
        <ambientLight intensity={performanceMode ? 0.8 : 1.2} />
        <directionalLight position={[5, 5, 5]} intensity={performanceMode ? 1.2 : 2.0} color="#B8860B" />
        <directionalLight position={[-5, -5, -5]} intensity={performanceMode ? 0.7 : 1.2} color="#01CDFE" />
        <pointLight position={[0, 0, 10]} intensity={performanceMode ? 0.8 : 1.5} color="#05FFA1" />
        <pointLight position={[0, -5, 5]} intensity={0.6} color="#FF71CE" />
        <IcosahedronDice 
          outcome={outcome}
          isRolling={isRolling}
          faceTexts={faceTexts}
          faceVariants={faceVariants}
          faceHighlights={faceHighlights}
          selectedFaceIndex={selectedFaceIndex}
          performanceMode={performanceMode}
        />
      </Canvas>
    </div>
  );
};

const RiskDiceMemo = memo(RiskDice, (prev, next) => {
  return (
    prev.outcome === next.outcome &&
    prev.isRolling === next.isRolling &&
    prev.selectedFaceIndex === next.selectedFaceIndex &&
    (prev.performanceMode ?? false) === (next.performanceMode ?? false)
  );
});

export default RiskDiceMemo;
