import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";
import logoImage from "@/assets/logo.png";

interface LogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "full" | "icon" | "text";
}

const sizeClasses = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const textSizeClasses = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

export const Logo = ({
  className,
  size = "md",
  showText = true,
  variant = "full",
}: LogoProps) => {
  if (variant === "text") {
    return (
      <span className={cn("font-bold text-gradient", textSizeClasses[size], className)}>
        {BRAND.name}
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <img
        src={logoImage}
        alt={BRAND.fullName}
        className={cn("object-contain rounded-lg", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={logoImage}
        alt={BRAND.fullName}
        className={cn("object-contain rounded-lg", sizeClasses[size])}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={cn("font-bold leading-tight", textSizeClasses[size])}>
            {BRAND.name}
          </span>
          {size !== "xs" && size !== "sm" && (
            <span className="text-xs text-muted-foreground leading-tight">
              Global Logistics
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
