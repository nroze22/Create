// DEPTH lens — estimate per-pixel depth on-device, then render the photo as an
// interactive 3D point cloud you can orbit with a finger.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getDepth } from './ai';
import type { Lens, LensContext, LensResult } from './types';

// Points across the largest side of the cloud. Tuned to stay smooth on phones
// (~30k points for a 4:3 image) while looking dense.
const GRID = 200;
const DEPTH_AMOUNT = 0.95;

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const vertexShader = /* glsl */ `
  attribute vec3 color;
  uniform float uSize;
  uniform float uIntro;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec3 p = position;
    p.z *= uIntro;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float a = smoothstep(0.25, 0.10, d);
    gl_FragColor = vec4(vColor, a);
  }
`;

export const depthLens: Lens = {
  loadTitle: 'Loading Depth Anything V2…',

  async run(ctx: LensContext): Promise<LensResult> {
    const pipe = await getDepth(ctx.onProgress);
    const { depth } = (await pipe(ctx.source.url)) as { depth: { resize(w: number, h: number): Promise<{ data: Uint8Array | Uint8ClampedArray }> } };

    const { w: gw, h: gh } = ctx.source.fitDims(GRID);
    const colorData = ctx.source.toCanvas(gw, gh).getContext('2d')!.getImageData(0, 0, gw, gh).data;
    const depthMap = await depth.resize(gw, gh);
    const dData = depthMap.data;

    // Build the point cloud geometry.
    const count = gw * gh;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const aspect = gw / gh;
    const sx = aspect >= 1 ? aspect : 1;
    const sy = aspect >= 1 ? 1 : 1 / aspect;

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const idx = y * gw + x;
        const d = dData[idx] / 255; // brighter = closer
        positions[idx * 3] = (x / (gw - 1) - 0.5) * 2 * sx;
        positions[idx * 3 + 1] = -(y / (gh - 1) - 0.5) * 2 * sy;
        positions[idx * 3 + 2] = (d - 0.5) * 2 * DEPTH_AMOUNT;
        const ci = idx * 4;
        colors[idx * 3] = srgbToLinear(colorData[ci]);
        colors[idx * 3 + 1] = srgbToLinear(colorData[ci + 1]);
        colors[idx * 3 + 2] = srgbToLinear(colorData[ci + 2]);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: 2.0 * dpr * sy },
        uIntro: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: true,
    });

    const points = new THREE.Points(geometry, material);
    const scene = new THREE.Scene();
    scene.add(points);

    // Renderer + camera.
    const container = ctx.container;
    container.classList.add('cloud');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(dpr);
    const canvas = renderer.domElement;
    container.appendChild(canvas);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(0, 0, 2.7);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.rotateSpeed = 0.7;

    // Stop auto-rotation once the user takes control.
    const stopSpin = () => (controls.autoRotate = false);
    canvas.addEventListener('pointerdown', stopSpin, { once: true });

    const badge = document.createElement('div');
    badge.className = 'cloud-badge';
    badge.textContent = `${count.toLocaleString()} points · drag to orbit · pinch to zoom`;
    container.appendChild(badge);

    function resize() {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Animate the relief rising from flat, then render continuously.
    const start = performance.now();
    let raf = 0;
    const render = (now: number) => {
      const t = Math.min((now - start) / 1200, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      material.uniforms.uIntro.value = eased;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    ctx.setHint('Drag to orbit. A flat photo, reborn in 3D — computed entirely on your device.');
    ctx.enableDownload(() => {
      controls.autoRotate = false;
      renderer.render(scene, camera);
      const a = document.createElement('a');
      a.download = 'prism-depth.png';
      a.href = renderer.domElement.toDataURL('image/png');
      a.click();
    });

    return {
      dispose() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        controls.dispose();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
        badge.remove();
        container.classList.remove('cloud');
      },
    };
  },
};
