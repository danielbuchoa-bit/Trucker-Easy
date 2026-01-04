import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { ParkingSquare, Scale, AlertTriangle, CloudRain, Check, MapPin } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ReportScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const reportTypes = [
    {
      id: 'parking',
      icon: ParkingSquare,
      label: t.report.parking,
      color: 'bg-blue-500/10 text-blue-400',
      options: [
        { id: 'available', label: t.place.available, color: 'bg-parking-available' },
        { id: 'limited', label: t.place.limited, color: 'bg-parking-limited' },
        { id: 'full', label: t.place.full, color: 'bg-parking-full' },
      ],
    },
    {
      id: 'weigh',
      icon: Scale,
      label: t.report.weighStation,
      color: 'bg-purple-500/10 text-purple-400',
      options: [
        { id: 'open', label: t.place.weighOpen, color: 'bg-status-open' },
        { id: 'closed', label: t.place.weighClosed, color: 'bg-status-closed' },
      ],
    },
    {
      id: 'hazard',
      icon: AlertTriangle,
      label: t.report.hazard,
      color: 'bg-red-500/10 text-red-400',
      options: [
        { id: 'accident', label: 'Accident', color: 'bg-red-500' },
        { id: 'roadwork', label: 'Road Work', color: 'bg-orange-500' },
        { id: 'debris', label: 'Debris', color: 'bg-yellow-500' },
        { id: 'police', label: 'Police', color: 'bg-blue-500' },
      ],
    },
    {
      id: 'conditions',
      icon: CloudRain,
      label: t.report.conditions,
      color: 'bg-cyan-500/10 text-cyan-400',
      options: [
        { id: 'rain', label: 'Rain', color: 'bg-blue-400' },
        { id: 'snow', label: 'Snow', color: 'bg-gray-300' },
        { id: 'ice', label: 'Ice', color: 'bg-cyan-300' },
        { id: 'fog', label: 'Fog', color: 'bg-gray-400' },
      ],
    },
  ];

  const handleSubmit = () => {
    if (selectedReport && selectedOption) {
      toast.success(t.report.thanks);
      setSelectedReport(null);
      setSelectedOption(null);
    }
  };

  const currentReportType = reportTypes.find(r => r.id === selectedReport);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-foreground">{t.nav.report}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.report.helpOthers}</p>
        </div>
      </div>

      {/* Current Location */}
      <div className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t.report.currentLocation}</p>
            <p className="font-medium text-foreground">I-40 E, Mile Marker 142</p>
          </div>
        </div>
      </div>

      {/* Report Types */}
      {!selectedReport ? (
        <div className="p-4 grid grid-cols-2 gap-3">
          {reportTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedReport(type.id)}
                className="flex flex-col items-center justify-center gap-3 p-6 bg-card rounded-xl border border-border hover:border-primary/50 transition-all"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${type.color}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <span className="font-medium text-foreground text-center">{type.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-4">
          {/* Back button */}
          <button
            onClick={() => {
              setSelectedReport(null);
              setSelectedOption(null);
            }}
            className="text-primary mb-4"
          >
            ← {t.common.back}
          </button>

          <h2 className="text-lg font-semibold text-foreground mb-4">{currentReportType?.label}</h2>

          {/* Options */}
          <div className="space-y-3">
            {currentReportType?.options.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  selectedOption === option.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${option.color}`} />
                <span className="font-medium text-foreground">{option.label}</span>
                {selectedOption === option.id && (
                  <Check className="w-5 h-5 text-primary ml-auto" />
                )}
              </button>
            ))}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedOption}
            className="w-full mt-6 h-14 bg-primary text-primary-foreground rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-primary/90"
          >
            {t.report.submit}
          </button>
        </div>
      )}

      <BottomNav activeTab="report" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default ReportScreen;
