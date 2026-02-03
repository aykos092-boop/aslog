import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/ui/Logo";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Truck,
  Star,
  Users,
  Settings,
  LogOut,
  Shield,
  MessageSquare,
  Heart,
  User,
  BarChart3,
  FileText,
  Navigation,
  Plus,
  Wallet,
  Banknote,
  Warehouse,
} from "lucide-react";

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
}

const clientNavItems: NavItem[] = [
  { title: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "orders.myOrders", icon: Package, href: "/dashboard#orders" },
  { title: "deals.myDeals", icon: FileText, href: "/dashboard#deals" },
  { title: "favorites.title", icon: Heart, href: "/dashboard#favorites" },
  { title: "orders.createNew", icon: Plus, href: "/dashboard#create-order" },
  { title: "wallet.deposit", icon: Banknote, href: "/wallet-deposit" },
  { title: "subscription.title", icon: Wallet, href: "/subscription" },
];

const carrierNavItems: NavItem[] = [
  { title: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "orders.available", icon: Truck, href: "/dashboard#available" },
  { title: "carrier.myResponses", icon: MessageSquare, href: "/dashboard#responses" },
  { title: "deals.myDeals", icon: FileText, href: "/dashboard#deals" },
  { title: "carrier.navigation", icon: Navigation, href: "/dashboard#navigation" },
  { title: "carrier.achievements", icon: Star, href: "/dashboard#achievements" },
  { title: "carrier.preferences", icon: Settings, href: "/dashboard#settings" },
  { title: "wallet.deposit", icon: Banknote, href: "/wallet-deposit" },
  { title: "subscription.title", icon: Wallet, href: "/subscription" },
];

const adminNavItems: NavItem[] = [
  { title: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "admin.users", icon: Users, href: "/admin#users" },
  { title: "admin.deals", icon: FileText, href: "/admin#deals" },
  { title: "admin.analytics", icon: BarChart3, href: "/admin#analytics" },
  { title: "wms.title", icon: Warehouse, href: "/wms" },
  { title: "wallet.deposit", icon: Banknote, href: "/wallet-deposit" },
];

const wmsNavItems: NavItem[] = [
  { title: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "wms.title", icon: Warehouse, href: "/wms" },
  { title: "wallet.deposit", icon: Banknote, href: "/wallet-deposit" },
];

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useFirebaseAuth();
  const { t } = useLanguage();

  const navItems = role === "admin" ? adminNavItems : 
                   role === "carrier" ? carrierNavItems : 
                   (role as string === "warehouse_manager" || role as string === "storekeeper") ? wmsNavItems : 
                   clientNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getRoleColor = () => {
    switch (role as string) {
      case "client": return "bg-customer/10 text-customer";
      case "carrier": return "bg-driver/10 text-driver";
      case "admin": return "bg-admin/10 text-admin";
      case "warehouse_manager": return "bg-orange-500/10 text-orange-500";
      case "storekeeper": return "bg-blue-500/10 text-blue-500";
      default: return "bg-primary/10 text-primary";
    }
  };

  const getRoleIcon = () => {
    switch (role as string) {
      case "client": return <User className="w-3.5 h-3.5" />;
      case "carrier": return <Truck className="w-3.5 h-3.5" />;
      case "admin": return <Shield className="w-3.5 h-3.5" />;
      case "warehouse_manager": return <Warehouse className="w-3.5 h-3.5" />;
      case "storekeeper": return <Package className="w-3.5 h-3.5" />;
      default: return <User className="w-3.5 h-3.5" />;
    }
  };

  const isActive = (href: string) => {
    if (href.includes('#')) {
      return location.pathname + location.hash === href;
    }
    return location.pathname === href && !location.hash;
  };

  const handleNavClick = (href: string) => {
    // Navigate to the hash route
    navigate(href);
  };

  return (
    <TooltipProvider>
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Header with Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo size="sm" showText={true} />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  handleNavClick(item.href);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left",
                  "hover:bg-accent group relative",
                  active && "bg-primary/10 text-primary font-medium",
                  !active && "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  active && "text-primary",
                  !active && "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="text-sm truncate">{t(item.title) || item.title}</span>
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-3">
          {/* User Info */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarFallback className={cn("text-sm font-medium", getRoleColor())}>
                {user?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.email?.split("@")[0]}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {getRoleIcon()}
                <span className="text-xs text-muted-foreground capitalize">
                  {t(`role.${role}`) || role}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/profile")}
                  className="h-9 w-9"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("nav.profile") || "Профиль"}
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("auth.logout") || "Выйти"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>

    </TooltipProvider>
  );
};
