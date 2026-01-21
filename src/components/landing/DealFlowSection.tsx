import { CheckCircle, MessageSquare, Package, Star, Truck, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const DealFlowSection = () => {
  const { t } = useLanguage();

  const steps = [
    {
      icon: Package,
      titleKey: "landing.flow.order",
      descKey: "landing.flow.orderDesc",
      color: "customer",
    },
    {
      icon: User,
      titleKey: "landing.flow.response",
      descKey: "landing.flow.responseDesc",
      color: "driver",
    },
    {
      icon: MessageSquare,
      titleKey: "landing.flow.negotiation",
      descKey: "landing.flow.negotiationDesc",
      color: "company",
    },
    {
      icon: CheckCircle,
      titleKey: "landing.flow.deal",
      descKey: "landing.flow.dealDesc",
      color: "customer",
    },
    {
      icon: Truck,
      titleKey: "landing.flow.delivery",
      descKey: "landing.flow.deliveryDesc",
      color: "driver",
    },
    {
      icon: Star,
      titleKey: "landing.flow.rating",
      descKey: "landing.flow.ratingDesc",
      color: "gold",
    },
  ];

  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("landing.flow.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("landing.flow.subtitle")}
          </p>
        </div>

        {/* Steps Timeline */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-customer via-driver to-gold md:-translate-x-1/2" />

            {/* Steps */}
            <div className="space-y-8">
              {steps.map((step, index) => (
                <div
                  key={step.titleKey}
                  className={`relative flex items-center gap-6 md:gap-12 animate-fade-in ${
                    index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Step Number & Icon */}
                  <div className="relative z-10 shrink-0 group">
                    <div className={`w-12 h-12 rounded-full gradient-${step.color === "gold" ? "hero" : step.color} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                      <step.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`flex-1 bg-card rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                    index % 2 === 0 ? "md:text-left" : "md:text-right"
                  }`}>
                    <div className={`flex items-center gap-2 mb-2 text-sm text-muted-foreground ${
                      index % 2 === 0 ? "md:justify-start" : "md:justify-end"
                    }`}>
                      <span className="font-medium">{t("landing.flow.step")} {index + 1}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {t(step.titleKey)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(step.descKey)}
                    </p>
                  </div>

                  {/* Spacer for alternating layout */}
                  <div className="hidden md:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
