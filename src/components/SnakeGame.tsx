import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RotateCcw, Trophy } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };

export default function SnakeGame({ onClose }: { onClose: () => void }) {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const moveSnake = useCallback(() => {
    if (gameOver) return;

    const newHead = {
      x: (snake[0].x + direction.x + GRID_SIZE) % GRID_SIZE,
      y: (snake[0].y + direction.y + GRID_SIZE) % GRID_SIZE,
    };

    if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      setGameOver(true);
      return;
    }

    const newSnake = [newHead, ...snake];
    if (newHead.x === food.x && newHead.y === food.y) {
      setScore(s => s + 10);
      setFood({
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      });
    } else {
      newSnake.pop();
    }
    setSnake(newSnake);
  }, [snake, direction, food, gameOver]);

  useEffect(() => {
    const interval = setInterval(moveSnake, 150);
    return () => clearInterval(interval);
  }, [moveSnake]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [direction]);

  return (
    <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 shadow-2xl w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" size={20} />
          <span className="text-white font-bold">{score}</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"><X size={20} /></button>
      </div>

      <div className="aspect-square bg-zinc-900 rounded-xl relative overflow-hidden border border-zinc-800">
        {snake.map((s, i) => (
          <div key={i} className="absolute bg-emerald-500 rounded-sm" style={{
            width: `${100/GRID_SIZE}%`, height: `${100/GRID_SIZE}%`,
            left: `${(s.x * 100)/GRID_SIZE}%`, top: `${(s.y * 100)/GRID_SIZE}%`
          }} />
        ))}
        <div className="absolute bg-red-500 rounded-full animate-pulse" style={{
          width: `${100/GRID_SIZE}%`, height: `${100/GRID_SIZE}%`,
          left: `${(food.x * 100)/GRID_SIZE}%`, top: `${(food.y * 100)/GRID_SIZE}%`
        }} />
      </div>

      {gameOver && (
        <div className="mt-6 text-center">
          <p className="text-red-500 font-bold mb-4">GAME OVER!</p>
          <button onClick={() => { setSnake(INITIAL_SNAKE); setGameOver(false); setScore(0); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center gap-2 mx-auto">
            <RotateCcw size={16} /> Play Again
          </button>
        </div>
      )}
    </div>
  );
          }
