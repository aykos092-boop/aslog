import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MapPin, Star, Truck, Shield, Clock, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export const HeroSection = () => {
  const { t } = useLanguage();

  const stats = [
    { value: "5K+", label: t("landing.hero.deliveries"), icon: Truck },
    { value: "500+", label: t("landing.hero.drivers"), icon: Shield },
    { value: "4.9", label: t("landing.hero.rating"), icon: Star, isStar: true },
  ];

  const features = [
    { icon: Clock, label: "Real-time Tracking" },
    { icon: Shield, label: "Verified Carriers" },
    { icon: Globe, label: "Central Asia Wide" },
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-20 lg:pt-24 overflow-hidden">
      {/* Premium Background */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-[10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-[10%] w-[600px] h-[600px] bg-company/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-success/5 rounded-full blur-[150px]" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_70%)]" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="animate-fade-up">
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 shadow-sm"
            >
              <MapPin className="w-4 h-4 text-primary" />
              {t("landing.hero.badge")}
            </Badge>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-up stagger-1">
            {t("landing.hero.title")}{" "}
            <span className="text-gradient">{t("landing.hero.titleHighlight")}</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up stagger-2">
            {t("landing.hero.subtitle")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-up stagger-3">
            <Link to="/auth">
              <Button variant="hero" size="xl" className="group w-full sm:w-auto">
                {t("landing.hero.cta")}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button variant="outline" size="xl" className="w-full sm:w-auto">
              {t("landing.hero.demo")}
            </Button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-16 animate-fade-up stagger-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm"
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 lg:gap-12 max-w-lg mx-auto animate-fade-up stagger-5">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group cursor-default">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <span className="text-3xl md:text-4xl font-bold tracking-tight transition-transform group-hover:scale-105">
                    {stat.value}
                  </span>
                  {stat.isStar && <Star className="w-5 h-5 text-gold fill-gold" />}
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Decorations */}
      <div className="absolute bottom-32 right-16 hidden lg:block animate-float" style={{ animationDelay: "0.5s" }}>
        <div className="w-20 h-20 gradient-hero rounded-2xl flex items-center justify-center shadow-premium-lg glow-primary">
          <Truck className="w-10 h-10 text-white" />
        </div>
      </div>

      <div className="absolute top-40 left-16 hidden lg:block animate-float" style={{ animationDelay: "1s" }}>
        <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
          <Shield className="w-7 h-7 text-success" />
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