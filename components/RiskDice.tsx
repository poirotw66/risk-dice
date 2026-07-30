import React, { useMemo, useRef, useEffect, useState, useCallback, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DiceOutcome } from '../types';

interface RiskDiceProps {
  outcome: DiceOutcome;
  isRolling: boolean;
  selectedFaceIndex?: number | null; // 預先決定的抽中面（0-19）
  performanceMode?: boolean; // ponytail: simple perf toggle
}

type FaceVariant = 'fortune' | 'calamity' | 'neutral';

const FACE_PALETTE: Record<FaceVariant, { emissive: string }> = {
  neutral: { emissive: '#1a1035' },
  fortune: { emissive: '#10b981' },
  calamity: { emissive: '#ff1744' },
};

const CALAMITY_FACE_INDEX = 0; // ponytail: single permanent skull face (matches game logic)
const DICE_RADIUS = 2;

/* --- Texture space -------------------------------------------------------
 * Every face is drawn into a 512×512 canvas that is UV-mapped straight onto
 * the triangle, so the artwork lands exactly inside the face (no overhanging
 * quads) and always ends up upright once the face is turned to the camera.
 * The triangle is always laid out point-up around the canvas centre.
 */
const TEX_SIZE = 512;
const TEX_CENTER = TEX_SIZE / 2;
const TEX_CIRCUMRADIUS = 236; // centre → vertex, in texture pixels
const TRI_APEX_Y = TEX_CENTER - TEX_CIRCUMRADIUS; // 20
const TRI_BASE_Y = TEX_CENTER + TEX_CIRCUMRADIUS / 2; // 374
const TRI_BASE_HALF = (TEX_CIRCUMRADIUS * Math.sqrt(3)) / 2; // 204.4

interface DiceFaceData {
  vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  normal: THREE.Vector3;
  center: THREE.Vector3;
  uvs: Float32Array;
  /** Rotation that brings this face to the camera with its artwork upright */
  quaternion: THREE.Quaternion;
}

/** Extract 20 equilateral faces from Three.js canonical icosahedron */
const createIcosahedronFaces = (radius: number): DiceFaceData[] => {
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  const position = geometry.attributes.position;
  const faces: DiceFaceData[] = [];

  for (let i = 0; i < position.count; i += 3) {
    const v1 = new THREE.Vector3().fromBufferAttribute(position, i);
    let v2 = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    let v3 = new THREE.Vector3().fromBufferAttribute(position, i + 2);

    const normal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(v2, v1), new THREE.Vector3().subVectors(v3, v1))
      .normalize();
    const center = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);

    // Keep the winding counter-clockwise as seen from outside the solid
    if (normal.dot(center) < 0) {
      const swap = v2;
      v2 = v3;
      v3 = swap;
      normal.negate();
    }

    // In-plane frame: +V points from the face centre towards the first vertex,
    // so the texture triangle is always point-up.
    const up = new THREE.Vector3().subVectors(v1, center).normalize();
    const right = up.clone().cross(normal); // right-handed with (right, up, normal)

    const scale = TEX_CIRCUMRADIUS / v1.distanceTo(center); // px per world unit
    const uvs = new Float32Array(6);
    [v1, v2, v3].forEach((v, k) => {
      const p = new THREE.Vector3().subVectors(v, center);
      uvs[k * 2] = 0.5 + (p.dot(right) * scale) / TEX_SIZE;
      uvs[k * 2 + 1] = 0.5 + (p.dot(up) * scale) / TEX_SIZE;
    });

    // Maps (right, up, normal) → (X, Y, Z): face towards the camera, art upright
    const basis = new THREE.Matrix4().makeBasis(right, up, normal);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis).invert();

    faces.push({ vertices: [v1, v2, v3], normal, center, uvs, quaternion });
  }

  geometry.dispose();
  return faces;
};

const DiceEdges: React.FC<{ radius: number }> = ({ radius }) => {
  const edgeGeometry = useMemo(() => {
    // Slightly inflated so the gold rim never z-fights with the face triangles
    const ico = new THREE.IcosahedronGeometry(radius * 1.004, 0);
    const edges = new THREE.EdgesGeometry(ico);
    ico.dispose();
    return edges;
  }, [radius]);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  return (
    <lineSegments geometry={edgeGeometry}>
      <lineBasicMaterial color="#B8860B" transparent opacity={0.55} />
    </lineSegments>
  );
};

