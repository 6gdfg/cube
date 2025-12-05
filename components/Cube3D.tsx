import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Cubie, Move, FACE_COLORS, MOVES } from '../types';

interface Cube3DProps {
  moveQueue: Move[];
  onMoveComplete: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  onManualMove: (moveKey: string) => void;
}

// Geometry constants
const CUBIE_SIZE = 0.95;
const ROUNDING = 0.1;

// Helper to check if a cubie is in a slice
const isInSlice = (pos: THREE.Vector3, axis: 'x'|'y'|'z', sliceVal: number) => {
  const epsilon = 0.1;
  if (axis === 'x') return Math.abs(pos.x - sliceVal) < epsilon;
  if (axis === 'y') return Math.abs(pos.y - sliceVal) < epsilon;
  if (axis === 'z') return Math.abs(pos.z - sliceVal) < epsilon;
  return false;
};

export const Cube3D: React.FC<Cube3DProps> = ({ 
  moveQueue, 
  onMoveComplete, 
  setOrbitEnabled,
  onManualMove
}) => {
  const { camera, size } = useThree();

  // Initial state: 27 cubies
  const [cubies, setCubies] = useState<Cubie[]>(() => {
    const init: Cubie[] = [];
    let id = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          init.push({
            id: id++,
            position: new THREE.Vector3(x, y, z),
            rotation: new THREE.Quaternion(),
            name: `${x},${y},${z}`
          });
        }
      }
    }
    return init;
  });

  // Animation Refs
  const currentMoveRef = useRef<Move | null>(null);
  const progressRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const pivotRef = useRef<THREE.Group>(null);
  
  // Drag State
  const dragRef = useRef<{
    startScreen: THREE.Vector2;
    cubie: Cubie;
  } | null>(null);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    // If not animating, check queue
    if (!isAnimatingRef.current && moveQueue.length > 0) {
      const nextMove = moveQueue[0];
      currentMoveRef.current = nextMove;
      isAnimatingRef.current = true;
      progressRef.current = 0;
    }

    // Perform Animation
    if (isAnimatingRef.current && currentMoveRef.current && pivotRef.current) {
      const move = currentMoveRef.current;
      // Speed: faster if many moves in queue (scramble)
      const speed = moveQueue.length > 5 ? 20 : 6; 
      progressRef.current += delta * speed;

      if (progressRef.current >= 1) {
        finishMove(move);
      } else {
        // Apply temporary rotation to visual pivot
        // 90 degrees = PI / 2
        const angle = (Math.PI / 2) * move.direction * progressRef.current;
        const axisVec = new THREE.Vector3(
          move.axis === 'x' ? 1 : 0,
          move.axis === 'y' ? 1 : 0,
          move.axis === 'z' ? 1 : 0
        );
        pivotRef.current.setRotationFromAxisAngle(axisVec, angle);
      }
    }
  });

  const finishMove = (move: Move) => {
    const angle = (Math.PI / 2) * move.direction;
    const axisVec = new THREE.Vector3(
      move.axis === 'x' ? 1 : 0,
      move.axis === 'y' ? 1 : 0,
      move.axis === 'z' ? 1 : 0
    );
    const qRot = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);

    setCubies(prev => prev.map(c => {
      if (isInSlice(c.position, move.axis, move.slice)) {
        // Rotate Position Vector
        const newPos = c.position.clone().applyQuaternion(qRot);
        newPos.x = Math.round(newPos.x);
        newPos.y = Math.round(newPos.y);
        newPos.z = Math.round(newPos.z);

        // Rotate Orientation Quaternion
        const newRot = c.rotation.clone().premultiply(qRot);
        
        return { ...c, position: newPos, rotation: newRot };
      }
      return c;
    }));

    if (pivotRef.current) {
      pivotRef.current.rotation.set(0,0,0);
    }
    isAnimatingRef.current = false;
    currentMoveRef.current = null;
    progressRef.current = 0;
    onMoveComplete();
  };

  // --- Interaction Logic ---

  // Projects a 3D move to screen space to see if it matches the user's drag
  const determineBestMove = (cubie: Cubie, dragDelta: THREE.Vector2) => {
    let maxScore = -Infinity;
    let bestMoveKey = '';
    
    const dragDir = dragDelta.clone().normalize();

    Object.entries(MOVES).forEach(([key, move]) => {
      // 1. Check if cubie is affected by this move
      if (!isInSlice(cubie.position, move.axis, move.slice)) return;

      // 2. Simulate a small step of this move in 3D
      const angle = THREE.MathUtils.degToRad(10) * move.direction;
      const axisVec = new THREE.Vector3(
        move.axis === 'x' ? 1 : 0, 
        move.axis === 'y' ? 1 : 0, 
        move.axis === 'z' ? 1 : 0
      );
      
      const q = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
      const originalPos = cubie.position.clone();
      const rotatedPos = originalPos.clone().applyQuaternion(q);
      const delta3D = rotatedPos.sub(originalPos);

      // If cubie is at center of rotation (0,0,0), it doesn't translate, so we can't detect direction easily by position change alone.
      // However, center cubies don't exist on surface usually (except center faces).
      // Center face cubies rotate in place. We need to handle them?
      // For a center face (e.g. Front Center), rotating F doesn't move its position.
      // But rotating F is the only move that DOESN'T move it. 
      // If we drag a center piece, we usually intend to rotate a DIFFERENT axis that moves this face.
      // E.g. Drag Front Center Right -> Rotate Top/Bottom layers? Or rotate whole cube?
      // Standard Rubik UI: Dragging center piece rotates the side layers or the whole face relative to others.
      // Let's assume we can only trigger moves that actually CHANGE the position of the cubie we clicked 
      // OR we handle center pieces specifically.
      // For simplicity: If position delta is ~0, we skip (user can drag edge/corner pieces).
      // Refined: If delta3D is small, maybe we check rotation? 
      // Let's stick to translation for now. Center pieces might be hard to drag with this logic, 
      // but corner/edges work great.
      if (delta3D.lengthSq() < 0.001) return;

      // 3. Project start and end positions to Screen Space
      const p1 = originalPos.clone().project(camera);
      const p2 = rotatedPos.clone().project(camera);
      
      // Convert NDC to Screen vectors (y is inverted)
      // We only care about direction, so scale doesn't strictly matter if consistent, 
      // but let's be correct directionally.
      const p1Screen = new THREE.Vector2(p1.x, -p1.y);
      const p2Screen = new THREE.Vector2(p2.x, -p2.y);
      
      const projectedDir = p2Screen.sub(p1Screen).normalize();

      // 4. Dot product to check alignment
      const score = projectedDir.dot(dragDir);

      if (score > maxScore) {
        maxScore = score;
        bestMoveKey = key;
      }
    });

    // Threshold: Dot product > 0.5 means < 60 degrees error
    if (maxScore > 0.5) {
      return bestMoveKey;
    }
    return null;
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>, cubie: Cubie) => {
    if (isAnimatingRef.current || e.button !== 0) return;
    
    e.stopPropagation();
    // Important: Capture pointer so we keep tracking even if mouse moves off the cube
    (e.target as Element).setPointerCapture(e.pointerId);
    setOrbitEnabled(false);

    dragRef.current = {
      startScreen: new THREE.Vector2(e.clientX, e.clientY),
      cubie: cubie
    };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    setOrbitEnabled(true);
    
    if (!dragRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    
    const endScreen = new THREE.Vector2(e.clientX, e.clientY);
    const delta = endScreen.sub(dragRef.current.startScreen);

    // Minimum drag distance (pixels) to avoid accidental clicks
    if (delta.length() > 20) {
      const moveKey = determineBestMove(dragRef.current.cubie, delta);
      if (moveKey) {
        onManualMove(moveKey);
      }
    }
    
    dragRef.current = null;
  };

  // --- Rendering ---
  
  const materials = useMemo(() => [
    new THREE.MeshStandardMaterial({ color: FACE_COLORS.right, roughness: 0.1, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: FACE_COLORS.left, roughness: 0.1, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: FACE_COLORS.top, roughness: 0.1, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: FACE_COLORS.bottom, roughness: 0.1, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: FACE_COLORS.front, roughness: 0.1, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: FACE_COLORS.back, roughness: 0.1, metalness: 0.1 }),
  ], []);

  return (
    <group>
      <group ref={pivotRef}>
        {cubies.filter(c => isAnimatingRef.current && currentMoveRef.current && isInSlice(c.position, currentMoveRef.current.axis, currentMoveRef.current.slice))
          .map(c => (
             <CubieMesh 
               key={c.id} 
               cubie={c} 
               materials={materials} 
               onPointerDown={handlePointerDown} 
               onPointerUp={handlePointerUp}
             />
          ))
        }
      </group>

      <group>
        {cubies.filter(c => !isAnimatingRef.current || !currentMoveRef.current || !isInSlice(c.position, currentMoveRef.current.axis, currentMoveRef.current.slice))
          .map(c => (
            <CubieMesh 
              key={c.id} 
              cubie={c} 
              materials={materials} 
              onPointerDown={handlePointerDown} 
              onPointerUp={handlePointerUp}
            />
          ))
        }
      </group>
    </group>
  );
};

const CubieMesh: React.FC<{ 
  cubie: Cubie; 
  materials: THREE.Material[]; 
  onPointerDown: (e: ThreeEvent<PointerEvent>, c: Cubie) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}> = ({ cubie, materials, onPointerDown, onPointerUp }) => {
  return (
    <mesh
      position={cubie.position}
      quaternion={cubie.rotation}
      onPointerDown={(e) => onPointerDown(e, cubie)}
      onPointerUp={onPointerUp}
      castShadow
      receiveShadow
    >
      <RoundedBox args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} radius={ROUNDING} smoothness={4}>
         {materials.map((m, i) => <primitive object={m} attach={`material-${i}`} key={i} />)}
      </RoundedBox>
      <mesh scale={[0.98, 0.98, 0.98]}>
        <boxGeometry />
        <meshStandardMaterial color="#111" />
      </mesh>
    </mesh>
  );
};