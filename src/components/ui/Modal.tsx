import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  className?: string;
  bodyClassName?: string;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  icon,
  size = "md",
  className,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
            onClick={onClose}
          />
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "my-auto w-full max-h-[calc(100dvh-1rem)] bg-white rounded-2xl shadow-xl border border-primary-muted overflow-hidden",
                sizeStyles[size],
                className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {title && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-primary-muted">
                  <div className="flex items-center gap-3">
                    {icon && (
                      <div className="shrink-0 p-2 bg-primary/10 rounded-xl">
                        <div className="text-primary">{icon}</div>
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-semibold text-apple-dark">
                        {title}
                      </h2>
                      {subtitle && (
                        <p className="text-sm text-apple-secondary mt-0.5">
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-apple-secondary hover:text-apple-dark hover:bg-primary-muted transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div
                className={cn(
                  "p-4 sm:p-6 max-h-[calc(100dvh-130px)] overflow-y-auto scrollbar-thin",
                  bodyClassName,
                )}
              >
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
