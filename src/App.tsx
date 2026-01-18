import { LanguageProvider } from "./i18n/LanguageContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GeofenceProvider } from "./contexts/GeofenceContext";
import { FacilityGeofenceProvider } from "./contexts/FacilityGeofenceContext";
import { ActiveNavigationProvider } from "./contexts/ActiveNavigationContext";
import { DiagnosticsProvider } from "./contexts/DiagnosticsContext";
import { PoiFeedbackProvider } from "./contexts/PoiFeedbackContext";
import { ChatProvider } from "./contexts/ChatContext";
import DiagnosticsPanel from "./components/diagnostics/DiagnosticsPanel";
import LocationPermissionRequest from "./components/location/LocationPermissionRequest";
import { DriverChatSheet } from "./components/ai/DriverChatSheet";
import FloatingChatButton from "./components/chat/FloatingChatButton";
import { DocumentReminderProvider } from "./components/notifications/DocumentReminderProvider";
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
import FavoriteMealsScreen from "./pages/FavoriteMeals";
import SubscriptionScreen from "./pages/Subscription";
import RatingHistoryScreen from "./pages/RatingHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <DiagnosticsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DiagnosticsPanel />
          <LocationPermissionRequest />
          <DriverChatSheet />
          <DocumentReminderProvider />
          <BrowserRouter>
            <ChatProvider>
              <ActiveNavigationProvider>
                <PoiFeedbackProvider>
                  <GeofenceProvider>
                    <FacilityGeofenceProvider>
                      <FloatingChatButton />
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
                        <Route path="/favorite-meals" element={<FavoriteMealsScreen />} />
                        <Route path="/subscription" element={<SubscriptionScreen />} />
                        <Route path="/rating-history" element={<RatingHistoryScreen />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </FacilityGeofenceProvider>
                  </GeofenceProvider>
                </PoiFeedbackProvider>
              </ActiveNavigationProvider>
            </ChatProvider>
          </BrowserRouter>
        </TooltipProvider>
      </DiagnosticsProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

