import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { AIChatBot } from "@/components/ai/AIChatBot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  fullWidth?: boolean;
}

export const DashboardLayout = ({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
  fullWidth = false,
}: DashboardLayoutProps) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <div className="pl-[72px] lg:pl-64 transition-all duration-300">
        <TopBar
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          actions={actions}
        />

        <main
          className={cn(
            "min-h-[calc(100vh-4rem)]",
            !fullWidth && "container py-6"
          )}
        >
          {children}
        </main>
      </div>

      {/* AI Chat Bot */}
      <AIChatBot />
    </div>
  );
};