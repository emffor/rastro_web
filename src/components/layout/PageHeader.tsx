import { ArrowLeft } from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  showBackButton?: boolean;
  backUrl?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  showBackButton,
  backUrl,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {showBackButton && backUrl && (
              <Link
                to={backUrl}
                className="p-1 -ml-1 text-apple-secondary hover:text-apple-dark rounded-lg hover:bg-primary-muted transition-colors shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </Link>
            )}
            <h1 className="text-2xl sm:text-3xl font-semibold text-apple-dark tracking-tight break-words">
              {title}
            </h1>
          </div>
          {description && (
            <p className="mt-1 text-sm sm:text-base text-apple-secondary break-words">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="w-full sm:w-auto flex flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
