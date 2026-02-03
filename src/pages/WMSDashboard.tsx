import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import WMSDashboard from "@/components/wms/WMSDashboard";

const WMSDashboardPage = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useFirebaseAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && (!user || !role)) {
      navigate("/login");
      return;
    }

    // Check if user has WMS permissions
    const checkWMSPermissions = async () => {
      if (!user) return;

      try {
        // Allow admin, warehouse_manager, and storekeeper only
        const hasPermission = role as string === 'admin' || 
                             role as string === 'warehouse_manager' || 
                             role as string === 'storekeeper';

        if (!hasPermission) {
          navigate("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Permission check failed:", error);
        navigate("/dashboard");
      }
    };

    if (user && role) {
      checkWMSPermissions();
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user || !role) {
    return null;
  }

  return <WMSDashboard />;
};

export default WMSDashboardPage;
