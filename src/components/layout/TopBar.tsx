import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { NotificationToggle } from "@/components/notifications/NotificationToggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Search, Plus, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export const TopBar = ({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  className,
}: TopBarProps) => {
  const { t } = useLanguage();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur-sm",
        "flex items-center justify-between px-6",
        className
      )}
    >
      <div className="flex items-center gap-6">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Home className="w-4 h-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((crumb, index) => (
                <BreadcrumbItem key={index}>
                  <BreadcrumbSeparator />
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Title */}
        {title && !breadcrumbs.length && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {actions}
        <ThemeSwitcher />
        <LanguageSwitcher />
        <NotificationCenter />
        <NotificationToggle />
      </div>
    </header>
  );
};