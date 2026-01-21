import { MessageSquare, Shield, Star, TrendingUp, Users, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    {
      icon: MessageSquare,
      titleKey: "landing.features.chat",
      descKey: "landing.features.chatDesc",
      color: "customer",
    },
    {
      icon: Shield,
      titleKey: "landing.features.security",
      descKey: "landing.features.securityDesc",
      color: "driver",
    },
    {
      icon: Star,
      titleKey: "landing.features.ratings",
      descKey: "landing.features.ratingsDesc",
      color: "company",
    },
    {
      icon: TrendingUp,
      titleKey: "landing.features.analytics",
      descKey: "landing.features.analyticsDesc",
      color: "customer",
    },
    {
      icon: Users,
      titleKey: "landing.features.roles",
      descKey: "landing.features.rolesDesc",
      color: "driver",
    },
    {
      icon: Zap,
      titleKey: "landing.features.fast",
      descKey: "landing.features.fastDesc",
      color: "company",
    },
  ];

  const colorClasses = {
    customer: "bg-customer/10 text-customer",
    driver: "bg-driver/10 text-driver",
    company: "bg-company/10 text-company",
  };

  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("landing.features.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("landing.features.subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.titleKey}
              className="group bg-card rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 animate-fade-in cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3 ${
                  colorClasses[feature.color as keyof typeof colorClasses]
                }`}
              >
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t(feature.titleKey)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
