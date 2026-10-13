import * as THREE from 'three';

export const C = {
  blue: '#2f5bea',
  blueDark: '#2347c2',
  blueRoof: '#5a80f2',
  blueRib: '#2950d6',
  navy: '#1b2754',
  white: '#f7f9fc',
  ground: '#f1f4f8',
  road: '#d6dce6',
  apron: '#e4e9f0',
  line: '#ffffff',
  grass: '#bfe0a4',
  grassDark: '#a6d48a',
  tree: '#74c27a',
  treeDark: '#5aae63',
  trunk: '#9a7b5f',
  box: '#d8a46a',
  boxDark: '#c48d55',
  pallet: '#a97c50',
  forklift: '#f4b52c',
  rubber: '#2a2f3a',
  glass: '#2b3a67',
} as const;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const FONT = '"Plus Jakarta Sans Variable", system-ui, sans-serif';

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fg: string, bg: string) {
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.24);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y + s * 0.47);
  ctx.lineTo(x + s * 0.5, y + s * 0.27);
  ctx.lineTo(x + s * 0.8, y + s * 0.47);
  ctx.lineTo(x + s * 0.8, y + s * 0.76);
  ctx.lineTo(x + s * 0.2, y + s * 0.76);
  ctx.closePath();
  ctx.fill();
}

let logoTex: THREE.Texture | null = null;
/** White wordmark on transparent, for building walls and trailers. */
export function logoTexture() {
  return (logoTex ??= canvasTexture(512, 128, (ctx) => {
    drawMark(ctx, 8, 14, 100, '#ffffff', C.blue);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 76px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Hubline', 128, 68);
  }));
}

const bayTex = new Map<number, THREE.Texture>();
export function bayTexture(n: number) {
  let t = bayTex.get(n);
  if (!t) {
    t = canvasTexture(128, 64, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(0, 0, 128, 64, 12);
      ctx.fill();
      ctx.fillStyle = C.navy;
      ctx.font = `800 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 64, 34);
    });
    bayTex.set(n, t);
  }
  return t;
}

let stripeTex: THREE.Texture | null = null;
/** Inbound carriers' trailers: white with a blue band. */
export function stripeTexture() {
  return (stripeTex ??= canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = C.white;
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = C.blue;
    ctx.fillRect(0, 44, 256, 8);
  }));
}

/**
 * One storey of curtain wall: a 2×1 grid of windows on a light frame. Repeats across tower
 * faces; the bottom-left corner is plain frame colour, which roofs sample.
 */
export function windowTexture() {
  const tex = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#9db1d2';
    for (const x of [6, 36]) ctx.fillRect(x, 10, 22, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const x of [6, 36]) ctx.fillRect(x, 10, 22, 12);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
