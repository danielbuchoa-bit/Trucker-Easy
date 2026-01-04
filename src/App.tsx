import { LanguageProvider } from './i18n/LanguageContext';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GeofenceProvider } from './contexts/GeofenceContext';
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <GeofenceProvider>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </GeofenceProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

