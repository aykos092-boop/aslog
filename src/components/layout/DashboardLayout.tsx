import { ReactNode } from "react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { MobileHeader } from "./MobileHeader";
import { AIChatBot } from "@/components/ai/AIChatBot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const { loading } = useFirebaseAuth();
  const isMobile = useIsMobile();

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
      {/* Mobile Header with Burger Menu */}
      <MobileHeader />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 transition-all duration-300">
        {/* Desktop TopBar */}
        <div className="hidden lg:block">
          <TopBar
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            actions={actions}
          />
        </div>

        <main
          className={cn(
            "min-h-[calc(100vh-4rem)]",
            !fullWidth && "container py-4 md:py-6 px-4"
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
