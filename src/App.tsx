import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
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
import MapboxNavigator from "./pages/MapboxNavigator";
import ClientTracking from "./pages/ClientTracking";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
                {/* Client Tracking - real-time driver location for clients */}
                <Route path="/tracking/:dealId" element={<ClientTracking />} />
                {/* Mapbox Navigator - new 3D navigation */}
                <Route path="/navigate/:dealId" element={<MapboxNavigator />} />
                <Route path="/navigator" element={<MapboxNavigator />} />
                <Route path="/navigator/order/:orderId" element={<MapboxNavigator />} />
                <Route path="/navigator/deal/:dealId" element={<MapboxNavigator />} />
                {/* Legacy Navigator */}
                <Route path="/navigator-legacy/:dealId" element={<UnifiedNavigator />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/profile" element={<UserProfile />} />
                <Route path="/profile/:userId" element={<UserProfile />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
