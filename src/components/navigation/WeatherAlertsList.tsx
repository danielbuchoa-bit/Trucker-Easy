import { AlertTriangle, CloudRain, Wind, Snowflake, Sun, CloudLightning, Info } from 'lucide-react';
import { WeatherAlert } from '@/services/HereService';
import { useLanguage } from '@/i18n/LanguageContext';

interface WeatherAlertsListProps {
  alerts: WeatherAlert[];
  available: boolean;
  message?: string;
  loading?: boolean;
}

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'extreme':
    case 'severe':
      return 'bg-red-500/20 border-red-500 text-red-400';
    case 'moderate':
      return 'bg-orange-500/20 border-orange-500 text-orange-400';
    case 'minor':
      return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
    default:
      return 'bg-blue-500/20 border-blue-500 text-blue-400';
  }
};

const getWeatherIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('rain') || t.includes('flood')) return CloudRain;
  if (t.includes('wind') || t.includes('storm')) return Wind;
  if (t.includes('snow') || t.includes('ice') || t.includes('freeze')) return Snowflake;
  if (t.includes('heat') || t.includes('fire')) return Sun;
  if (t.includes('thunder') || t.includes('lightning')) return CloudLightning;
  return AlertTriangle;
};

const WeatherAlertsList = ({ alerts, available, message, loading }: WeatherAlertsListProps) => {
  const { t, language } = useLanguage();
  

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Info className="w-5 h-5" />
          <span className="text-sm">{message || t.navigation?.weatherUnavailable || 'Weather alerts unavailable'}</span>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex items-center gap-3 text-green-400">
          <Sun className="w-5 h-5" />
          <span className="text-sm">{t.navigation?.noAlerts || 'No weather alerts along your route'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => {
        const Icon = getWeatherIcon(alert.type);
        const colorClass = getSeverityColor(alert.severity);
        
        return (
          <div
            key={index}
            className={`border rounded-xl p-4 ${colorClass}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-current/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {alert.severity}
                  </span>
                  <span className="text-xs opacity-60">• {alert.type}</span>
                </div>
                <h4 className="font-semibold text-foreground text-sm mb-1">
                  {alert.headline}
                </h4>
                {alert.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {alert.description}
                  </p>
                )}
                {(alert.validFrom || alert.validTo) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {alert.validFrom && `From: ${new Date(alert.validFrom).toLocaleString()}`}
                    {alert.validFrom && alert.validTo && ' - '}
                    {alert.validTo && `To: ${new Date(alert.validTo).toLocaleString()}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WeatherAlertsList;
