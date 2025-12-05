import React from 'react';
import { MOVES } from '../types';
import { RotateCw, RotateCcw } from 'lucide-react';

interface ControlsProps {
  onMove: (key: string) => void;
  onScramble: () => void;
  disabled: boolean;
}

const GROUPS = [
  { name: 'Front (F)', cw: 'F1', ccw: 'F2' },
  { name: 'Back (B)', cw: 'B1', ccw: 'B2' },
  { name: 'Up (U)', cw: 'U1', ccw: 'U2' },
  { name: 'Down (D)', cw: 'D1', ccw: 'D2' },
  { name: 'Left (L)', cw: 'L1', ccw: 'L2' },
  { name: 'Right (R)', cw: 'R1', ccw: 'R2' },
];

export const Controls: React.FC<ControlsProps> = ({ onMove, onScramble, disabled }) => {
  return (
    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-white max-h-[40vh] overflow-y-auto pointer-events-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Cube Controls
        </h2>
        <button
          onClick={onScramble}
          disabled={disabled}
          className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95 transition disabled:opacity-50"
        >
          Scramble
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GROUPS.map((g) => (
          <div key={g.name} className="flex flex-col gap-1 bg-white/5 p-2 rounded-lg">
            <span className="text-xs text-gray-400 text-center font-mono mb-1">{g.name}</span>
            <div className="flex gap-2">
              <ControlButton 
                label="CW" 
                moveKey={g.cw} 
                onClick={() => onMove(g.cw)} 
                disabled={disabled}
                icon={<RotateCw size={14} />}
              />
              <ControlButton 
                label="CCW" 
                moveKey={g.ccw} 
                onClick={() => onMove(g.ccw)} 
                disabled={disabled}
                icon={<RotateCcw size={14} />}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-[10px] text-gray-500 text-center">
        Shortcuts: F1/F2 keys are not bound globally. Use on-screen buttons or drag the cube.
        <br/>Drag faces to rotate layers. Drag background to rotate view.
      </div>
    </div>
  );
};

const ControlButton: React.FC<{ 
  label: string; 
  moveKey: string; 
  onClick: () => void; 
  disabled: boolean;
  icon: React.ReactNode;
}> = ({ label, moveKey, onClick, disabled, icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 active:bg-blue-500/50 py-2 rounded text-xs transition disabled:opacity-30"
    title={`${moveKey} Move`}
  >
    {icon}
    <span>{moveKey.substring(0, 1)}{moveKey.includes('2') ? "'" : ''}</span>
  </button>
);