'use client';
import {useEffect, useRef, useState} from 'react';

const CELL_SIZE = 10;

function createEmptyGrid(rows: number, cols: number) {
  return Array.from({length: rows}, () => Array(cols).fill(0));
}

function randomizeGrid(grid: number[][]) {
  return grid.map((row) => row.map(() => (Math.random() > 0.7 ? 1 : 0)));
}

function getNextGrid(grid: number[][], rows: number, cols: number) {
  const next = createEmptyGrid(rows, cols);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let neighbors = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          const ny = y + i;
          const nx = x + j;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
            neighbors += grid[ny][nx];
          }
        }
      }
      if (grid[y][x]) {
        next[y][x] = neighbors === 2 || neighbors === 3 ? 1 : 0;
      } else {
        next[y][x] = neighbors === 3 ? 1 : 0;
      }
    }
  }
  return next;
}

// Helper to interpolate between two colors
function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const BASE_COLOR: [number, number, number] = [34, 34, 34]; // #222
const DEAD_COLOR: [number, number, number] = [255, 255, 255]; // white background
const GREEN: [number, number, number] = [0, 200, 0];
const RED: [number, number, number] = [220, 0, 0];
const FADE_FRAMES = 20;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });
  const [rows, setRows] = useState(Math.floor(dimensions.height / CELL_SIZE));
  const [cols, setCols] = useState(Math.floor(dimensions.width / CELL_SIZE));
  const [restartKey, setRestartKey] = useState(0); // Used to trigger restart
  const [speed, setSpeed] = useState(0); // 0 = max speed, otherwise ms per frame
  const gridRef = useRef<number[][]>(
    randomizeGrid(createEmptyGrid(rows, cols)),
  );
  const colorGridRef = useRef<
    {
      color: [number, number, number];
      fade: number;
      target: [number, number, number];
    }[][]
  >(
    Array.from({length: rows}, () =>
      Array.from({length: cols}, () => ({
        color: DEAD_COLOR as [number, number, number],
        fade: 0,
        target: DEAD_COLOR as [number, number, number],
      })),
    ),
  );

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({width, height});
      setRows(Math.floor(height / CELL_SIZE));
      setCols(Math.floor(width / CELL_SIZE));
      gridRef.current = randomizeGrid(
        createEmptyGrid(
          Math.floor(height / CELL_SIZE),
          Math.floor(width / CELL_SIZE),
        ),
      );
      colorGridRef.current = Array.from(
        {length: Math.floor(height / CELL_SIZE)},
        () =>
          Array.from({length: Math.floor(width / CELL_SIZE)}, () => ({
            color: DEAD_COLOR,
            fade: 0,
            target: DEAD_COLOR,
          })),
      );
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Restart effect
  useEffect(() => {
    gridRef.current = randomizeGrid(createEmptyGrid(rows, cols));
    colorGridRef.current = Array.from({length: rows}, () =>
      Array.from({length: cols}, () => ({
        color: DEAD_COLOR,
        fade: 0,
        target: DEAD_COLOR,
      })),
    );
  }, [restartKey, rows, cols]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    let animationId: number;
    let timeoutId: NodeJS.Timeout;
    let prevGrid = gridRef.current.map((row) => [...row]);
    let running = true;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = gridRef.current[y][x];
          const prev = prevGrid[y]?.[x] ?? 0;
          const colorState = colorGridRef.current[y][x];

          // State change: dead->alive or alive->dead
          if (cell !== prev) {
            if (cell === 1) {
              colorState.color = GREEN;
              colorState.target = BASE_COLOR;
              colorState.fade = 0;
            } else {
              colorState.color = RED;
              colorState.target = DEAD_COLOR;
              colorState.fade = 0;
            }
          }

          // If alive and not transitioning, use base color
          if (cell === 1 && colorState.fade >= FADE_FRAMES) {
            colorState.color = BASE_COLOR;
            colorState.target = BASE_COLOR;
          }
          // If dead and not transitioning, use dead color
          if (cell === 0 && colorState.fade >= FADE_FRAMES) {
            colorState.color = DEAD_COLOR;
            colorState.target = DEAD_COLOR;
          }

          // Fade color if needed
          if (colorState.fade < FADE_FRAMES) {
            colorState.fade++;
            const t = colorState.fade / FADE_FRAMES;
            colorState.color = lerpColor(
              colorState.color,
              colorState.target,
              t,
            );
          }

          ctx.fillStyle = `rgb(${colorState.color[0]},${colorState.color[1]},${colorState.color[2]})`;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    function update() {
      prevGrid = gridRef.current.map((row) => [...row]);
      gridRef.current = getNextGrid(gridRef.current, rows, cols);
      draw();
      if (!running) return;
      if (speed === 0) {
        animationId = requestAnimationFrame(update);
      } else {
        timeoutId = setTimeout(update, speed);
      }
    }

    draw();
    if (speed === 0) {
      animationId = requestAnimationFrame(update);
    } else {
      timeoutId = setTimeout(update, speed);
    }
    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      clearTimeout(timeoutId);
    };
  }, [dimensions, rows, cols, restartKey, speed]);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <button
          onClick={() => setRestartKey((k) => k + 1)}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          Restart
        </button>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '8px 12px',
          }}
        >
          <span style={{fontSize: '0.95rem'}}>Speed</span>
          <input
            type='range'
            min={0}
            max={200}
            step={5}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{marginLeft: 8}}
          />
          <span style={{fontSize: '0.9rem', minWidth: 40, textAlign: 'right'}}>
            {speed === 0 ? 'Max' : `${speed}ms`}
          </span>
        </label>
      </div>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          display: 'block',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
        }}
      />
    </>
  );
}
