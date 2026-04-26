import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#e3ede3] text-apple-dark',
  success: 'bg-primary-muted text-primary-dark',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-apple-danger/10 text-apple-danger',
  info: 'bg-primary-muted text-primary-dark',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
