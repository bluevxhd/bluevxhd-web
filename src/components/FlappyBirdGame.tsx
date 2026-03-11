import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';

const BIRD_SIZE = 30;
const GRAVITY = 0.6;
const JUMP = -8;
const PIPE_WIDTH = 50;
const PIPE_GAP = 150;

export default function FlappyBirdGame({ onClose }: { onClose: () => void }) {
  const [birdY, setBirdY] = useState(250);
  const [velocity, setVelocity] = useState(0);
  const [pipes, setPipes] = useState([{ x: 400, height: 200 }]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameRef = useRef<HTMLDivElement>(null);

  const jump = useCallback(() => {
    if (!gameOver) setVelocity(JUMP);
  }, [gameOver]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.code === 'Space') jump(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump]);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setBirdY(y => {
        const newY = y + velocity;
        if (newY < 0 || newY > 470) setGameOver(true);
        return newY;
      });
      setVelocity(v => v + GRAVITY);
      setPipes(ps => {
        const newPipes = ps.map(p => ({ ...p, x: p.x - 5 }));
        if (newPipes[0].x < -PIPE_WIDTH) {
          setScore(s => s + 1);
          newPipes.shift();
          newPipes.push({ x: 400, height: Math.random() * 200 + 50 });
        }
        return newPipes;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [velocity, pipes, gameOver]);

  useEffect(() => {
    pipes.forEach(p => {
      if (p.x < 50 + BIRD_SIZE && p.x + PIPE_WIDTH > 50 && (birdY < p.height || birdY + BIRD_SIZE > p.height + PIPE_GAP)) {
        setGameOver(true);
      }
    });
  }, [birdY, pipes]);

  return (
    <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden" onMouseDown={jump}>
      <div className="flex justify-between items-center mb-6">
        <span className="text-white font-bold">Score: {score}</span>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"><X size={20} /></button>
      </div>

      <div className="h-[500px] bg-sky-900/20 rounded-xl relative overflow-hidden border border-zinc-800">
        <div className="absolute left-[50px] bg-yellow-500 rounded-full" style={{ top: birdY, width: BIRD_SIZE, height: BIRD_SIZE }} />
        {pipes.map((p, i) => (
          <React.Fragment key={i}>
            <div className="absolute bg-emerald-600" style={{ left: p.x, top: 0, width: PIPE_WIDTH, height: p.height }} />
            <div className="absolute bg-emerald-600" style={{ left: p.x, top: p.height + PIPE_GAP, width: PIPE_WIDTH, height: 500 }} />
          </React.Fragment>
        ))}
      </div>

      {gameOver && (
        <div className="mt-6 text-center">
          <p className="text-red-500 font-bold mb-4">GAME OVER!</p>
          <button onClick={() => { setBirdY(250); setVelocity(0); setPipes([{ x: 400, height: 200 }]); setScore(0); setGameOver(false); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center gap-2 mx-auto">
            <RotateCcw size={16} /> Restart
          </button>
        </div>
      )}
    </div>
  );
      }
