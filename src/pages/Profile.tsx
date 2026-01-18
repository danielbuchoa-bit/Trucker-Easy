import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { User, Settings, Globe, Moon, Bell, Shield, HelpCircle, LogOut, ChevronRight, Star, MessageSquare, Flag, Scale, Utensils, Building2, Heart, FileCheck, MapPin, Stethoscope, Loader2, FileText, History } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import FindDMVModal from '@/components/compliance/FindDMVModal';
import MedicalCardModal from '@/components/compliance/MedicalCardModal';
import DriverDocumentsModal from '@/components/profile/DriverDocumentsModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface UserStats {
  reports: number;
  reviews: number;
  messages: number;
}

const ProfileScreen = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [showDMVModal, setShowDMVModal] = useState(false);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({ reports: 0, reviews: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const [documentAlerts, setDocumentAlerts] = useState<number>(0);
  useEffect(() => {
    fetchUserData();
    checkDocumentAlerts();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile({
          id: user.id,
          full_name: profileData.full_name,
          email: profileData.email || user.email,
          created_at: profileData.created_at,
        });
      } else {
        setProfile({
          id: user.id,
          full_name: null,
          email: user.email || null,
          created_at: user.created_at,
        });
      }

      // Fetch stats in parallel
      const [reportsResult, reviewsResult, messagesResult] = await Promise.all([
        supabase.from('road_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('facility_ratings').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        reports: reportsResult.count || 0,
        reviews: reviewsResult.count || 0,
        messages: messagesResult.count || 0,
      });

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDocumentAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('driver_documents')
        .select('expiration_date')
        .eq('user_id', user.id);

      if (data) {
        const today = new Date();
        let alerts = 0;
        data.forEach((doc: any) => {
          if (doc.expiration_date) {
            const expDate = new Date(doc.expiration_date);
            const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 10) alerts++;
          }
        });
        setDocumentAlerts(alerts);
      }
    } catch (error) {
      console.error('Error checking document alerts:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.email) return profile.email.split('@')[0];
    return 'Driver';
  };

  const getMemberSince = () => {
    if (!profile?.created_at) return '';
    const year = new Date(profile.created_at).getFullYear();
    return `Since ${year}`;
  };

  const statsDisplay = [
    { label: t.profile.reports, value: stats.reports, icon: Flag },
    { label: t.profile.reviews, value: stats.reviews, icon: Star },
    { label: t.profile.messages, value: stats.messages, icon: MessageSquare },
  ];

  const menuItems = [
    { id: 'bypass', icon: Scale, label: t.bypass.history, route: '/bypass-history' },
    { id: 'rating-history', icon: History, label: 'Minhas Avaliações', route: '/rating-history' },
    { id: 'stop-advisor', icon: Utensils, label: 'Stop Advisor', route: '/stop-advisor' },
    { id: 'facility-rating', icon: Building2, label: 'Facility Rating', route: '/facility-rating' },
    { id: 'food-prefs', icon: Utensils, label: 'Food Preferences', route: '/food-preferences' },
    { id: 'favorite-meals', icon: Heart, label: 'Favorite Meals', route: '/favorite-meals' },
  ];

  const complianceItems = [
    { id: 'my-documents', icon: FileText, label: 'My Documents (CDL & Medical)', action: 'documents', hasAlert: documentAlerts > 0 },
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
    } else if (item.action === 'documents') {
      setShowDocumentsModal(true);
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
          
          {loading ? (
            <div className="mt-4 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <>
              <h1 className="text-xl font-bold text-foreground mt-4">{getDisplayName()}</h1>
              <p className="text-muted-foreground text-sm">{getMemberSince()}</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground mt-4">Guest</h1>
              <button 
                onClick={() => navigate('/auth')}
                className="text-primary text-sm mt-1"
              >
                Sign in to view your profile
              </button>
            </>
          )}
          
          <div className="flex justify-center gap-6 mt-6">
            {statsDisplay.map((stat) => {
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
                  className={`w-full flex items-center gap-4 p-4 bg-card rounded-xl border transition-all text-left ${
                    item.hasAlert ? 'border-warning/50 bg-warning/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center relative ${
                    item.hasAlert ? 'bg-warning/20' : 'bg-info/20'
                  }`}>
                    <Icon className={`w-5 h-5 ${item.hasAlert ? 'text-warning' : 'text-info'}`} />
                    {item.hasAlert && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className="flex-1 font-medium text-foreground">{item.label}</span>
                  {item.hasAlert && (
                    <span className="text-xs text-warning font-medium">Expiring soon!</span>
                  )}
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
        {profile && (
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-red-500/30 hover:border-red-500/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
            <span className="flex-1 font-medium text-red-400">{t.auth.logout}</span>
          </button>
        )}
      </div>

      {/* Modals */}
      <FindDMVModal isOpen={showDMVModal} onClose={() => setShowDMVModal(false)} />
      <MedicalCardModal isOpen={showMedicalModal} onClose={() => setShowMedicalModal(false)} />
      <DriverDocumentsModal isOpen={showDocumentsModal} onClose={() => { setShowDocumentsModal(false); checkDocumentAlerts(); }} />

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default ProfileScreen;
