import { LanguageProvider } from "./i18n/LanguageContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GeofenceProvider } from "./contexts/GeofenceContext";
import { FacilityGeofenceProvider } from "./contexts/FacilityGeofenceContext";
import { ActiveNavigationProvider } from "./contexts/ActiveNavigationContext";
import { DiagnosticsProvider } from "./contexts/DiagnosticsContext";
import { PoiFeedbackProvider } from "./contexts/PoiFeedbackContext";
import { ChatProvider } from "./contexts/ChatContext";
import { RoadTestProvider } from "./contexts/RoadTestContext";
import { EmotionalCheckInProvider } from "./contexts/EmotionalCheckInContext";
import { MedicationReminderProvider } from "./contexts/MedicationReminderContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { AuthProvider } from "./contexts/AuthContext";
import { DotHosProvider } from "./contexts/DotHosContext";
import DotSpeedFeeder from "./components/navigation/DotSpeedFeeder";
import DiagnosticsPanel from "./components/diagnostics/DiagnosticsPanel";
import RoadTestDiagnosticsPanel from "./components/diagnostics/RoadTestDiagnosticsPanel";
import LocationPermissionRequest from "./components/location/LocationPermissionRequest";
import { DriverChatSheet } from "./components/ai/DriverChatSheet";
import FloatingChatButton from "./components/chat/FloatingChatButton";
import { DocumentReminderProvider } from "./components/notifications/DocumentReminderProvider";
import EmotionalCheckInModal from "./components/wellness/EmotionalCheckInModal";
import CheckInTrigger from "./components/wellness/CheckInTrigger";
import EnglishQuickReturn from "./components/settings/EnglishQuickReturn";
import LanguageSuggestionModal from "./components/settings/LanguageSuggestionModal";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import WelcomeScreen from "./pages/Welcome";
import WebsiteScreen from "./pages/Website";
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
import SubscriptionSuccessScreen from "./pages/SubscriptionSuccess";
import ChoosePlanScreen from "./pages/ChoosePlan";
import RatingHistoryScreen from "./pages/RatingHistory";
import RoadTestChecklist from "./pages/RoadTestChecklist";
import WellbeingScreen from "./pages/Wellbeing";
import MedicationsScreen from "./pages/Medications";
import AdminDashboard from "./pages/AdminDashboard";
import Privacy from "./pages/Privacy";
import ReferralsScreen from "./pages/Referrals";
import InviteLanding from "./pages/InviteLanding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <RoadTestProvider>
        <DiagnosticsProvider>
          <SubscriptionProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <DiagnosticsPanel />
              <RoadTestDiagnosticsPanel />
              <BrowserRouter>
                <AuthProvider>
                  <ChatProvider>
                    <ActiveNavigationProvider>
                      <DotHosProvider>
                        <DotSpeedFeeder />
                        <EmotionalCheckInProvider>
                          <MedicationReminderProvider>
                          <PoiFeedbackProvider>
                            <GeofenceProvider>
                              <FacilityGeofenceProvider>
                                {/* Components that need auth context */}
                                <LocationPermissionRequest />
                                <DriverChatSheet />
                                <DocumentReminderProvider />
                                <EnglishQuickReturn variant="floating" />
                                <LanguageSuggestionModal />
                                <FloatingChatButton />
                                <EmotionalCheckInModal />
                                <CheckInTrigger />
                                <Routes>
                                  {/* Public routes */}
                                  <Route path="/" element={<WebsiteScreen />} />
                                  <Route path="/welcome" element={<WelcomeScreen onComplete={() => {}} />} />
                                  <Route path="/auth" element={<AuthScreen onComplete={() => {}} onBack={() => {}} />} />
                                  <Route path="/privacy" element={<Privacy />} />
                                  <Route path="/invite" element={<InviteLanding />} />
                                  
                                  {/* Protected routes - require authentication */}
                                  <Route path="/onboarding" element={<ProtectedRoute><OnboardingScreen onComplete={() => {}} onBack={() => {}} /></ProtectedRoute>} />
                                  <Route path="/home" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
                                  <Route path="/stops" element={<ProtectedRoute><StopsScreen /></ProtectedRoute>} />
                                  <Route path="/report" element={<ProtectedRoute><ReportScreen /></ProtectedRoute>} />
                                  <Route path="/community" element={<ProtectedRoute><CommunityScreen /></ProtectedRoute>} />
                                  <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
                                  <Route path="/place/:id" element={<ProtectedRoute><PlaceDetailScreen /></ProtectedRoute>} />
                                  <Route path="/company-review/:id" element={<ProtectedRoute><CompanyReviewScreen /></ProtectedRoute>} />
                                  <Route path="/chat/:id" element={<ProtectedRoute><ChatRoomScreen /></ProtectedRoute>} />
                                  <Route path="/bypass-history" element={<ProtectedRoute><BypassHistory /></ProtectedRoute>} />
                                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                                  <Route path="/map" element={<Navigate to="/navigation" replace />} />
                                  <Route path="/navigation" element={<ProtectedRoute><NavigationScreen /></ProtectedRoute>} />
                                  <Route path="/stop-advisor" element={<ProtectedRoute><StopAdvisorScreen /></ProtectedRoute>} />
                                  <Route path="/facility-rating" element={<ProtectedRoute><FacilityRatingScreen /></ProtectedRoute>} />
                                  <Route path="/facility/:id" element={<ProtectedRoute><FacilityDetailScreen /></ProtectedRoute>} />
                                  <Route path="/food-preferences" element={<ProtectedRoute><FoodPreferencesScreen /></ProtectedRoute>} />
                                  <Route path="/favorite-meals" element={<ProtectedRoute><FavoriteMealsScreen /></ProtectedRoute>} />
                                  <Route path="/subscription" element={<ProtectedRoute><SubscriptionScreen /></ProtectedRoute>} />
                                  <Route path="/subscription/success" element={<ProtectedRoute><SubscriptionSuccessScreen /></ProtectedRoute>} />
                                  <Route path="/choose-plan" element={<ChoosePlanScreen />} />
                                  <Route path="/rating-history" element={<ProtectedRoute><RatingHistoryScreen /></ProtectedRoute>} />
                                  <Route path="/road-test-checklist" element={<ProtectedRoute><RoadTestChecklist /></ProtectedRoute>} />
                                  <Route path="/wellbeing" element={<ProtectedRoute><WellbeingScreen /></ProtectedRoute>} />
                                  <Route path="/medications" element={<ProtectedRoute><MedicationsScreen /></ProtectedRoute>} />
                                  <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                                  <Route path="/referrals" element={<ProtectedRoute><ReferralsScreen /></ProtectedRoute>} />
                                  
                                  <Route path="*" element={<NotFound />} />
                                </Routes>
                              </FacilityGeofenceProvider>
                            </GeofenceProvider>
                          </PoiFeedbackProvider>
                          </MedicationReminderProvider>
                        </EmotionalCheckInProvider>
                      </DotHosProvider>
                    </ActiveNavigationProvider>
                  </ChatProvider>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
          </SubscriptionProvider>
        </DiagnosticsProvider>
      </RoadTestProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
