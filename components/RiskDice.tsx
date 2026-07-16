import React, { useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
  calamity: { base: '#4a0510', emissive: '#ff1744' },
  rolling: { base: '#0c2d4a', emissive: '#06b6d4' },
  mystery: { base: '#1e1b4b', emissive: '#6366f1' },
};

const CALAMITY_FACE_INDEX = 0; // ponytail: single permanent skull face (matches game logic)
const DICE_RADIUS = 2;

/** Extract 20 equilateral faces from Three.js canonical icosahedron */
const createIcosahedronFaces = (radius: number) => {
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  const position = geometry.attributes.position;
  const faces: { vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; normal: THREE.Vector3 }[] = [];

  for (let i = 0; i < position.count; i += 3) {
    const v1 = new THREE.Vector3().fromBufferAttribute(position, i);
    const v2 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const v3 = new THREE.Vector3().fromBufferAttribute(position, i + 2);

    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    const center = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);

    if (normal.dot(center) < 0) {
      faces.push({ vertices: [v1, v3, v2], normal: normal.clone().negate() });
    } else {
      faces.push({ vertices: [v1, v2, v3], normal });
    }
  }

  geometry.dispose();
  return faces;
};

const DiceEdges: React.FC<{ radius: number }> = ({ radius }) => {
  const edgeGeometry = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(radius, 0);
    const edges = new THREE.EdgesGeometry(ico);
    ico.dispose();
    return edges;
  }, [radius]);

  return (
    <lineSegments geometry={edgeGeometry}>
      <lineBasicMaterial color="#B8860B" transparent opacity={0.4} />
    </lineSegments>
  );
};

