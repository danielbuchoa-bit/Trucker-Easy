import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { User, Settings, Globe, Moon, Bell, Shield, HelpCircle, LogOut, ChevronRight, Star, MessageSquare, Flag, Scale, Utensils, Building2, Heart, FileCheck, MapPin, Stethoscope } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import FindDMVModal from '@/components/compliance/FindDMVModal';
import MedicalCardModal from '@/components/compliance/MedicalCardModal';

const ProfileScreen = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [showDMVModal, setShowDMVModal] = useState(false);
  const [showMedicalModal, setShowMedicalModal] = useState(false);

  const stats = [
    { label: t.profile.reports, value: 47, icon: Flag },
    { label: t.profile.reviews, value: 23, icon: Star },
    { label: t.profile.messages, value: 156, icon: MessageSquare },
  ];

  const menuItems = [
    { id: 'bypass', icon: Scale, label: t.bypass.history, route: '/bypass-history' },
    { id: 'stop-advisor', icon: Utensils, label: 'Stop Advisor', route: '/stop-advisor' },
    { id: 'facility-rating', icon: Building2, label: 'Facility Rating', route: '/facility-rating' },
    { id: 'food-prefs', icon: Utensils, label: 'Food Preferences', route: '/food-preferences' },
    { id: 'favorite-meals', icon: Heart, label: 'Favorite Meals', route: '/favorite-meals' },
  ];

  const complianceItems = [
    { id: 'find-dmv', icon: MapPin, label: 'Find DMV', action: 'dmv' },
    { id: 'medical-card', icon: Stethoscope, label: 'Drug Test & Medical Card', action: 'medical' },
  ];

  const settingsItems = [
    { id: 'settings', icon: Settings, label: t.settings.title, route: '/settings' },
    { id: 'language', icon: Globe, label: t.settings.language, action: 'language' },
    { id: 'notifications', icon: Bell, label: t.settings.notifications },
    { id: 'darkMode', icon: Moon, label: t.settings.darkMode },
    { id: 'privacy', icon: Shield, label: t.settings.privacy },
    { id: 'help', icon: HelpCircle, label: t.settings.help },
  ];

  const handleLanguageChange = () => {
    const languages: ('en' | 'es' | 'pt')[] = ['en', 'es', 'pt'];
    const currentIndex = languages.indexOf(language);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
  };

  const handleItemClick = (item: any) => {
    if (item.action === 'language') {
      handleLanguageChange();
    } else if (item.action === 'dmv') {
      setShowDMVModal(true);
    } else if (item.action === 'medical') {
      setShowMedicalModal(true);
    } else if (item.route) {
      navigate(item.route);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background pt-safe">
        <div className="p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-primary/20 border-4 border-primary mx-auto flex items-center justify-center">
            <User className="w-12 h-12 text-primary" />
          </div>
          
          <h1 className="text-xl font-bold text-foreground mt-4">John Driver</h1>
          <p className="text-muted-foreground text-sm">Owner Operator • Since 2020</p>
          
          <div className="flex justify-center gap-6 mt-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="flex items-center justify-center gap-1 text-primary">
                    <Icon className="w-4 h-4" />
                    <span className="text-xl font-bold">{stat.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="p-4 space-y-4">
        {/* Main Tools */}
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <span className="flex-1 font-medium text-foreground">{item.label}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        {/* Compliance & Documents Section */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Compliance & Documents
          </h3>
          <div className="space-y-2">
            {complianceItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-info" />
                  </div>
                  <span className="flex-1 font-medium text-foreground">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <span className="flex-1 font-medium text-foreground">{item.label}</span>
                {item.id === 'language' && (
                  <span className="text-sm text-muted-foreground uppercase">{language}</span>
                )}
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <button className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-red-500/30 hover:border-red-500/50 transition-all text-left">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <span className="flex-1 font-medium text-red-400">{t.auth.logout}</span>
        </button>
      </div>

      {/* Modals */}
      <FindDMVModal isOpen={showDMVModal} onClose={() => setShowDMVModal(false)} />
      <MedicalCardModal isOpen={showMedicalModal} onClose={() => setShowMedicalModal(false)} />

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default ProfileScreen;
