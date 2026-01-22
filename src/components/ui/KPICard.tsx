import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
  onClick?: () => void;
}

export const KPICard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className,
  onClick,
}: KPICardProps) => {
  const variantStyles = {
    default: "bg-card",
    primary: "bg-primary/5 border-primary/20",
    success: "bg-success/5 border-success/20",
    warning: "bg-warning/5 border-warning/20",
    danger: "bg-destructive/5 border-destructive/20",
  };

  const iconVariantStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? "text-success"
      : trend.value < 0
      ? "text-destructive"
      : "text-muted-foreground"
    : "";

  return (
    <div
      onClick={onClick}
      className={cn(
        "kpi-card group",
        variantStyles[variant],
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {trend && TrendIcon && (
            <div className={cn("flex items-center gap-1.5 text-sm font-medium", trendColor)}>
              <TrendIcon className="w-4 h-4" />
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && (
                <span className="text-muted-foreground font-normal">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              "transition-transform duration-300 group-hover:scale-110",
              iconVariantStyles[variant]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};