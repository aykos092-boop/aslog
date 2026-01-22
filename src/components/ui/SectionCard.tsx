import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const SectionCard = ({
  title,
  description,
  icon,
  badge,
  action,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) => {
  return (
    <Card className={cn("card-premium", className)}>
      <CardHeader className={cn("pb-4", headerClassName)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                {badge && (
                  <Badge variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                )}
              </div>
              {description && (
                <CardDescription className="text-sm">{description}</CardDescription>
              )}
            </div>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
};

interface QuickActionCardProps {
  title: string;
  description?: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "primary" | "success";
  className?: string;
}

export const QuickActionCard = ({
  title,
  description,
  icon,
  onClick,
  variant = "default",
  className,
}: QuickActionCardProps) => {
  const variantStyles = {
    default: "hover:border-border",
    primary: "hover:border-primary/50 hover:bg-primary/5",
    success: "hover:border-success/50 hover:bg-success/5",
  };

  const iconVariantStyles = {
    default: "bg-muted text-muted-foreground group-hover:bg-accent",
    primary: "bg-primary/10 text-primary group-hover:bg-primary/20",
    success: "bg-success/10 text-success group-hover:bg-success/20",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-2xl border border-border/50 bg-card",
        "flex items-center gap-4 text-left",
        "transition-all duration-200 group",
        variantStyles[variant],
        className
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
          "transition-all duration-200",
          iconVariantStyles[variant]
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {description}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
};

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  );
};