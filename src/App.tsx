import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { FirebaseAuthProvider } from "@/hooks/useFirebaseAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import OrderResponses from "./pages/OrderResponses";
import OrderChat from "./pages/OrderChat";
import DealChat from "./pages/DealChat";
import UserProfile from "./pages/UserProfile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import ApiDocs from "./pages/ApiDocs";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";
import UnifiedNavigator from "./pages/UnifiedNavigator";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <FirebaseAuthProvider>
              <AuthProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/orders/:orderId/responses" element={<OrderResponses />} />
                  <Route path="/orders/:orderId/chat/:carrierId" element={<OrderChat />} />
                  <Route path="/deals/:dealId/chat" element={<DealChat />} />
                  <Route path="/navigate/:dealId" element={<UnifiedNavigator />} />
                  <Route path="/navigator" element={<UnifiedNavigator />} />
                  <Route path="/navigator/:orderId" element={<UnifiedNavigator />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/subscription" element={<Subscription />} />
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/profile/:userId" element={<UserProfile />} />
                  <Route path="/api-docs" element={<ApiDocs />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </FirebaseAuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
