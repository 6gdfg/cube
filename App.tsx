import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars } from '@react-three/drei';
import { Cube3D } from './components/Cube3D';
import { Controls } from './components/Controls';
import { MOVES, Move } from './types';

// Helper to get random integer
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export default function App() {
  const [moveQueue, setMoveQueue] = useState<Move[]>([]);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  
  // Handle adding a move to the queue
  const handleMove = useCallback((moveKey: string) => {
    const move = MOVES[moveKey];
    if (move) {
      setMoveQueue(prev => [...prev, move]);
    }
  }, []);

  // Completion callback to pop the queue
  const handleMoveComplete = useCallback(() => {
    setMoveQueue(prev => prev.slice(1));
  }, []);

  // Scramble Logic
  const scramble = useCallback(() => {
    const keys = Object.keys(MOVES);
    const newMoves: Move[] = [];
    let lastAxis = '';
    
    for (let i = 0; i < 20; i++) {
      let key = keys[randInt(0, keys.length - 1)];
      let move = MOVES[key];
      
      // Simple heuristic to avoid immediate undo (e.g., L then L')
      while (move.axis === lastAxis) {
         key = keys[randInt(0, keys.length - 1)];
         move = MOVES[key];
      }
      
      newMoves.push(move);
      lastAxis = move.axis;
    }
    setMoveQueue(prev => [...prev, ...newMoves]);
  }, []);

  // Initialize with a scramble
  useEffect(() => {
    scramble(); 
  }, [scramble]);

  return (
    <div className="w-full h-full relative bg-gray-900">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[5, 4, 6]} fov={45} />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize={[1024, 1024]} 
        />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="blue" />

        <group position={[0, 0, 0]}>
          <Cube3D 
            moveQueue={moveQueue} 
            onMoveComplete={handleMoveComplete}
            setOrbitEnabled={setOrbitEnabled}
            onManualMove={handleMove}
          />
        </group>

        <OrbitControls 
          enabled={orbitEnabled} 
          enablePan={false}
          minDistance={3}
          maxDistance={15}
          dampingFactor={0.05}
        />
        
        <Environment preset="city" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <h1 className="text-4xl font-bold text-white drop-shadow-md tracking-tighter">
          RUBIK<span className="text-blue-500">'</span>S
          <br/>
          <span className="text-2xl text-gray-300 font-light">3D WEB</span>
        </h1>
      </div>

      <Controls 
        onMove={handleMove} 
        onScramble={scramble} 
        disabled={moveQueue.length > 5} // Disable manual input if scrambling heavily
      />
    </div>
  );
}