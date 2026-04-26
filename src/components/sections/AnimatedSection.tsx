import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface AnimatedSectionProps {
  children: ReactNode
  className?: string
  delay?: number
}

const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
}

export function AnimatedSection({ children, className, delay = 0 }: AnimatedSectionProps) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div className={cn('', className)}>{children}</div>
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        duration: 0.35,
        delay,
        ease: 'easeOut',
      }}
      variants={fadeInUp}
      className={cn('', className)}
    >
      {children}
    </motion.div>
  )
}
