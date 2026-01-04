import { useState } from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type AppScreen = 'welcome' | 'auth' | 'onboarding' | 'home';

const AppContent = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('welcome');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen onComplete={() => setCurrentScreen('auth')} />;
      case 'auth':
        return (
          <AuthScreen 
            onComplete={() => setCurrentScreen('onboarding')} 
            onBack={() => setCurrentScreen('welcome')}
          />
        );
      case 'onboarding':
        return (
          <OnboardingScreen 
            onComplete={() => setCurrentScreen('home')} 
            onBack={() => setCurrentScreen('auth')}
          />
        );
      case 'home':
        return <HomeScreen />;
      default:
        return <WelcomeScreen onComplete={() => setCurrentScreen('auth')} />;
    }
  };

  return renderScreen();
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppContent />} />
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/stops" element={<StopsScreen />} />
            <Route path="/report" element={<ReportScreen />} />
            <Route path="/community" element={<CommunityScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/place/:id" element={<PlaceDetailScreen />} />
            <Route path="/company-review/:id" element={<CompanyReviewScreen />} />
            <Route path="/chat/:id" element={<ChatRoomScreen />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