const drawSkull = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  highlighted: boolean
): void => {
  const fill = highlighted ? '#fff5f5' : '#c9a0a0';
  const stroke = highlighted ? '#ff1744' : '#7f1d1d';
  const glow = highlighted ? '#ff006e' : '#b91c1c';

  ctx.save();
  if (highlighted) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 40;
  }

  // Crossbones behind skull when highlighted
  if (highlighted) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.75, y - size * 0.55);
    ctx.lineTo(x + size * 0.75, y + size * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.75, y - size * 0.55);
    ctx.lineTo(x - size * 0.75, y + size * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Cranium
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.12, size * 0.58, size * 0.65, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = highlighted ? 6 : 4;
  ctx.stroke();

  // Jaw
  ctx.beginPath();
  ctx.moveTo(x - size * 0.48, y + size * 0.12);
  ctx.quadraticCurveTo(x, y + size * 0.58, x + size * 0.48, y + size * 0.12);
  ctx.lineTo(x + size * 0.4, y + size * 0.32);
  ctx.quadraticCurveTo(x, y + size * 0.5, x - size * 0.4, y + size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eye sockets with glowing pupils when highlighted
  const eyeY = y - size * 0.1;
  const eyeOffsetX = size * 0.24;
  ctx.fillStyle = highlighted ? '#1a0505' : '#2d0a0a';
  [[x - eyeOffsetX, eyeY], [x + eyeOffsetX, eyeY]].forEach(([ex, ey]) => {
    ctx.beginPath();
    ctx.ellipse(ex, ey, size * 0.17, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    if (highlighted) {
      ctx.fillStyle = '#ff1744';
      ctx.beginPath();
      ctx.arc(ex, ey, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0505';
    }
  });

  // Nose cavity
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.02);
  ctx.lineTo(x - size * 0.11, y + size * 0.2);
  ctx.lineTo(x + size * 0.11, y + size * 0.2);
  ctx.closePath();
  ctx.fillStyle = highlighted ? '#7f1d1d' : '#450a0a';
  ctx.fill();

  // Teeth row
  const teethY = y + size * 0.26;
  const toothW = size * 0.075;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    const tx = x + i * toothW * 1.15;
    ctx.fillRect(tx - toothW / 2, teethY, toothW * 0.8, size * 0.13);
    ctx.strokeRect(tx - toothW / 2, teethY, toothW * 0.8, size * 0.13);
  }

  // Cracks on skull when highlighted
  if (highlighted) {
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.15, y - size * 0.45);
    ctx.lineTo(x - size * 0.05, y - size * 0.2);
    ctx.lineTo(x + size * 0.1, y - size * 0.35);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
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

  if (variant === 'calamity') {
    // Dark vignette for ominous feel
    const vignette = ctx.createRadialGradient(256, 256, 80, 256, 256, 280);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 512, 512);

    drawSkull(ctx, 256, 175, highlighted ? 125 : 110, highlighted);

    // 大凶 text below skull
    ctx.font = 'bold 72px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (highlighted) {
      ctx.shadowColor = s.glow;
      ctx.shadowBlur = 25;
    }
    const calamityChars = text.split('');
    const calamitySpacing = 78;
    const calamityStartY = 370 - (calamityChars.length - 1) * calamitySpacing / 2;
    calamityChars.forEach((char, index) => {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = highlighted ? 4 : 2;
      ctx.strokeText(char, 256, calamityStartY + index * calamitySpacing);
      ctx.fillStyle = highlighted ? '#fecaca' : '#d4a5a5';
      ctx.fillText(char, 256, calamityStartY + index * calamitySpacing);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

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
  const isCalamity = variant === 'calamity';
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
            side={THREE.FrontSide}
            emissive={isCalamity ? new THREE.Color(palette.emissive) : isHighlighted ? new THREE.Color(palette.emissive) : new THREE.Color(0x000000)}
            emissiveIntensity={isCalamity ? (isHighlighted ? 1.0 : 0.25) : isHighlighted ? 0.6 : 0.05}
          />
        ) : (
          <meshPhysicalMaterial
            color={palette.base}
            metalness={0.9}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.08}
            side={THREE.FrontSide}
            emissive={new THREE.Color(palette.emissive)}
            emissiveIntensity={isCalamity ? (isHighlighted ? 1.2 : 0.35) : isHighlighted ? 0.85 : 0.08}
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

const DiceWireAura: React.FC<{ performanceMode: boolean; isRolling: boolean }> = ({ performanceMode, isRolling }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * (isRolling ? 0.4 : 0.12);
  });

  if (performanceMode) return null;

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[DICE_RADIUS * 1.04, 0]} />
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
  isRolling: boolean;
  faceTexts: string[];
  faceVariants: FaceVariant[];
  faceHighlights: boolean[];
  selectedFaceIndex?: number | null;
  performanceMode: boolean;
}> = ({ isRolling, faceTexts, faceVariants, faceHighlights, selectedFaceIndex, performanceMode }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isPageVisibleRef = useRef<boolean>(true);
  const rotationCompleteRef = useRef(false);
  const angularVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isSettlingRef = useRef(false);
  const invalidate = useThree((s) => s.invalidate);

  const faces = useMemo(() => createIcosahedronFaces(DICE_RADIUS), []);

  // ponytail: pause animation when tab not visible
  useEffect(() => {
    const onVis = () => { isPageVisibleRef.current = document.visibilityState === 'visible'; };
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 計算讓指定面朝向相機的旋轉（使用四元數，更精確）
  const calculateTargetQuaternion = useCallback((faceIndex: number) => {
    if (faces.length === 0 || faceIndex < 0 || faceIndex >= faces.length) {
      return new THREE.Quaternion();
    }
    
    // 指定面的法向量
    const faceNormal = faces[faceIndex].normal.clone().normalize();
    
    // R3F camera 在 z=+8 並看向原點，所以「朝向相機」的方向是 -Z
    const targetDirection = new THREE.Vector3(0, 0, -1);
    
    // 計算旋轉四元數，將法向量對齊到目標方向
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(faceNormal, targetDirection);
    
    return quaternion;
  }, [faces]);

  // Start roll: random tumble axis — no steering toward outcome during roll
  useEffect(() => {
    if (isRolling) {
      rotationCompleteRef.current = false;
      isSettlingRef.current = false;

      const axis = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      const speed = 14 + Math.random() * 10;
      angularVelocityRef.current.copy(axis).multiplyScalar(speed);
    } else if (selectedFaceIndex !== null && selectedFaceIndex !== undefined) {
      isSettlingRef.current = true;
      angularVelocityRef.current.set(0, 0, 0);
    }
  }, [isRolling, selectedFaceIndex]);

  const targetQuaternion = useMemo(() => {
    if (selectedFaceIndex === null || selectedFaceIndex === undefined) {
      return new THREE.Quaternion();
    }
    return calculateTargetQuaternion(selectedFaceIndex);
  }, [selectedFaceIndex, calculateTargetQuaternion]);

  // Physics: free tumble while rolling, ease-out settle when stopped
  useFrame((_, delta) => {
    if (!isPageVisibleRef.current || !groupRef.current) return;
    const dt = Math.min(delta, 0.05);

    if (isRolling) {
      const omega = angularVelocityRef.current;
      const speed = omega.length();
      if (speed > 0.001) {
        const spinAxis = omega.clone().normalize();
        const spin = new THREE.Quaternion().setFromAxisAngle(spinAxis, speed * dt);
        groupRef.current.quaternion.premultiply(spin);
        omega.multiplyScalar(Math.exp(-2.8 * dt));
      }
      invalidate();
      return;
    }

    if (!isSettlingRef.current || selectedFaceIndex === null || selectedFaceIndex === undefined) return;
    if (rotationCompleteRef.current) return;

    const currentQuat = groupRef.current.quaternion;
    const targetQuat = targetQuaternion;
    const angle = currentQuat.angleTo(targetQuat);
    const settleFactor = 1 - Math.exp(-7 * dt);
    currentQuat.slerp(targetQuat, settleFactor);
    invalidate();

    if (angle < 0.008) {
      groupRef.current.quaternion.copy(targetQuat);
      rotationCompleteRef.current = true;
      isSettlingRef.current = false;
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
          <icosahedronGeometry args={[DICE_RADIUS * 0.94, 0]} />
          <meshBasicMaterial color="#05FFA1" transparent opacity={0.05} />
        </mesh>
      )}
      <DiceEdges radius={DICE_RADIUS} />
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

      // Permanent skull face — always face index 0
      if (i === CALAMITY_FACE_INDEX) {
        text = '大凶';
        variant = 'calamity';
        highlight = outcome === DiceOutcome.GREAT_MISFORTUNE;
      } else if (i === selectedFaceIndex && selectedFaceIndex !== null) {
        if (outcome === DiceOutcome.GREAT_FORTUNE) {
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
    <div className={`relative w-64 h-64 z-20 dice-slot ${isRolling ? 'dice-slot-rolling' : ''} ${outcome === DiceOutcome.GREAT_MISFORTUNE ? 'dice-slot-calamity' : ''}`} style={{ minHeight: '256px' }}>
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
