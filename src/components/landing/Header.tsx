import { Button } from "@/components/ui/button";
import { Truck, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export const Header = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 gradient-hero rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Asia<span className="text-primary">Log</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t("landing.footer.features")}
            </a>
            <a href="#roles" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t("landing.roles.title")}
            </a>
            <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t("landing.trust.title")}
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            {user ? (
              <Link to="/dashboard">
                <Button variant="hero" size="sm">
                  {t("nav.dashboard")}
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    {t("auth.login")}
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="hero" size="sm">
                    {t("landing.hero.cta")}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-4">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {t("landing.footer.features")}
              </a>
              <a href="#roles" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {t("landing.roles.title")}
              </a>
              <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {t("landing.trust.title")}
              </a>
              <div className="pt-4">
                <LanguageSwitcher />
              </div>
              <div className="flex flex-col gap-2 pt-4">
                {user ? (
                  <Link to="/dashboard">
                    <Button variant="hero" size="sm" className="w-full">
                      {t("nav.dashboard")}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/auth">
                      <Button variant="outline" size="sm" className="w-full">
                        {t("auth.login")}
                      </Button>
                    </Link>
                    <Link to="/auth">
                      <Button variant="hero" size="sm" className="w-full">
                        {t("landing.hero.cta")}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
