import { avatarGradient, cn, initials } from '@/lib/utils'

interface AvatarProps {
  fullName: string
  id: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg'
}

export function Avatar({ fullName, id, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold text-accent-ink shadow-[inset_0_1px_0_rgb(var(--c-accent-ink)/0.35),var(--shadow-key)]',
        SIZES[size],
        className
      )}
      style={{ backgroundImage: avatarGradient(id) }}
      title={fullName}
    >
      {initials(fullName)}
    </div>
  )
}
