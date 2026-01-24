import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLanguage } from "@/contexts/LanguageContext";

export const NotificationToggle = () => {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications();
  const { t } = useLanguage();

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size="sm"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <>
          <Bell className="w-4 h-4 mr-2" />
          {t("notificationToggle.enabled")}
        </>
      ) : (
        <>
          <BellOff className="w-4 h-4 mr-2" />
          {t("notificationToggle.enable")}
        </>
      )}
    </Button>
  );
};