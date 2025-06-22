'use client';
import {useEffect, useRef, useState, useMemo} from 'react';
import styles from './Home.module.css';

const CELL_SIZE = 5;
const BASE_COLOR: [number, number, number] = [34, 34, 34]; // #222
const DEAD_COLOR: [number, number, number] = [255, 255, 255]; // white background
const GREEN: [number, number, number] = [0, 200, 0];
const RED: [number, number, number] = [220, 0, 0];
const FADE_FRAMES = 20;
const MAX_SPEED = 200;

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

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cellSize, setCellSize] = useState(CELL_SIZE);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });
  const [restartKey, setRestartKey] = useState(0);
  const [rawSpeed, setRawSpeed] = useState(MAX_SPEED);
  const speed = MAX_SPEED - rawSpeed;

  // Derive rows and cols from dimensions and cellSize
  const rows = useMemo(
    () => Math.floor(dimensions.height / cellSize),
    [dimensions.height, cellSize],
  );
  const cols = useMemo(
    () => Math.floor(dimensions.width / cellSize),
    [dimensions.width, cellSize],
  );

  // Memoize initial grid and color grid
  const initialGrid = useMemo(() => randomizeGrid(createEmptyGrid(rows, cols)), [rows, cols]);
  const initialColorGrid = useMemo(
    () => Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        color: DEAD_COLOR as [number, number, number],
        fade: 0,
        target: DEAD_COLOR as [number, number, number],
      }))
    ),
    [rows, cols]
  );

  const gridRef = useRef<number[][]>(initialGrid);
  const colorGridRef = useRef<
    {
      color: [number, number, number];
      fade: number;
      target: [number, number, number];
    }[][]
  >(initialColorGrid);

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({width, height});
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset grid and color grid on cellSize, dimensions, or restartKey change
  useEffect(() => {
    gridRef.current = randomizeGrid(createEmptyGrid(rows, cols));
    colorGridRef.current = Array.from({length: rows}, () =>
      Array.from({length: cols}, () => ({
        color: DEAD_COLOR,
        fade: 0,
        target: DEAD_COLOR,
      })),
    );
  }, [rows, cols, restartKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

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
            const lerped = lerpColor(
              colorState.color as [number, number, number],
              colorState.target as [number, number, number],
              t,
            );
            colorState.color = [lerped[0], lerped[1], lerped[2]];
          }

          ctx.fillStyle = `rgb(${colorState.color[0]},${colorState.color[1]},${colorState.color[2]})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
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

    update();
    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      clearTimeout(timeoutId);
    };
  }, [dimensions, rows, cols, speed, restartKey, cellSize]);

  // Restart the simulation when the canvas is clicked
  useEffect(() => {
    function handleClick() {
      setRestartKey((prev) => prev + 1);
    }
    const canvas = canvasRef.current;
    canvas?.addEventListener('click', handleClick);
    return () => {
      canvas?.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
        }}
      />
      <div className={styles.panelContainer}>
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className={styles.toggleButton}
        >
          Settings
        </button>
        {isPanelOpen && (
          <div className={styles.panel}>
            <button
              onClick={() => setRestartKey((k) => k + 1)}
              className={styles.button}
            >
              Restart
            </button>
            <label className={styles.label}>
              <span style={{fontSize: '0.95rem', color: '#222'}}>Speed</span>
              <input
                type='range'
                min={0}
                max={MAX_SPEED}
                step={5}
                value={rawSpeed}
                onChange={(e) => setRawSpeed(Number(e.target.value))}
                className={styles.slider}
              />
              <span
                style={{
                  fontSize: '0.9rem',
                  minWidth: 40,
                  textAlign: 'right',
                  color: '#4f8cff',
                }}
              >
                {speed === 0 ? 'Max' : `${speed}ms`}
              </span>
            </label>
            <label className={styles.label}>
              <span style={{fontSize: '0.95rem', color: '#222'}}>
                Resolution
              </span>
              <input
                type='range'
                min={2}
                max={20}
                step={1}
                value={cellSize}
                onChange={(e) => setCellSize(Number(e.target.value))}
                className={styles.slider}
              />
              <span
                style={{
                  fontSize: '0.9rem',
                  minWidth: 40,
                  textAlign: 'right',
                  color: '#4f8cff',
                }}
              >
                {cellSize}px
              </span>
            </label>
          </div>
        )}
      </div>
    </>
  );
}
