import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Star, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-customer/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-company/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-driver/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <MapPin className="w-4 h-4" />
            {t("landing.hero.badge")}
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {t("landing.hero.title")}{" "}
            <span className="text-gradient">{t("landing.hero.titleHighlight")}</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {t("landing.hero.subtitle")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/auth">
              <Button variant="hero" size="xl" className="group">
                {t("landing.hero.cta")}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button variant="outline" size="xl">
              {t("landing.hero.demo")}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="text-center group cursor-pointer">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1 transition-transform group-hover:scale-110">5K+</div>
              <div className="text-sm text-muted-foreground">{t("landing.hero.deliveries")}</div>
            </div>
            <div className="text-center group cursor-pointer">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1 transition-transform group-hover:scale-110">500+</div>
              <div className="text-sm text-muted-foreground">{t("landing.hero.drivers")}</div>
            </div>
            <div className="text-center group cursor-pointer">
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1 transition-transform group-hover:scale-110">4.9</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Star className="w-4 h-4 text-gold fill-gold" />
                {t("landing.hero.rating")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Truck Icon */}
      <div className="absolute bottom-20 right-20 hidden lg:block animate-float" style={{ animationDelay: "0.5s" }}>
        <div className="w-20 h-20 gradient-hero rounded-2xl flex items-center justify-center shadow-2xl">
          <Truck className="w-10 h-10 text-white" />
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  );
};
