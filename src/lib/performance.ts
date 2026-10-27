/**
 * Low-end device detection ("lite" mode).
 *
 * On weak hardware the costliest work is GPU-side: the infinitely drifting,
 * 90px-blurred aurora forces every glass surface (backdrop-filter) to re-blur
 * on each frame, and per-row spring animations on large tables keep the main
 * thread busy. Lite mode keeps the exact same look but freezes/cheapens those
 * effects. Capable machines are untouched.
 */

type NavigatorWithMemory = Navigator & { deviceMemory?: number }

function usesSoftwareRendering(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')
    if (!gl || !(gl instanceof WebGLRenderingContext)) return true
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return /swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer)
  } catch {
    return false
  }
}

function detectLiteMode(): boolean {
  if (typeof window === 'undefined') return false

  const nav = navigator as NavigatorWithMemory
  const cores = nav.hardwareConcurrency ?? 8
  const memoryGb = nav.deviceMemory ?? 8
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  if (cores <= 4 || memoryGb <= 4 || prefersReducedMotion) return true
  return usesSoftwareRendering()
}

export const isLiteMode = detectLiteMode()

export function applyPerformanceMode(): void {
  document.documentElement.classList.toggle('perf-lite', isLiteMode)
}

/** Warm route chunks once the UI is idle so navigation stays instant. */
export function preloadWhenIdle(loaders: Array<() => Promise<unknown>>): void {
  const run = () => {
    for (const load of loaders) void load().catch(() => undefined)
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 3000 })
  } else {
    setTimeout(run, 1200)
  }
}
