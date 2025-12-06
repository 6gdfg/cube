import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Cubie, Move, FACE_COLORS, MOVES } from '../types';

// Ensure global JSX namespace includes R3F elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      primitive: any;
      boxGeometry: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
  }
}

interface Cube3DProps {
  moveQueue: Move[];
  onMoveComplete: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  onManualMove: (moveKey: string) => void;
}

// Geometry constants
const CUBIE_SIZE = 0.96; // Leaves a small gap to visualize rotation
const ANIMATION_SPEED = 5.0; // Radians per second approx

export const Cube3D: React.FC<Cube3DProps> = ({ 
  moveQueue, 
  onMoveComplete, 
  setOrbitEnabled,
  onManualMove
}) => {
  const { camera, raycaster, gl } = useThree();

  // --- Materials ---
  // Create standard materials for faces.
  // We use slightly shiny plastic look.
  const materials = useMemo(() => {
    const opts = { roughness: 0.1, metalness: 0.0 };
    return {
      right: new THREE.MeshStandardMaterial({ color: FACE_COLORS.right, ...opts }), // Red
      left: new THREE.MeshStandardMaterial({ color: FACE_COLORS.left, ...opts }),   // Orange
      top: new THREE.MeshStandardMaterial({ color: FACE_COLORS.top, ...opts }),     // White
      bottom: new THREE.MeshStandardMaterial({ color: FACE_COLORS.bottom, ...opts }),// Yellow
      front: new THREE.MeshStandardMaterial({ color: FACE_COLORS.front, ...opts }), // Green
      back: new THREE.MeshStandardMaterial({ color: FACE_COLORS.back, ...opts }),   // Blue
      core: new THREE.MeshStandardMaterial({ color: FACE_COLORS.core, roughness: 0.6 }), // Black plastic
    };
  }, []);

  // --- State ---
  // 27 Cubies. We track their logical position/rotation in state for move logic,
  // but modify the actual THREE meshes directly for smooth animation.
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
            name: `cubie-${id}`
          });
        }
      }
    }
    return init;
  });

  // Refs for animation
  const cubieRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const isAnimating = useRef(false);
  const currentMove = useRef<Move | null>(null);
  const moveProgress = useRef(0); // 0 to Math.PI/2
  const activeCubieIds = useRef<number[]>([]);

  // Refs for Drag Interaction
  const dragStart = useRef<{
    point: THREE.Vector3;
    normal: THREE.Vector3;
    cubieId: number;
  } | null>(null);
  const isDragging = useRef(false);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    // 1. Start Animation if Queue has item and not currently animating
    if (!isAnimating.current && moveQueue.length > 0) {
      const move = moveQueue[0];
      currentMove.current = move;
      isAnimating.current = true;
      moveProgress.current = 0;

      // Identify which cubies are involved in this move
      // Filter based on current integer positions in state
      activeCubieIds.current = cubies
        .filter(c => {
          const pos = c.position; // This is the logical integer position
          if (move.axis === 'x') return Math.abs(pos.x - move.slice) < 0.1;
          if (move.axis === 'y') return Math.abs(pos.y - move.slice) < 0.1;
          if (move.axis === 'z') return Math.abs(pos.z - move.slice) < 0.1;
          return false;
        })
        .map(c => c.id);
    }

    // 2. Process Animation
    if (isAnimating.current && currentMove.current) {
      const move = currentMove.current;
      const step = ANIMATION_SPEED * delta;
      
      // Target rotation is 90 degrees (PI/2)
      const target = Math.PI / 2;
      
      // Calculate how much to rotate this frame
      let frameRotation = step;
      if (moveProgress.current + step > target) {
        frameRotation = target - moveProgress.current;
      }

      moveProgress.current += frameRotation;

      // Create rotation quaternion for this frame: Axis * Direction * Amount
      const axisVec = new THREE.Vector3(
        move.axis === 'x' ? 1 : 0,
        move.axis === 'y' ? 1 : 0,
        move.axis === 'z' ? 1 : 0
      );
      // Direction: -1 for clockwise on axis usually, but depends on definition.
      // In types.ts: U1 (CW top) -> axis y, dir -1.
      const rotQuat = new THREE.Quaternion();
      rotQuat.setFromAxisAngle(axisVec, frameRotation * move.direction);

      // Apply rotation to active meshes relative to world center (0,0,0)
      activeCubieIds.current.forEach(id => {
        const mesh = cubieRefs.current.get(id);
        if (mesh) {
          // Rotate position around origin
          mesh.position.applyQuaternion(rotQuat);
          // Rotate orientation
          mesh.quaternion.premultiply(rotQuat);
        }
      });

      // 3. Finish Animation
      if (moveProgress.current >= target) {
        isAnimating.current = false;
        
        // Snap positions to integers to prevent drift
        const finalRotation = new THREE.Quaternion();
        finalRotation.setFromAxisAngle(axisVec, (Math.PI / 2) * move.direction);

        // Update logical state
        setCubies(prev => prev.map(c => {
          if (activeCubieIds.current.includes(c.id)) {
            // Apply exact 90 deg rotation to logical position
            const newPos = c.position.clone().applyQuaternion(finalRotation);
            newPos.x = Math.round(newPos.x);
            newPos.y = Math.round(newPos.y);
            newPos.z = Math.round(newPos.z);

            const newRot = c.rotation.clone().premultiply(finalRotation);
            
            // Sync mesh exactly to these new values to remove any frame-interpolation errors
            const mesh = cubieRefs.current.get(c.id);
            if (mesh) {
              mesh.position.copy(newPos);
              mesh.quaternion.copy(newRot);
            }

            return { ...c, position: newPos, rotation: newRot };
          }
          return c;
        }));

        onMoveComplete(); // Remove from queue
        currentMove.current = null;
      }
    }
  });

  // --- Interaction Logic ---

  const getIntersect = (e: any) => {
    // Helper to get first intersection with a cubie
    // e.intersections is sorted by distance
    const hit = e.intersections.find((i: any) => i.eventObject.name === 'cubie');
    return hit;
  };

  const handlePointerDown = (e: any) => {
    // Only allow interaction if not animating and drag not active
    if (isAnimating.current || moveQueue.length > 0) return;

    const hit = getIntersect(e);
    if (!hit) return;

    // Disable orbit controls so we can drag the face
    setOrbitEnabled(false);
    isDragging.current = true;
    
    // hit.point is world space, hit.face.normal is local space usually, but we need world normal
    // If the cube is rotated, the face normal needs to be transformed? 
    // Actually, simple heuristic: which face of the "Cube" did we hit?
    // Because cubies rotate, a "Right" face might now be pointing Up.
    // We rely on the visual normal.
    
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
    
    dragStart.current = {
      point: hit.point,
      normal: normal,
      cubieId: hit.eventObject.userData.id
    };
    
    e.stopPropagation();
  };

  const handlePointerUp = (e: any) => {
    setOrbitEnabled(true);
    isDragging.current = false;
    dragStart.current = null;
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging.current || !dragStart.current || isAnimating.current) return;

    // Use raycaster from camera to find where we are now on the conceptual plane
    // We define a plane at the drag start point, facing the camera or matching the face?
    // Simpler: Just map mouse delta? No, 3D drag is better.
    
    // Let's project the movement onto the camera plane or check direction relative to face normal.
    // Easiest robust method for Rubik's:
    // 1. Get drag vector (current point - start point)
    // 2. Project this vector onto the two axes perpendicular to the normal.
    // 3. If magnitude > threshold, trigger move.
    
    const hit = getIntersect(e);
    if (!hit) return; // If we dragged off the cube, might be tricky. 

    // Better approach: project ray onto a plane defined by dragStart.point and dragStart.normal
    // Actually, we just need the 2D direction on screen for simplicity, OR
    // compare current hit point to start point if we are still hitting the cube.
    
    const moveVector = hit.point.clone().sub(dragStart.current.point);
    
    // Threshold to trigger move
    if (moveVector.length() < 0.25) return;

    const { normal, cubieId } = dragStart.current;
    
    // Determine Axis and Direction
    let axis: 'x'|'y'|'z' | null = null;
    let direction = 0; // 1 or -1

    // We need to map the 3D move vector to one of the major axes that is NOT the normal.
    // e.g. Normal is (0,1,0) [UP], we can move in X or Z.
    
    const absX = Math.abs(moveVector.x);
    const absY = Math.abs(moveVector.y);
    const absZ = Math.abs(moveVector.z);

    // Find dominant axis that isn't the normal
    if (Math.abs(normal.x) > 0.5) {
      // Normal is X, move can be Y or Z
      if (absY > absZ) axis = 'y'; else axis = 'z';
    } else if (Math.abs(normal.y) > 0.5) {
      // Normal is Y, move can be X or Z
      if (absX > absZ) axis = 'x'; else axis = 'z';
    } else {
      // Normal is Z, move can be X or Y
      if (absX > absY) axis = 'x'; else axis = 'y';
    }

    if (!axis) return;

    // Determine slice
    const cubie = cubies.find(c => c.id === cubieId);
    if (!cubie) return;
    const slice = Math.round(cubie.position[axis as 'x'|'y'|'z']);

    // Determine direction (CW or CCW)
    // This is tricky. We need to map linear drag to rotational direction.
    // Rule: (DragVector x Normal) . RotationAxis > 0 ?
    
    // Simplified:
    // If dragging +X on Top face (Normal +Y), that produces rotation around Z (Front/Back slices).
    // Specifically, dragging Right (+X) on Top Face corresponds to rotating the Front Face clockwise? No.
    // Dragging Right (+X) on Top means the slice is Z (depth). Wait.
    // If I touch Top center and drag Right, I am moving the "S" slice or the whole cube?
    // We assume slice rotation.
    // If I am at Top face (y=1), dragging X changes X. The rows stay constant Z. So I am rotating a Z-slice.
    // If I drag +X, the cubies move +X. This corresponds to a rotation around Z axis? No.
    // Rotation around Z axis moves things in X/Y plane.
    // Yes.
    
    // Let's determine the move name from types.MOVES
    // We have axis (of the slice), slice index, and we need direction.
    
    // Calculate the 'intended' rotation axis.
    // The rotation axis is the cross product of Normal and MoveDirection.
    // e.g. Normal Y(0,1,0) X Move X(1,0,0) = Z(0,0,-1).
    // So the rotation axis is Z.
    
    const moveDirNorm = moveVector.clone().normalize();
    // Snap move dir to nearest axis
    const mainMoveAxis = absX > absY && absX > absZ ? 'x' : (absY > absZ ? 'y' : 'z');
    const signedMoveDir = Math.sign(moveVector[mainMoveAxis as 'x'|'y'|'z']);

    // Rotation Axis = Normal x MoveAxis
    // But we need the rotation axis to lookup the Move.
    // The "Move.axis" in types.ts is the axis of rotation.
    
    // Example: Top Face (0,1,0). Drag Right (+1,0,0).
    // Cross: (0,1,0) x (1,0,0) = (0,0,-1). Rotation axis is Z.
    // Slice is the Z coordinate of the touched cubie.
    // If Rotation Axis is Z, and result is negative Z...
    // Let's look at MOVES. F (Front, z=1) is CW. F moves Top face to Right.
    // Top face is y=1. Top-Right is x=1.
    // F moves (0,1,1) -> (1,0,1).
    // It moved +X, -Y.
    // So +X drag on Top matches F (if z=1).
    
    // Let's rely on standard vector cross product for rotation axis.
    const rotAxisVec = new THREE.Vector3().crossVectors(normal, moveDirNorm);
    // Find dominant component of rotAxisVec
    let rotAxis: 'x'|'y'|'z' = 'x';
    if (Math.abs(rotAxisVec.y) > Math.abs(rotAxisVec.x)) rotAxis = 'y';
    if (Math.abs(rotAxisVec.z) > Math.abs(rotAxisVec.y) && Math.abs(rotAxisVec.z) > Math.abs(rotAxisVec.x)) rotAxis = 'z';

    const rotDirRaw = rotAxisVec[rotAxis]; // + or -

    // Find the slice index. The slice is the coordinate of the cubie along the rotation axis.
    const rotSlice = Math.round(cubie.position[rotAxis]);

    // Construct Move Key
    // MOVES keys: U1, U2, F1, F2...
    // We iterate MOVES to find the one matching axis, slice, and direction?
    // Or just construct it.
    
    // Direction mapping in types.ts is confusing (-1 for CW?).
    // Let's map dynamically.
    // We found the axis and the slice. Now we need to know if it's CW or CCW.
    // Vector math says direction of rotation vector.
    // If rotDirRaw is positive, we are rotating around +Axis (CCW by right hand rule?).
    // MOVES definition:
    // U1 (CW looking from top) -> Axis Y, Dir -1.
    // So Dir -1 is standard CW?
    // Right Hand Rule: Thumb along +Axis, fingers curl CCW.
    // So +Angle is CCW.
    // If rotAxisVec points +Axis, that is a CCW rotation (Angle > 0).
    // In our types, direction 1 is usually CCW (D', L, R', F', B).
    // Wait, let's check U1 (CW). Axis Y. Dir -1.
    // If I rotate around Y by -90deg, that is CW looking from top. Correct.
    // So if rotDirRaw > 0, that implies +Angle (CCW), so direction should be 1.
    // If rotDirRaw < 0, direction -1.

    // Correction: The Cross product (Normal x Move) gives the torque vector / rotation axis.
    // If (Normal x Move) points in +Z, we rotate around +Z (CCW).
    // So direction = Math.sign(rotDirRaw).
    
    // Find matching move
    const matchedMove = Object.entries(MOVES).find(([key, m]) => {
      return m.axis === rotAxis && m.slice === rotSlice && m.direction === Math.sign(rotDirRaw) * -1; 
      // Multiplied by -1 because visually dragging X on Top feels like rotating Z, 
      // but the sign might be flipped depending on coordinate system.
      // Let's try without -1 first. 
      // Top (0,1,0) drag Right (1,0,0) -> Cross (0,0,-1). Rot Axis Z, direction -1.
      // Top face cubies have Z in range -1..1.
      // If I drag the Front-Top edge (+Z), slice is 1. Move is F.
      // F is F1: Axis Z, slice 1, dir -1.
      // My calc: dir -1. Match!
      // So no multiplier needed?
      // Let's try Top (0,1,0) drag Left (-1,0,0) -> Cross (0,0,1). Dir +1.
      // Move should be F' (F2): Axis Z, slice 1, dir 1. Match!
      
      // Let's try Right Face (1,0,0) drag Up (0,1,0).
      // Cross (1,0,0)x(0,1,0) = (0,0,1). Rot Axis Z, dir 1.
      // Right face implies Z can be anything.
      // If front-right (z=1), slice 1. Move F2 (F').
      // Dragging Right Face Upwards...
      // F' rotates front face CCW. Right face moves UP. Yes.
      // Match!
    });
    
    if (matchedMove) {
      onManualMove(matchedMove[0]);
      
      // Stop dragging immediately to prevent multi-trigger
      isDragging.current = false;
      dragStart.current = null;
      setOrbitEnabled(true);
    }
  };


  return (
    <group 
      onPointerDown={handlePointerDown} 
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      {cubies.map((cubie) => {
        // Prepare material array for this specific cubie based on its INITIAL logical position (encoded in ID or calc)
        // Actually, we must determine which face is colored based on the INITIAL x,y,z.
        // We know initial positions because id 0..26 maps to x:-1..1 loops.
        // But simpler: We can just check the component ID logic.
        // Or store initialPos in state? We stored it in state initialization but 'position' changes.
        // We can recover initial X,Y,Z from ID if we generated them deterministically.
        // Loop order: x(-1..1), y(-1..1), z(-1..1).
        // id = (x+1)*9 + (y+1)*3 + (z+1).
        
        const iz = cubie.id % 3 - 1;
        const iy = Math.floor((cubie.id % 9) / 3) - 1;
        const ix = Math.floor(cubie.id / 9) - 1;
        
        const myMaterials = [
          ix === 1 ? materials.right : materials.core,  // Right
          ix === -1 ? materials.left : materials.core,  // Left
          iy === 1 ? materials.top : materials.core,    // Top
          iy === -1 ? materials.bottom : materials.core,// Bottom
          iz === 1 ? materials.front : materials.core,  // Front
          iz === -1 ? materials.back : materials.core,  // Back
        ];

        return (
          <mesh
            key={cubie.id}
            ref={(el) => { if (el) cubieRefs.current.set(cubie.id, el); }}
            position={cubie.position}
            quaternion={cubie.rotation}
            userData={{ id: cubie.id }}
            name="cubie"
            material={myMaterials}
          >
            <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
          </mesh>
        );
      })}
    </group>
  );
};