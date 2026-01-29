import { Button } from "@/components/ui/button";
import { Building2, Truck, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export const RolesSection = () => {
  const { t } = useLanguage();

  const roles = [
    {
      id: "customer",
      icon: User,
      titleKey: "role.client",
      emoji: "🧑‍💼",
      descKey: "landing.roles.clientDesc",
      features: [
        "landing.roles.clientF1",
        "landing.roles.clientF2",
        "landing.roles.clientF3",
        "landing.roles.clientF4",
      ],
      variant: "customer" as const,
      bgClass: "bg-customer-light",
      borderClass: "border-customer/20",
    },
    {
      id: "driver",
      icon: Truck,
      titleKey: "role.driver",
      emoji: "🚚",
      descKey: "landing.roles.driverDesc",
      features: [
        "landing.roles.driverF1",
        "landing.roles.driverF2",
        "landing.roles.driverF3",
        "landing.roles.driverF4",
      ],
      variant: "driver" as const,
      bgClass: "bg-driver-light",
      borderClass: "border-driver/20",
    },
  ];

  return (
    <section id="roles" className="py-24">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t("landing.roles.title")}</h2>
          <p className="text-muted-foreground">{t("landing.roles.subtitle")}</p>
        </div>

        {/* Roles Grid */}
        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {roles.map((role, index) => (
            <div
              key={role.id}
              className={`relative rounded-3xl p-8 border-2 ${role.borderClass} ${role.bgClass} card-hover animate-fade-in group`}
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {/* Role Icon & Title */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center gradient-${role.id} transition-transform group-hover:scale-110 group-hover:rotate-3`}
                >
                  <role.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{role.emoji}</span>
                    <h3 className="text-xl font-bold text-foreground">{t(role.titleKey)}</h3>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-muted-foreground mb-6">{t(role.descKey)}</p>

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                {role.features.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className={`w-5 h-5 text-${role.id} shrink-0`} />
                    {t(featureKey)}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link to="/signup">
                <Button variant={role.variant} className="w-full group/btn">
                  {t("landing.roles.startAs")} {t(role.titleKey)}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
