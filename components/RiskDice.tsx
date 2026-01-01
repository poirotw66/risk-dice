import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DiceOutcome } from '../types';

interface RiskDiceProps {
  outcome: DiceOutcome;
  isRolling: boolean;
}

// 單個面的組件
const DiceFace: React.FC<{
  vertices: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  normal: THREE.Vector3;
  text: string;
  color: string;
  isHighlighted: boolean;
}> = ({ vertices, normal, text, color, isHighlighted }) => {
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

  // 創建文字紋理
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 512, 512);

    const textColor = isHighlighted 
      ? (color === '#7f1d1d' ? '#fecaca' : '#fef3c7')
      : '#64748b';
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 180px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(text, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color, isHighlighted]);

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
        <meshStandardMaterial
          color={color}
          metalness={0.2}
          roughness={0.8}
          side={THREE.DoubleSide}
          emissive={isHighlighted ? new THREE.Color(color).multiplyScalar(0.4) : new THREE.Color(0x000000)}
          emissiveIntensity={isHighlighted ? 0.6 : 0}
        />
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

  console.log(`Created ${faceData.length} faces for standard icosahedron`);
  
  // 驗證所有面都是等邊三角形
  if (faceData.length > 0) {
    const firstFace = faceData[0];
    const d1 = firstFace.vertices[0].distanceTo(firstFace.vertices[1]);
    const d2 = firstFace.vertices[1].distanceTo(firstFace.vertices[2]);
    const d3 = firstFace.vertices[2].distanceTo(firstFace.vertices[0]);
    console.log('First face edge lengths:', { d1, d2, d3, avg: (d1 + d2 + d3) / 3 });
  }
  
  return faceData;
};

// 正二十面體組件
const IcosahedronDice: React.FC<{
  outcome: DiceOutcome;
  isRolling: boolean;
  faceTexts: string[];
  faceColors: string[];
  faceHighlights: boolean[];
}> = ({ outcome, isRolling, faceTexts, faceColors, faceHighlights }) => {
  const groupRef = useRef<THREE.Group>(null);

  // 創建正二十面體的頂點和面 - 使用標準定義
  const faces = useMemo(() => {
    return createStandardIcosahedron();
  }, []);

  // 計算讓第一個面朝向相機的旋轉
  const targetRotation = useMemo(() => {
    if (faces.length === 0) return { x: 0, y: 0, z: 0 };
    
    // 第一個面的法向量（應該朝向使用者/相機）
    const face0Normal = faces[0].normal.clone().normalize();
    
    // 目標方向是朝向相機（Z軸正方向，即 [0, 0, 1]）
    const targetDirection = new THREE.Vector3(0, 0, 1);
    
    // 計算旋轉四元數，將法向量對齊到目標方向
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(face0Normal, targetDirection);
    
    // 將四元數轉換為歐拉角（使用 'XYZ' 順序）
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
    
    return {
      x: euler.x,
      y: euler.y,
      z: euler.z,
    };
  }, [faces]);

  // 旋轉動畫 - 加快速度
  useFrame((state, delta) => {
    if (isRolling && groupRef.current) {
      // 滾動時隨機旋轉
      groupRef.current.rotation.x += delta * 5;
      groupRef.current.rotation.y += delta * 4;
      groupRef.current.rotation.z += delta * 3;
    } else if (groupRef.current && !isRolling) {
      // 停止時平滑旋轉到目標位置，讓第一個面朝向相機
      const current = groupRef.current.rotation;
      const target = targetRotation;
      const speed = 10; // 旋轉速度
      
      // 使用更平滑的插值
      const lerpFactor = Math.min(1, delta * speed);
      current.x = THREE.MathUtils.lerp(current.x, target.x, lerpFactor);
      current.y = THREE.MathUtils.lerp(current.y, target.y, lerpFactor);
      current.z = THREE.MathUtils.lerp(current.z, target.z, lerpFactor);
      
      // 當接近目標時，直接設置為目標值以避免微小抖動
      const threshold = 0.01;
      if (Math.abs(current.x - target.x) < threshold &&
          Math.abs(current.y - target.y) < threshold &&
          Math.abs(current.z - target.z) < threshold) {
        current.set(target.x, target.y, target.z);
      }
    }
  });

  // 確保有20個面
  useEffect(() => {
    if (faces.length !== 20) {
      console.warn(`Expected 20 faces, got ${faces.length}`);
    } else {
      console.log('Icosahedron created successfully with 20 faces');
    }
  }, [faces.length]);

  if (faces.length === 0) {
    return null;
  }


  return (
    <group ref={groupRef} rotation={[0, 0, 0]}>
      {faces.map((face, index) => (
        <DiceFace
          key={`face-${index}`}
          vertices={face.vertices}
          normal={face.normal}
          text={faceTexts[index] || '大吉'}
          color={faceColors[index] || '#1e293b'}
          isHighlighted={faceHighlights[index] || false}
        />
      ))}
    </group>
  );
};

const RiskDice: React.FC<RiskDiceProps> = ({ outcome, isRolling }) => {
  // 計算每個面的文字、顏色和高亮狀態
  const { faceTexts, faceColors, faceHighlights } = useMemo(() => {
    const texts: string[] = [];
    const colors: string[] = [];
    const highlights: boolean[] = [];
    
    const isMainBad = outcome === DiceOutcome.GREAT_MISFORTUNE;
    const hiddenBadIndex = isMainBad ? -1 : Math.floor(Math.random() * 19) + 1;

    for (let i = 0; i < 20; i++) {
      let text = '大吉';
      let color = '#1e293b'; // slate-800
      let highlight = false;

      if (i === 0) {
        // 第一個面（顯示的面）
        if (outcome === DiceOutcome.GREAT_MISFORTUNE) {
          text = '大凶';
          color = '#7f1d1d'; // red-950
          highlight = true;
        } else if (outcome === DiceOutcome.GREAT_FORTUNE) {
          text = '大吉';
          color = '#ca8a04'; // yellow-600
          highlight = true;
        } else {
          text = '??';
          color = '#475569'; // slate-600
        }
      } else {
        if (i === hiddenBadIndex) {
          text = '大凶';
          color = '#0f172a'; // slate-950
        }
      }

      texts.push(text);
      colors.push(color);
      highlights.push(highlight);
    }

    return { faceTexts: texts, faceColors: colors, faceHighlights: highlights };
  }, [outcome]);

  return (
    <div className="relative w-64 h-64 z-20" style={{ minHeight: '256px' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 100 }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0); // 透明背景
        }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <directionalLight position={[-5, -5, -5]} intensity={1} />
        <pointLight position={[0, 0, 10]} intensity={0.8} />
        <IcosahedronDice 
          outcome={outcome}
          isRolling={isRolling}
          faceTexts={faceTexts}
          faceColors={faceColors}
          faceHighlights={faceHighlights}
        />
      </Canvas>
    </div>
  );
};

export default RiskDice;
