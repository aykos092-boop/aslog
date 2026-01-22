import { MessageSquare, Shield, Star, TrendingUp, Users, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: MessageSquare, titleKey: "landing.features.chat", descKey: "landing.features.chatDesc", color: "primary" },
    { icon: Shield, titleKey: "landing.features.security", descKey: "landing.features.securityDesc", color: "success" },
    { icon: Star, titleKey: "landing.features.ratings", descKey: "landing.features.ratingsDesc", color: "warning" },
    { icon: TrendingUp, titleKey: "landing.features.analytics", descKey: "landing.features.analyticsDesc", color: "primary" },
    { icon: Users, titleKey: "landing.features.roles", descKey: "landing.features.rolesDesc", color: "success" },
    { icon: Zap, titleKey: "landing.features.fast", descKey: "landing.features.fastDesc", color: "company" },
  ];

  const colorClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary/20",
    success: "bg-success/10 text-success group-hover:bg-success/20",
    warning: "bg-warning/10 text-warning group-hover:bg-warning/20",
    company: "bg-company/10 text-company group-hover:bg-company/20",
  };

  return (
    <section id="features" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            {t("landing.features.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("landing.features.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.titleKey}
              className="group card-interactive p-6 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300", colorClasses[feature.color])}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};