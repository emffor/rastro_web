import { cn } from '../../lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = getInitials(name)

  return src ? (
    <img
      src={src}
      alt={name ?? 'Avatar'}
      className={cn(
        'rounded-full object-cover',
        sizeStyles[size],
        className
      )}
    />
  ) : (
    <div
      className={cn(
        'rounded-full bg-primary text-white flex items-center justify-center font-medium',
        sizeStyles[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
