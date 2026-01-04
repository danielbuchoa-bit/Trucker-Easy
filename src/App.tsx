import { useEffect } from "react";
import { LanguageProvider } from "./i18n/LanguageContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GeofenceProvider } from "./contexts/GeofenceContext";
import { FacilityGeofenceProvider } from "./contexts/FacilityGeofenceContext";
import { ActiveNavigationProvider } from "./contexts/ActiveNavigationContext";
import WelcomeScreen from "./pages/Welcome";
import AuthScreen from "./pages/Auth";
import OnboardingScreen from "./pages/Onboarding";
import HomeScreen from "./pages/Home";
import StopsScreen from "./pages/Stops";
import ReportScreen from "./pages/Report";
import CommunityScreen from "./pages/Community";
import ProfileScreen from "./pages/Profile";
import PlaceDetailScreen from "./pages/PlaceDetail";
import CompanyReviewScreen from "./pages/CompanyReview";
import ChatRoomScreen from "./pages/ChatRoom";
import BypassHistory from "./pages/BypassHistory";
import Settings from "./pages/Settings";
import NavigationScreen from "./pages/Navigation";
import StopAdvisorScreen from "./pages/StopAdvisor";
import FacilityRatingScreen from "./pages/FacilityRating";
import FacilityDetailScreen from "./pages/FacilityDetail";
import FoodPreferencesScreen from "./pages/FoodPreferences";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// CRI4 TEMP: marcador visual + log para confirmar se o Safari está no mesmo build.
// (Remover após você confirmar que está sincronizado.)
const DEBUG_BUILD_STAMP = "CRI4-DEBUG-BUILD-2026-01-04T19:00Z";

const App = () => {
  useEffect(() => {
    const now = new Date().toISOString();
    // Log bem explícito para aparecer no Safari Web Inspector
    // (se você NÃO ver isso, você não está no mesmo ambiente/build)
    // eslint-disable-next-line no-console
    console.log(`[TRUCKEREASY][BUILD] ${DEBUG_BUILD_STAMP} loaded_at=${now}`);
    (window as any).__TRUCKEREASY_BUILD__ = { stamp: DEBUG_BUILD_STAMP, loadedAt: now };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          {/* CRI4 TEMP banner: prova visual imediata */}
          <div className="fixed left-0 right-0 top-0 z-[9999] safe-top pointer-events-none">
            <div className="mx-auto w-fit rounded-b-md bg-destructive px-3 py-1 text-xs font-mono text-destructive-foreground shadow">
              DEBUG BUILD ACTIVE • {DEBUG_BUILD_STAMP}
            </div>
          </div>

          <BrowserRouter>
            <GeofenceProvider>
              <FacilityGeofenceProvider>
                <ActiveNavigationProvider>
                  <Routes>
                    <Route path="/" element={<WelcomeScreen onComplete={() => {}} />} />
                    <Route path="/auth" element={<AuthScreen onComplete={() => {}} onBack={() => {}} />} />
                    <Route path="/onboarding" element={<OnboardingScreen onComplete={() => {}} onBack={() => {}} />} />
                    <Route path="/home" element={<HomeScreen />} />
                    <Route path="/stops" element={<StopsScreen />} />
                    <Route path="/report" element={<ReportScreen />} />
                    <Route path="/community" element={<CommunityScreen />} />
                    <Route path="/profile" element={<ProfileScreen />} />
                    <Route path="/place/:id" element={<PlaceDetailScreen />} />
                    <Route path="/company-review/:id" element={<CompanyReviewScreen />} />
                    <Route path="/chat/:id" element={<ChatRoomScreen />} />
                    <Route path="/bypass-history" element={<BypassHistory />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/navigation" element={<NavigationScreen />} />
                    <Route path="/stop-advisor" element={<StopAdvisorScreen />} />
                    <Route path="/facility-rating" element={<FacilityRatingScreen />} />
                    <Route path="/facility/:id" element={<FacilityDetailScreen />} />
                    <Route path="/food-preferences" element={<FoodPreferencesScreen />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ActiveNavigationProvider>
              </FacilityGeofenceProvider>
            </GeofenceProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;


