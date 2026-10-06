import { useCallback, useRef } from 'react'

interface TiltOptions {
  max?: number
  scale?: number
}

/**
 * Soft-3D tilt: the element leans towards the pointer using CSS transforms.
 * Returns props to spread on a motion-capable element.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>({ max = 6, scale = 1.02 }: TiltOptions = {}) {
  const ref = useRef<T | null>(null)
  const frame = useRef<number | null>(null)

  const onMouseMove = useCallback(
    (event: React.MouseEvent<T>) => {
      const el = ref.current
      if (!el) return
      if (frame.current) cancelAnimationFrame(frame.current)

      frame.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const pointerX = (event.clientX - rect.left) / rect.width - 0.5
        const pointerY = (event.clientY - rect.top) / rect.height - 0.5
        el.style.transform = `perspective(1000px) rotateY(${pointerX * max}deg) rotateX(${
          -pointerY * max
        }deg) translateY(-4px) scale(${scale})`
      })
    },
    [max, scale]
  )

  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (frame.current) cancelAnimationFrame(frame.current)
    el.style.transform = ''
  }, [])

  return { ref, onMouseMove, onMouseLeave }
}