/** Half-width of the texture triangle at a given canvas y (for layout checks) */
const triangleHalfWidthAt = (y: number) =>
  Math.max(0, ((y - TRI_APEX_Y) / (TRI_BASE_Y - TRI_APEX_Y)) * TRI_BASE_HALF);

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
    ctx.shadowBlur = 30;
  }

  // Crossbones behind skull when highlighted
  if (highlighted) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.72, y - size * 0.4);
    ctx.lineTo(x + size * 0.72, y + size * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.72, y - size * 0.4);
    ctx.lineTo(x - size * 0.72, y + size * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Cranium
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.12, size * 0.58, size * 0.65, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = highlighted ? 5 : 3.5;
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
  ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    const tx = x + i * toothW * 1.15;
    ctx.fillRect(tx - toothW / 2, teethY, toothW * 0.8, size * 0.13);
    ctx.strokeRect(tx - toothW / 2, teethY, toothW * 0.8, size * 0.13);
  }

  ctx.restore();
};

interface FaceStyle {
  grad: [string, string, string];
  text: string;
  stroke: string;
  glow: string;
}

const FACE_STYLES: Record<FaceVariant, FaceStyle> = {
  neutral: { grad: ['#2b1f4d', '#150d28', '#1d1233'], text: '#c9a227', stroke: '#6b5433', glow: '#b8860b' },
  fortune: { grad: ['#065f46', '#064e3b', '#047857'], text: '#fde68a', stroke: '#b45309', glow: '#fbbf24' },
  calamity: { grad: ['#450a0a', '#2d0a0a', '#7f1d1d'], text: '#fecaca', stroke: '#991b1b', glow: '#ef4444' },
};

