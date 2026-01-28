import { forwardRef } from 'react';
import { Truck, MapPin, AlertTriangle, Users, User } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomNav = forwardRef<HTMLElement, BottomNavProps>(({ activeTab, onTabChange }, ref) => {
  const { t } = useLanguage();

  const tabs = [
    { id: 'map', icon: MapPin, label: t.nav.map },
    { id: 'stops', icon: Truck, label: t.nav.stops },
    { id: 'report', icon: AlertTriangle, label: t.nav.report, highlight: true },
    { id: 'community', icon: Users, label: t.nav.community },
    { id: 'profile', icon: User, label: t.nav.profile },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isHighlight = tab.highlight;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300',
                'active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive && !isHighlight && 'text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]',
                !isActive && !isHighlight && 'text-muted-foreground hover:text-primary/70',
                isHighlight && 'relative'
              )}
            >
              {isHighlight ? (
                <div
                  className={cn(
                    'flex items-center justify-center w-14 h-14 -mt-6 rounded-full transition-all duration-300',
                    'bg-primary text-primary-foreground shadow-lg',
                    isActive && 'shadow-[0_0_20px_hsl(var(--primary)/0.6),0_0_40px_hsl(var(--primary)/0.3)] animate-pulse-glow'
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
              ) : (
                <Icon className={cn('w-6 h-6 transition-transform duration-300', isActive && 'scale-110')} />
              )}
              <span className={cn(
                'text-xs font-medium transition-all duration-300',
                isHighlight && 'mt-1',
                isActive && !isHighlight && 'text-primary'
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
