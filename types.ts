import * as THREE from 'three';

export type Axis = 'x' | 'y' | 'z';

export interface Cubie {
  id: number;
  // We use integer coordinates -1, 0, 1
  position: THREE.Vector3; 
  // We store rotation as a quaternion to accumulate rotations
  rotation: THREE.Quaternion;
  // Base identifying name for debugging
  name: string;
}

export interface Move {
  axis: Axis;
  slice: number; // -1, 0, 1
  direction: number; // 1 (clockwise relative to axis) or -1
  name?: string;
}

export interface AnimationState {
  active: boolean;
  move: Move | null;
  progress: number;
  speed: number;
}

// Notation mapping
// U (Up): y=1, cw
// D (Down): y=-1, cw (looking from bottom, so -1 relative to y axis?) 
// Standard notation is clockwise looking AT the face.
// U: Axis Y, Slice 1, Dir -1 (Right hand rule Y points up, looking from top is against axis? No, thumb up, fingers curl CCW. Wait.
// Let's stick to standard math rotation and map buttons to them.
// Right Hand Rule: Thumb along axis, fingers curl positive.
// Y axis points UP. 
// U move: Clockwise looking from Top. This is negative rotation around Y.
// D move: Clockwise looking from Bottom. This is positive rotation around Y.
// R move: Clockwise looking from Right. X axis points Right. Negative rotation around X.
// L move: Clockwise looking from Left. Positive rotation around X.
// F move: Clockwise looking from Front. Z axis points to viewer. Negative rotation around Z.
// B move: Clockwise looking from Back. Positive rotation around Z.

export const MOVES: Record<string, Move> = {
  // Up Face (y=1)
  U1: { axis: 'y', slice: 1, direction: -1, name: 'U' }, // Clockwise
  U2: { axis: 'y', slice: 1, direction: 1, name: "U'" },  // Counter-Clockwise
  
  // Down Face (y=-1)
  D1: { axis: 'y', slice: -1, direction: 1, name: 'D' }, // Clockwise
  D2: { axis: 'y', slice: -1, direction: -1, name: "D'" }, // Counter-Clockwise

  // Left Face (x=-1)
  L1: { axis: 'x', slice: -1, direction: 1, name: 'L' }, // Clockwise
  L2: { axis: 'x', slice: -1, direction: -1, name: "L'" }, // Counter-Clockwise

  // Right Face (x=1)
  R1: { axis: 'x', slice: 1, direction: -1, name: 'R' }, // Clockwise
  R2: { axis: 'x', slice: 1, direction: 1, name: "R'" }, // Counter-Clockwise

  // Front Face (z=1)
  F1: { axis: 'z', slice: 1, direction: -1, name: 'F' }, // Clockwise
  F2: { axis: 'z', slice: 1, direction: 1, name: "F'" }, // Counter-Clockwise

  // Back Face (z=-1)
  B1: { axis: 'z', slice: -1, direction: 1, name: 'B' }, // Clockwise
  B2: { axis: 'z', slice: -1, direction: -1, name: "B'" }, // Counter-Clockwise
};

export const FACE_COLORS = {
  right: '#b90000', // Red (x=1)
  left: '#ff5900',  // Orange (x=-1)
  top: '#ffffff',   // White (y=1)
  bottom: '#ffd500',// Yellow (y=-1)
  front: '#009b48', // Green (z=1)
  back: '#0045ad',  // Blue (z=-1)
  core: '#1a1a1a'   // Inner plastic
};