/** Inset triangle outline that follows the real face edges */
const strokeInsetTriangle = (ctx: CanvasRenderingContext2D, inset: number) => {
  const pts: [number, number][] = [
    [TEX_CENTER, TEX_CENTER + (TRI_APEX_Y - TEX_CENTER) * inset],
    [TEX_CENTER - TRI_BASE_HALF * inset, TEX_CENTER + (TRI_BASE_Y - TEX_CENTER) * inset],
    [TEX_CENTER + TRI_BASE_HALF * inset, TEX_CENTER + (TRI_BASE_Y - TEX_CENTER) * inset],
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
  ctx.stroke();
};

const createFaceTexture = (text: string, variant: FaceVariant, highlighted: boolean): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  const s = FACE_STYLES[variant];

  // Backdrop covers the whole canvas so texture filtering never bleeds
  // background colour in along the triangle edges.
  const grad = ctx.createRadialGradient(TEX_CENTER, TEX_CENTER, 20, TEX_CENTER, TEX_CENTER, 300);
  grad.addColorStop(0, s.grad[0]);
  grad.addColorStop(0.7, s.grad[1]);
  grad.addColorStop(1, s.grad[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Bevel: darken towards the face edges so the solid reads as faceted
  const bevel = ctx.createRadialGradient(TEX_CENTER, TEX_CENTER, 60, TEX_CENTER, TEX_CENTER, TEX_CIRCUMRADIUS);
  bevel.addColorStop(0, 'rgba(0,0,0,0)');
  bevel.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = bevel;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = highlighted ? 7 : 5;
  ctx.globalAlpha = highlighted ? 0.9 : 0.5;
  strokeInsetTriangle(ctx, 0.84);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (highlighted) {
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 24;
  }

  if (variant === 'calamity') {
    drawSkull(ctx, TEX_CENTER, 196, highlighted ? 94 : 88, highlighted);

    // 大凶 across the wide part of the triangle, near the base
    const fontSize = 86;
    ctx.font = `bold ${fontSize}px "VT323", monospace`;
    const chars = text.split('');
    const spacing = fontSize * 1.08;
    const startX = TEX_CENTER - ((chars.length - 1) * spacing) / 2;
    const baseY = 318;
    chars.forEach((char, index) => {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = highlighted ? 4 : 2.5;
      ctx.strokeText(char, startX + index * spacing, baseY);
      ctx.fillStyle = highlighted ? '#fff1f2' : '#d4a5a5';
      ctx.fillText(char, startX + index * spacing, baseY);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Fortune / neutral: characters stacked vertically down the middle of the
  // triangle, sized so they always stay inside the sloping edges.
  const chars = text.split('');
  const fontSize = chars.length > 1 ? 105 : 150;
  const spacing = chars.length > 1 ? 105 : 0;
  const firstY = chars.length > 1 ? 200 : 268;
  ctx.font = `bold ${fontSize}px "VT323", monospace`;

  chars.forEach((char, index) => {
    const y = firstY + index * spacing;
    // Never let a glyph poke past the sloping edges of the triangle
    const halfWidth = Math.min(
      triangleHalfWidthAt(y - fontSize * 0.5),
      triangleHalfWidthAt(y + fontSize * 0.5)
    );
    const maxWidth = Math.max(20, halfWidth * 1.6);
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = highlighted ? 5 : 3;
    ctx.strokeText(char, TEX_CENTER, y, maxWidth);
    ctx.fillStyle = s.text;
    ctx.fillText(char, TEX_CENTER, y, maxWidth);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

// 單個面的組件
const DiceFace: React.FC<{
  face: DiceFaceData;
  text: string;
  variant: FaceVariant;
  isHighlighted: boolean;
  performanceMode: boolean;
}> = ({ face, text, variant, isHighlighted, performanceMode }) => {
  const palette = FACE_PALETTE[variant];
  const isCalamity = variant === 'calamity';

  // 三角形幾何體：使用絕對頂點坐標並帶上 UV，讓貼圖正好貼合這個面
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const { vertices, normal, uvs } = face;
    const positions = new Float32Array([
      vertices[0].x, vertices[0].y, vertices[0].z,
      vertices[1].x, vertices[1].y, vertices[1].z,
      vertices[2].x, vertices[2].y, vertices[2].z,
    ]);
    const normals = new Float32Array([
      normal.x, normal.y, normal.z,
      normal.x, normal.y, normal.z,
      normal.x, normal.y, normal.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs.slice(), 2));
    return geom;
  }, [face]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const texture = useMemo(
    () => createFaceTexture(text, variant, isHighlighted),
    [text, variant, isHighlighted]
  );

  useEffect(() => () => texture.dispose(), [texture]);

  const emissiveIntensity = isCalamity
    ? isHighlighted
      ? 1.0
      : 0.3
    : isHighlighted
      ? 0.7
      : 0.06;

  return (
    <mesh geometry={geometry}>
      {performanceMode ? (
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          color="#ffffff"
          metalness={0.25}
          roughness={0.45}
          side={THREE.FrontSide}
          emissive={new THREE.Color(palette.emissive)}
          emissiveIntensity={emissiveIntensity}
        />
      ) : (
        <meshPhysicalMaterial
          map={texture}
          emissiveMap={texture}
          color="#ffffff"
          metalness={0.35}
          roughness={0.28}
          clearcoat={1}
          clearcoatRoughness={0.12}
          side={THREE.FrontSide}
          emissive={new THREE.Color(palette.emissive)}
          emissiveIntensity={emissiveIntensity}
          reflectivity={0.6}
        />
      )}
    </mesh>
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
      {/* 1.14× keeps the whole wireframe outside the solid — at 1.04 it sliced
          through the faces while it rotated. */}
      <icosahedronGeometry args={[DICE_RADIUS * 1.14, 0]} />
      <meshBasicMaterial
        color={isRolling ? '#FF71CE' : '#B8860B'}
        wireframe
        transparent
        opacity={isRolling ? 0.16 : 0.08}
        depthWrite={false}
      />
    </mesh>
  );
};

const ROLL_DAMPING = 0.45; // gentle, so the die is still tumbling when it stops
const SETTLE_DURATION = 0.85; // seconds to spin down and lock onto the result
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// 正二十面體組件
const IcosahedronDice: React.FC<{
  isRolling: boolean;
  isSettling: boolean;
  faceTexts: string[];
  faceVariants: FaceVariant[];
  faceHighlights: boolean[];
  selectedFaceIndex?: number | null;
  performanceMode: boolean;
  onSettled: () => void;
}> = ({ isRolling, isSettling, faceTexts, faceVariants, faceHighlights, selectedFaceIndex, performanceMode, onSettled }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isPageVisibleRef = useRef<boolean>(true);
  const angularVelocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const settleElapsedRef = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  const faces = useMemo(() => createIcosahedronFaces(DICE_RADIUS), []);

  // ponytail: pause animation when tab not visible
  useEffect(() => {
    const onVis = () => { isPageVisibleRef.current = document.visibilityState === 'visible'; };
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 讓指定面朝向相機（並且面上的文字是正的）
  const targetQuaternion = useMemo(() => {
    if (selectedFaceIndex === null || selectedFaceIndex === undefined) return null;
    if (selectedFaceIndex < 0 || selectedFaceIndex >= faces.length) return null;
    return faces[selectedFaceIndex].quaternion;
  }, [selectedFaceIndex, faces]);

  // Start roll: random tumble axis — no steering toward the outcome during the roll
  useEffect(() => {
    if (!isRolling) return;
    const axis = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    const speed = 15 + Math.random() * 9;
    angularVelocityRef.current.copy(axis).multiplyScalar(speed);
  }, [isRolling]);

  useEffect(() => {
    if (isSettling) settleElapsedRef.current = 0;
  }, [isSettling]);

  // Physics: free tumble while rolling, then spin down onto the drawn face
  useFrame((_, delta) => {
    if (!isPageVisibleRef.current || !groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const omega = angularVelocityRef.current;

    const applySpin = () => {
      const speed = omega.length();
      if (speed <= 0.0001) return;
      const spin = new THREE.Quaternion().setFromAxisAngle(omega.clone().normalize(), speed * dt);
      groupRef.current!.quaternion.premultiply(spin);
    };

    if (isRolling) {
      applySpin();
      omega.multiplyScalar(Math.exp(-ROLL_DAMPING * dt));
      invalidate();
      return;
    }

    if (!isSettling || !targetQuaternion) return;

    settleElapsedRef.current += dt;
    const t = Math.min(settleElapsedRef.current / SETTLE_DURATION, 1);

    // Residual tumble bleeds away while the pull towards the result ramps up,
    // so the die decelerates into its face instead of snapping to it.
    omega.multiplyScalar(Math.exp(-6 * dt));
    applySpin();

    const authority = smoothstep(t);
    groupRef.current.quaternion.slerp(targetQuaternion, 1 - Math.exp(-(1 + 16 * authority) * dt));

    if (t >= 1) {
      groupRef.current.quaternion.copy(targetQuaternion);
      omega.set(0, 0, 0);
      onSettled();
    }
    invalidate();
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
      <DiceEdges radius={DICE_RADIUS} />
      <DiceWireAura performanceMode={performanceMode} isRolling={isRolling} />
      {faces.map((face, index) => (
        <DiceFace
          key={`face-${index}`}
          face={face}
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

  // The die keeps animating after `isRolling` drops: it still has to spin down
  // onto the drawn face, so the render loop has to stay awake until it lands.
  const [isSettling, setIsSettling] = useState(false);
  const wasRollingRef = useRef(isRolling);

  useEffect(() => {
    if (isRolling) {
      setIsSettling(false);
    } else if (wasRollingRef.current && selectedFaceIndex !== null) {
      setIsSettling(true);
    }
    wasRollingRef.current = isRolling;
  }, [isRolling, selectedFaceIndex]);

  const handleSettled = useCallback(() => setIsSettling(false), []);

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
      } else if (i === selectedFaceIndex && outcome === DiceOutcome.GREAT_FORTUNE) {
        // Only light the winning face up once the roll has resolved, so the
        // result is never telegraphed mid-roll.
        variant = 'fortune';
        highlight = true;
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
        frameloop={isRolling || isSettling ? 'always' : 'demand'}
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
        <ambientLight intensity={performanceMode ? 0.9 : 1.1} />
        <directionalLight position={[5, 5, 5]} intensity={performanceMode ? 1.2 : 1.8} color="#FFE9B8" />
        <directionalLight position={[-5, -5, -5]} intensity={performanceMode ? 0.7 : 1.0} color="#01CDFE" />
        <pointLight position={[0, 0, 10]} intensity={performanceMode ? 0.8 : 1.2} color="#05FFA1" />
        <pointLight position={[0, -5, 5]} intensity={0.5} color="#FF71CE" />
        <IcosahedronDice
          isRolling={isRolling}
          isSettling={isSettling}
          faceTexts={faceTexts}
          faceVariants={faceVariants}
          faceHighlights={faceHighlights}
          selectedFaceIndex={selectedFaceIndex}
          performanceMode={performanceMode}
          onSettled={handleSettled}
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
