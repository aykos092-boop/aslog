import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ClientTrackingPanel } from "@/components/tracking/ClientTrackingPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const ClientTracking = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const { user, loading: authLoading } = useFirebaseAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!dealId) {
    return (
      <DashboardLayout>
        <div className="text-center py-10 text-muted-foreground">
          {t("deals.notFound") || "Сделка не найдена"}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.back") || "Назад"}
        </Button>

        <ClientTrackingPanel dealId={dealId} />
      </div>
    </DashboardLayout>
  );
};

export default ClientTracking;
