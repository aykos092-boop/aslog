import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { EmailVerificationTimer } from "./EmailVerificationTimer";

interface EmailVerificationWrapperProps {
  children: React.ReactNode;
}

export const EmailVerificationWrapper: React.FC<EmailVerificationWrapperProps> = ({ children }) => {
  const { user, emailVerified, loading } = useFirebaseAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !emailVerified) {
      // User is logged in but email is not verified
      // Show verification screen instead of dashboard
      return;
    }
  }, [user, emailVerified, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is logged in but email is not verified, show verification screen
  if (user && !emailVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-customer/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-driver/10 rounded-full blur-3xl" />
        </div>

        <EmailVerificationTimer
          email={user.email || ""}
          onVerified={() => {
            // Email verified, navigate will happen automatically
            window.location.reload();
          }}
          onError={(error) => {
            console.error("Email verification error:", error);
          }}
        />
      </div>
    );
  }

  // Email is verified or no user, show children
  return <>{children}</>;
};
