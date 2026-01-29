import { Button } from "@/components/ui/button";
import { Truck, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { cn } from "@/lib/utils";

export const Header = () => {
  const { user } = useFirebaseAuth();
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { href: "#features", label: t("landing.footer.features") },
    { href: "#roles", label: t("landing.roles.title") },
    { href: "#trust", label: t("landing.trust.title") },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-premium">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 gradient-hero rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-sm">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Asia<span className="text-primary">Log</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "text-muted-foreground hover:text-foreground",
                  "hover:bg-accent transition-all duration-200"
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <div className="w-px h-6 bg-border mx-2" />
            {user ? (
              <Link to="/dashboard">
                <Button variant="hero" size="sm">
                  {t("nav.dashboard")}
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    {t("auth.login")}
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="hero" size="sm">
                    {t("landing.hero.cta")}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-premium",
            isMenuOpen ? "max-h-96 pb-6" : "max-h-0"
          )}
        >
          <div className="pt-4 border-t border-border">
            <nav className="flex flex-col gap-1 mb-4">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2 px-4 mb-4">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
            <div className="flex flex-col gap-2 px-4">
              {user ? (
                <Link to="/dashboard">
                  <Button variant="hero" size="lg" className="w-full">
                    {t("nav.dashboard")}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="outline" size="lg" className="w-full">
                      {t("auth.login")}
                    </Button>
                  </Link>
                  <Link to="/signup">
                    <Button variant="hero" size="lg" className="w-full">
                      {t("landing.hero.cta")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};