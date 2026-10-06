import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  withLightBar?: boolean
  tilt?: boolean
  as?: 'div' | 'section' | 'article'
}

/**
 * Frosted surface with layered soft-3D shadows. Optional pointer tilt and the
 * signature top light bar that reads as a grazing light source.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, withLightBar = true, tilt = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'glass glass-card soft-3d',
          withLightBar && 'light-bar',
          tilt && 'transition-transform duration-200 ease-out hover:[transform:perspective(1000px)_rotateX(1.6deg)_translateY(-4px)]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = 'GlassCard'
