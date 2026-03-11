import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';

export default function TicTacToeGame({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const calculateWinner = (squares: any[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return squares.every((s: any) => s !== null) ? 'Draw' : null;
  };

  const handleClick = (i: number) => {
    if (winner || board[i]) return;
    const newBoard = [...board];
    newBoard[i] = 'X';
    setBoard(newBoard);
    setIsXNext(false);
  };

  useEffect(() => {
    if (!isXNext && !winner) {
      const timer = setTimeout(() => {
        const emptySquares = board.map((s, i) => s === null ? i : null).filter(s => s !== null);
        if (emptySquares.length > 0) {
          const randomIndex = emptySquares[Math.floor(Math.random() * emptySquares.length)];
          const newBoard = [...board];
          newBoard[randomIndex as number] = 'O';
          setBoard(newBoard);
          setIsXNext(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isXNext, board, winner]);

  useEffect(() => {
    const result = calculateWinner(board);
    if (result) setWinner(result);
  }, [board]);

  return (
    <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 shadow-2xl w-full max-w-md">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-bold">Tic Tac Toe (vs AI)</h3>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400"><X size={20} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {board.map((square, i) => (
          <button key={i} onClick={() => handleClick(i)} className="aspect-square bg-zinc-900 border border-zinc-800 rounded-xl text-2xl font-bold flex items-center justify-center hover:bg-zinc-800 transition-colors">
            <span className={square === 'X' ? 'text-sky-500' : 'text-red-500'}>{square}</span>
          </button>
        ))}
      </div>

      {winner && (
        <div className="text-center">
          <p className="text-white font-bold mb-4">{winner === 'Draw' ? "It's a Draw!" : `Winner: ${winner}`}</p>
          <button onClick={() => { setBoard(Array(9).fill(null)); setWinner(null); setIsXNext(true); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center gap-2 mx-auto">
            <RotateCcw size={16} /> Reset Game
          </button>
        </div>
      )}
    </div>
  );
                             }
