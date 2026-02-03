import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SubscriptionManager } from "@/components/subscription/SubscriptionManager";
import { useLanguage } from "@/contexts/LanguageContext";

const Subscription = () => {
  const { t } = useLanguage();

  const breadcrumbs = [
    { label: t("nav.dashboard"), href: "/dashboard" },
    { label: t("subscription.title") || "Подписка" },
  ];

  return (
    <DashboardLayout 
      title={t("subscription.title") || "Подписка"} 
      subtitle={t("subscription.subtitle") || "Управляйте своим планом подписки"}
      breadcrumbs={breadcrumbs}
    >
      <div className="max-w-6xl mx-auto animate-fade-up">
        <SubscriptionManager />
      </div>
    </DashboardLayout>
  );
};

export default Subscription;
