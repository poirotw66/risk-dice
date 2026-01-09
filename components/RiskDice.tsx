import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DiceOutcome } from '../types';

interface RiskDiceProps {
  outcome: DiceOutcome;
  isRolling: boolean;
  selectedFaceIndex?: number | null; // 預先決定的抽中面（0-19）
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

    // Card game style text colors with stronger contrast
    const textColor = isHighlighted 
      ? (color === '#7f1d1d' ? '#FCA5A5' : '#FDE047') // Brighter colors for highlights
      : '#94A3B8'; // Slate for non-highlighted
    
    ctx.fillStyle = textColor;
    ctx.font = 'bold 180px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add glow effect for highlighted faces
    if (isHighlighted) {
      ctx.shadowColor = textColor;
      ctx.shadowBlur = 20;
    }

    // 豎向書寫文字（從上到下）
    const chars = text.split('');
    const charSpacing = 190; // 字符間距
    const startY = 256 - (chars.length - 1) * charSpacing / 2; // 居中起始位置
    
    chars.forEach((char, index) => {
      ctx.fillText(char, 256, startY + index * charSpacing);
    });

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
          metalness={0.4}
          roughness={0.6}
          side={THREE.DoubleSide}
          emissive={isHighlighted ? new THREE.Color(color).multiplyScalar(0.6) : new THREE.Color(0x000000)}
          emissiveIntensity={isHighlighted ? 0.8 : 0}
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
  selectedFaceIndex?: number | null; // 預先決定的抽中面（0-19）
}> = ({ outcome, isRolling, faceTexts, faceColors, faceHighlights, selectedFaceIndex }) => {
  const groupRef = useRef<THREE.Group>(null);
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
    <group ref={groupRef}>
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

const RiskDice: React.FC<RiskDiceProps> = ({ outcome, isRolling, selectedFaceIndex: propSelectedFaceIndex }) => {
  // 使用傳入的預先決定的面索引，如果沒有則為 null
  const selectedFaceIndex = propSelectedFaceIndex !== undefined ? propSelectedFaceIndex : null;

  // 計算每個面的文字、顏色和高亮狀態
  // 使用預先決定的面索引（selectedFaceIndex）作為抽中的面，根據結果上色
  const { faceTexts, faceColors, faceHighlights } = useMemo(() => {
    const texts: string[] = [];
    const colors: string[] = [];
    const highlights: boolean[] = [];

    for (let i = 0; i < 20; i++) {
      let text = '大吉';
      let color = '#1e293b'; // slate-800
      let highlight = false;

      // 如果這個面是預先決定的抽中面，根據結果上色
      // 在滾動時也顯示顏色，讓用戶知道哪個面會被抽中
      if (i === selectedFaceIndex && selectedFaceIndex !== null) {
        // 如果還在滾動，根據 outcome 判斷（但 outcome 可能是 ROLLING）
        // 如果已經停止，根據最終 outcome 上色
        if (outcome === DiceOutcome.GREAT_MISFORTUNE) {
          text = '大凶';
          color = '#C2185B'; // pink-700 - vaporwave hot pink
          highlight = true;
        } else if (outcome === DiceOutcome.GREAT_FORTUNE) {
          text = '大吉';
          color = '#00897B'; // teal-700 - vaporwave mint/teal
          highlight = true;
        } else if (outcome === DiceOutcome.ROLLING) {
          // 滾動時，暫時顯示為灰色，但標記為高亮
          text = '??';
          color = '#0097A7'; // cyan-700 - vaporwave cyan
          highlight = false; // 滾動時不高亮
        } else {
          text = '??';
          color = '#0097A7'; // cyan-700
          highlight = false;
        }
      } else {
        // 其他面保持默認樣式 - darker for better contrast with cyan/pink theme
        text = '大吉';
        color = '#1A237E'; // indigo-950 - dark blue for vaporwave
        highlight = false;
      }

      texts.push(text);
      colors.push(color);
      highlights.push(highlight);
    }

    return { faceTexts: texts, faceColors: colors, faceHighlights: highlights };
  }, [outcome, selectedFaceIndex]);

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
        <ambientLight intensity={1.8} />
        <directionalLight position={[5, 5, 5]} intensity={2.5} color="#01CDFE" />
        <directionalLight position={[-5, -5, -5]} intensity={1.5} color="#FF71CE" />
        <pointLight position={[0, 0, 10]} intensity={1.2} color="#05FFA1" />
        <IcosahedronDice 
          outcome={outcome}
          isRolling={isRolling}
          faceTexts={faceTexts}
          faceColors={faceColors}
          faceHighlights={faceHighlights}
          selectedFaceIndex={selectedFaceIndex}
        />
      </Canvas>
    </div>
  );
};

export default RiskDice;
