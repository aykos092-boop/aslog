import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/ui/Logo";
import {
  Menu,
  LayoutDashboard,
  Package,
  Truck,
  Star,
  Users,
  Settings,
  LogOut,
  MessageSquare,
  Heart,
  BarChart3,
  FileText,
  Navigation,
  Wallet,
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
];

const carrierNavItems: NavItem[] = [
  { title: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "orders.available", icon: Truck, href: "/dashboard#available" },
  { title: "carrier.myResponses", icon: MessageSquare, href: "/dashboard#responses" },
  { title: "deals.myDeals", icon: FileText, href: "/dashboard#deals" },
  { title: "carrier.navigation", icon: Navigation, href: "/dashboard#navigation" },
  { title: "carrier.achievements", icon: Star, href: "/dashboard#achievements" },
];

const adminNavItems: NavItem[] = [
  { title: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { title: "admin.users", icon: Users, href: "/admin#users" },
  { title: "admin.deals", icon: FileText, href: "/admin#deals" },
  { title: "admin.analytics", icon: BarChart3, href: "/admin#analytics" },
];

export const MobileHeader = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const { t } = useLanguage();

  const navItems = role === "admin" ? adminNavItems : role === "carrier" ? carrierNavItems : clientNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    setOpen(false);
  };

  const handleNavigation = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  const isActive = (href: string) => {
    if (href.includes('#')) {
      return location.pathname + location.hash === href;
    }
    return location.pathname === href && !location.hash;
  };

  const getRoleColor = () => {
    switch (role) {
      case "client": return "bg-customer/10 text-customer";
      case "carrier": return "bg-driver/10 text-driver";
      case "admin": return "bg-admin/10 text-admin";
      default: return "bg-primary/10 text-primary";
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case "client": return t("role.client") || "Клиент";
      case "carrier": return t("role.carrier") || "Перевозчик";
      case "admin": return t("role.admin") || "Админ";
      default: return "";
    }
  };

  return (
    <header className="lg:hidden sticky top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2">
        <Logo size="xs" showText={true} />
      </Link>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        <NotificationCenter />
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border shrink-0">
              <SheetTitle className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className={cn("text-sm font-medium", getRoleColor())}>
                    {user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">
                    {user?.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {getRoleLabel()}
                  </p>
                </div>
              </SheetTitle>
            </SheetHeader>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors",
                      active ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5",
                      active ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm">{t(item.title) || item.title}</span>
                  </button>
                );
              })}

              {/* Divider */}
              <div className="h-px bg-border my-2" />

              {/* Profile */}
              <button
                onClick={() => handleNavigation("/profile")}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left hover:bg-accent transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">{t("nav.profile") || "Профиль"}</span>
              </button>
            </nav>

            {/* Theme & Language & Logout */}
            <div className="border-t border-border p-3 space-y-2 shrink-0">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-muted-foreground">{t("settings.theme") || "Тема"}</span>
                <ThemeSwitcher />
              </div>
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-muted-foreground">{t("settings.language") || "Язык"}</span>
                <LanguageSwitcher />
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">{t("auth.logout") || "Выйти"}</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
