import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Settings2, Database, Mail, ChevronRight, Check, Loader2, ExternalLink } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

// Validation schemas
const dataRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  requestType: z.enum(['request_data', 'delete_data']),
  message: z.string().trim().max(1000).optional(),
});

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  message: z.string().trim().min(1, 'Message is required').max(1000),
});

interface DataPreferences {
  allowLocationData: boolean;
  allowAnalytics: boolean;
  allowNotifications: boolean;
  allowCommunityData: boolean;
}

const Privacy = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Sheet states
  const [showPolicy, setShowPolicy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showDataRequest, setShowDataRequest] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  
  // Data preferences
  const [preferences, setPreferences] = useState<DataPreferences>({
    allowLocationData: true,
    allowAnalytics: true,
    allowNotifications: true,
    allowCommunityData: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);
  
  // Data request form
  const [dataRequestForm, setDataRequestForm] = useState({
    name: '',
    email: '',
    requestType: 'request_data' as 'request_data' | 'delete_data',
    message: '',
  });
  const [sendingDataRequest, setSendingDataRequest] = useState(false);
  
  // Contact form
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [sendingContact, setSendingContact] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem('privacy_preferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading preferences:', e);
      }
    }
    
    // Pre-fill email from user profile
    loadUserEmail();
  }, []);

  const loadUserEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setDataRequestForm(prev => ({ ...prev, email: user.email || '' }));
        setContactForm(prev => ({ ...prev, email: user.email || '' }));
      }
    } catch (e) {
      console.error('Error loading user email:', e);
    }
  };

  const savePreferences = async (newPrefs: DataPreferences) => {
    setSavingPreferences(true);
    try {
      localStorage.setItem('privacy_preferences', JSON.stringify(newPrefs));
      setPreferences(newPrefs);
      toast.success(t.privacy.preferencesSaved);
    } catch (e) {
      toast.error(t.common.error);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleDataRequest = async () => {
    try {
      const validated = dataRequestSchema.parse(dataRequestForm);
      setSendingDataRequest(true);
      
      const subject = validated.requestType === 'request_data' 
        ? 'Data Access Request - TruckerEasy'
        : 'Data Deletion Request - TruckerEasy';
      
      const body = `
Name: ${validated.name}
Email: ${validated.email}
Request Type: ${validated.requestType === 'request_data' ? 'Request My Data' : 'Delete My Data'}
${validated.message ? `\nMessage:\n${validated.message}` : ''}
      `.trim();
      
      window.location.href = `mailto:info@truckereasy.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      toast.success(t.privacy.requestSent);
      setShowDataRequest(false);
      setDataRequestForm({ name: '', email: '', requestType: 'request_data', message: '' });
      loadUserEmail();
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0]?.message || t.common.error);
      } else {
        toast.error(t.common.error);
      }
    } finally {
      setSendingDataRequest(false);
    }
  };

  const handleContactSubmit = async () => {
    try {
      const validated = contactSchema.parse(contactForm);
      setSendingContact(true);
      
      const subject = 'Privacy Concern - TruckerEasy';
      const body = `
Name: ${validated.name}
Email: ${validated.email}

Message:
${validated.message}
      `.trim();
      
      window.location.href = `mailto:info@truckereasy.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      toast.success(t.privacy.messageSent);
      setShowContactForm(false);
      setContactForm({ name: '', email: '', message: '' });
      loadUserEmail();
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0]?.message || t.common.error);
      } else {
        toast.error(t.common.error);
      }
    } finally {
      setSendingContact(false);
    }
  };

  const menuItems = [
    {
      id: 'policy',
      icon: FileText,
      label: t.privacy.privacyPolicy,
      description: t.privacy.policyDesc,
      onClick: () => setShowPolicy(true),
    },
    {
      id: 'preferences',
      icon: Settings2,
      label: t.privacy.dataPreferences,
      description: t.privacy.preferencesDesc,
      onClick: () => setShowPreferences(true),
    },
    {
      id: 'data-request',
      icon: Database,
      label: t.privacy.requestData,
      description: t.privacy.requestDataDesc,
      onClick: () => setShowDataRequest(true),
    },
    {
      id: 'contact',
      icon: Mail,
      label: t.privacy.contactPrivacy,
      description: t.privacy.contactPrivacyDesc,
      onClick: () => setShowContactForm(true),
    },
  ];

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
          <h1 className="text-xl font-bold">{t.settings.privacy}</h1>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Privacy Policy Sheet */}
      <Sheet open={showPolicy} onOpenChange={setShowPolicy}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>{t.privacy.privacyPolicy}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(90vh-80px)] p-4">
            <div className="space-y-6 pb-8">
              <p className="text-sm text-muted-foreground">
                {t.privacy.lastUpdated}: January 24, 2026
              </p>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.infoCollect}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.infoCollect}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.howWeUse}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.howWeUse}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.locationData}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.locationData}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.dataSharing}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.dataSharing}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.dataRetention}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.dataRetention}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.userRights}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.userRights}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.security}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.security}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.changes}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.changes}
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">{t.privacy.sections.contact}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.privacy.content.contact}
                </p>
                <a 
                  href="mailto:info@truckereasy.com"
                  className="text-primary text-sm flex items-center gap-1 mt-2"
                >
                  info@truckereasy.com <ExternalLink className="w-3 h-3" />
                </a>
              </section>

              <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-sm text-center font-medium">
                  {t.privacy.agreement}
                </p>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Data Preferences Sheet */}
      <Sheet open={showPreferences} onOpenChange={setShowPreferences}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>{t.privacy.dataPreferences}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pb-4">
              <div className="p-4 bg-card rounded-xl border border-border flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{t.privacy.prefs.location}</p>
                  <p className="text-sm text-muted-foreground">{t.privacy.prefs.locationDesc}</p>
                </div>
                <Switch 
                  checked={preferences.allowLocationData}
                  disabled
                />
              </div>

              <div className="p-4 bg-card rounded-xl border border-border flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{t.privacy.prefs.analytics}</p>
                  <p className="text-sm text-muted-foreground">{t.privacy.prefs.analyticsDesc}</p>
                </div>
                <Switch 
                  checked={preferences.allowAnalytics}
                  onCheckedChange={(checked) => savePreferences({ ...preferences, allowAnalytics: checked })}
                />
              </div>

              <div className="p-4 bg-card rounded-xl border border-border flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{t.privacy.prefs.notifications}</p>
                  <p className="text-sm text-muted-foreground">{t.privacy.prefs.notificationsDesc}</p>
                </div>
                <Switch 
                  checked={preferences.allowNotifications}
                  onCheckedChange={(checked) => savePreferences({ ...preferences, allowNotifications: checked })}
                />
              </div>

              <div className="p-4 bg-card rounded-xl border border-border flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{t.privacy.prefs.community}</p>
                  <p className="text-sm text-muted-foreground">{t.privacy.prefs.communityDesc}</p>
                </div>
                <Switch 
                  checked={preferences.allowCommunityData}
                  onCheckedChange={(checked) => savePreferences({ ...preferences, allowCommunityData: checked })}
                />
              </div>

              {savingPreferences && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t.common.loading}</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Data Request Sheet */}
      <Sheet open={showDataRequest} onOpenChange={setShowDataRequest}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>{t.privacy.requestData}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pb-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.name} *</label>
                <Input
                  value={dataRequestForm.name}
                  onChange={(e) => setDataRequestForm({ ...dataRequestForm, name: e.target.value })}
                  placeholder={t.privacy.form.namePlaceholder}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.email} *</label>
                <Input
                  type="email"
                  value={dataRequestForm.email}
                  onChange={(e) => setDataRequestForm({ ...dataRequestForm, email: e.target.value })}
                  placeholder={t.privacy.form.emailPlaceholder}
                  maxLength={255}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.requestType} *</label>
                <Select 
                  value={dataRequestForm.requestType}
                  onValueChange={(value: 'request_data' | 'delete_data') => setDataRequestForm({ ...dataRequestForm, requestType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="request_data">{t.privacy.form.requestMyData}</SelectItem>
                    <SelectItem value="delete_data">{t.privacy.form.deleteMyData}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.message}</label>
                <Textarea
                  value={dataRequestForm.message}
                  onChange={(e) => setDataRequestForm({ ...dataRequestForm, message: e.target.value })}
                  placeholder={t.privacy.form.messagePlaceholder}
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <Button 
                onClick={handleDataRequest}
                disabled={sendingDataRequest}
                className="w-full"
              >
                {sendingDataRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t.privacy.form.sendRequest}
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Contact Privacy Team Sheet */}
      <Sheet open={showContactForm} onOpenChange={setShowContactForm}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>{t.privacy.contactPrivacy}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pb-4">
              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.name} *</label>
                <Input
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder={t.privacy.form.namePlaceholder}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.email} *</label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder={t.privacy.form.emailPlaceholder}
                  maxLength={255}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t.privacy.form.message} *</label>
                <Textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder={t.privacy.form.privacyConcernPlaceholder}
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <Button 
                onClick={handleContactSubmit}
                disabled={sendingContact}
                className="w-full"
              >
                {sendingContact ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t.privacy.form.sendMessage}
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default Privacy;
