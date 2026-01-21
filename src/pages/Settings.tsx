import { useLanguage } from '@/i18n/LanguageContext';
import { useBypassSettings } from '@/hooks/useBypassSettings';
import { useRoadTestSafe } from '@/contexts/RoadTestContext';
import { ArrowLeft, Scale, Shield, Bell, Globe, Moon, FlaskConical, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/navigation/BottomNav';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const Settings = () => {
  const { t, language, setLanguage } = useLanguage();
  const { settings, updateSettings } = useBypassSettings();
  const roadTest = useRoadTestSafe();
  const navigate = useNavigate();

  const handleLanguageChange = () => {
    const languages: ('en' | 'es' | 'pt')[] = ['en', 'es', 'pt'];
    const currentIndex = languages.indexOf(language);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background pt-safe">
        <div className="p-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{t.settings.title}</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Weigh Station Settings */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {t.bypass.weighStation}
          </h2>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t.bypass.enableReminder}</p>
                  <p className="text-sm text-muted-foreground">{t.bypass.enableReminderDesc}</p>
                </div>
              </div>
              <Switch
                checked={settings.enableReminder}
                onCheckedChange={(checked) => updateSettings({ enableReminder: checked })}
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t.bypass.saveHistory}</p>
                  <p className="text-sm text-muted-foreground">{t.bypass.saveHistoryDesc}</p>
                </div>
              </div>
              <Switch
                checked={settings.saveHistory}
                onCheckedChange={(checked) => updateSettings({ saveHistory: checked })}
              />
            </div>
          </div>
        </div>

        {/* Road Test Mode */}
        {roadTest && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              🧪 Road Test
            </h2>
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium">Road Test Mode</p>
                    <p className="text-sm text-muted-foreground">Ativa diagnósticos e dados reais</p>
                  </div>
                </div>
                <Switch
                  checked={roadTest.isRoadTestMode}
                  onCheckedChange={(checked) => roadTest.setRoadTestMode(checked)}
                />
              </div>
              
              {roadTest.isRoadTestMode && (
                <div className="p-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/road-test-checklist')}
                  >
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    Abrir Checklist de Teste
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* General Settings */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {t.settings.title}
          </h2>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            <button
              onClick={handleLanguageChange}
              className="w-full p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="font-medium">{t.settings.language}</span>
              </div>
              <span className="text-muted-foreground uppercase">{language}</span>
            </button>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <span className="font-medium">{t.settings.notifications}</span>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Moon className="w-5 h-5" />
                </div>
                <span className="font-medium">{t.settings.darkMode}</span>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>
      </div>

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default Settings;
