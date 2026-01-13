import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { ParkingSquare, Scale, AlertTriangle, CloudRain, Check, MapPin, Loader2, Fuel, Building2, UtensilsCrossed, Edit2, X, ChevronDown } from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyPoi } from '@/hooks/useNearbyPoi';
import { useNearbyRestaurants } from '@/hooks/useNearbyRestaurants';
import { REPORT_TYPE_TTL } from '@/types/collaborative';
import type { Json } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';

// Common restaurant chains for quick selection
const COMMON_RESTAURANTS = [
  "Arby's", "Subway", "McDonald's", "Wendy's", "Taco Bell",
  "Burger King", "Popeyes", "Dunkin'", "Starbucks", "Pizza Hut",
  "Denny's", "IHOP", "Hardee's", "Carl's Jr", "Chester's Chicken",
  "Godfather's Pizza", "Iron Skillet", "Country Pride", "Dairy Queen",
  "Cinnabon", "Auntie Anne's", "Huddle House", "Waffle House"
];

const ReportScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { latitude, longitude, loading: locationLoading } = useGeolocation();
  const { poi, loading: poiLoading } = useNearbyPoi(latitude, longitude);
  const { fetchNearbyRestaurants, result: restaurantResult, loading: restaurantLoading } = useNearbyRestaurants();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Manual restaurant selection
  const [showRestaurantSelector, setShowRestaurantSelector] = useState(false);
  const [manualRestaurant, setManualRestaurant] = useState<string | null>(null);
  const [customRestaurantInput, setCustomRestaurantInput] = useState('');

  // Fetch nearby restaurants when POI is available
  useEffect(() => {
    if (poi && latitude && longitude) {
      fetchNearbyRestaurants(latitude, longitude, poi.name);
    }
  }, [poi, latitude, longitude, fetchNearbyRestaurants]);

  // Get the current restaurant name (manual override or detected)
  const getCurrentRestaurant = () => {
    if (manualRestaurant) return manualRestaurant;
    if (restaurantResult?.restaurants?.[0]) return restaurantResult.restaurants[0].name;
    return null;
  };

  const reportTypes = [
    {
      id: 'parking',
      icon: ParkingSquare,
      label: t.report.parking,
      color: 'bg-blue-500/10 text-blue-400',
      dbType: 'parking',
      options: [
        { id: 'plenty', label: t.place.available, color: 'bg-parking-available', dbValue: 'plenty' },
        { id: 'few_spots', label: t.place.limited, color: 'bg-parking-limited', dbValue: 'few_spots' },
        { id: 'full', label: t.place.full, color: 'bg-parking-full', dbValue: 'full' },
      ],
    },
    {
      id: 'weigh',
      icon: Scale,
      label: t.report.weighStation,
      color: 'bg-purple-500/10 text-purple-400',
      dbType: 'weigh_station',
      options: [
        { id: 'open', label: t.place.weighOpen, color: 'bg-status-open', dbValue: 'open' },
        { id: 'closed', label: t.place.weighClosed, color: 'bg-status-closed', dbValue: 'closed' },
      ],
    },
    {
      id: 'hazard',
      icon: AlertTriangle,
      label: t.report.hazard,
      color: 'bg-red-500/10 text-red-400',
      dbType: 'road_condition',
      options: [
        { id: 'accident', label: 'Accident', color: 'bg-red-500', dbValue: 'accident' },
        { id: 'roadwork', label: 'Road Work', color: 'bg-orange-500', dbValue: 'roadwork' },
        { id: 'debris', label: 'Debris', color: 'bg-yellow-500', dbValue: 'debris' },
        { id: 'police', label: 'Police', color: 'bg-blue-500', dbValue: 'police' },
      ],
    },
    {
      id: 'conditions',
      icon: CloudRain,
      label: t.report.conditions,
      color: 'bg-cyan-500/10 text-cyan-400',
      dbType: 'road_condition',
      options: [
        { id: 'rain', label: 'Rain', color: 'bg-blue-400', dbValue: 'rain' },
        { id: 'snow', label: 'Snow', color: 'bg-gray-300', dbValue: 'ice_snow' },
        { id: 'ice', label: 'Ice', color: 'bg-cyan-300', dbValue: 'ice_snow' },
        { id: 'fog', label: 'Fog', color: 'bg-gray-400', dbValue: 'fog' },
      ],
    },
  ];

  const handleSubmit = async () => {
    if (!selectedReport || !selectedOption) return;

    if (!latitude || !longitude) {
      toast.error('Location required');
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in');
        setSubmitting(false);
        return;
      }

      // Check rate limit
      const { data: canReport, error: checkError } = await supabase.rpc('can_create_report', {
        p_user_id: user.id,
      });

      if (checkError) {
        console.error('Rate limit check error:', checkError);
        throw checkError;
      }

      if (!canReport) {
        toast.error('Rate limit reached. Maximum 10 reports per hour.');
        setSubmitting(false);
        return;
      }

      const currentReportType = reportTypes.find(r => r.id === selectedReport);
      const currentOption = currentReportType?.options.find(o => o.id === selectedOption);

      if (!currentReportType || !currentOption) {
        toast.error('Invalid report type');
        setSubmitting(false);
        return;
      }

      const dbType = currentReportType.dbType;
      const subtype = currentOption.dbValue;

      // Calculate TTL based on report type
      let ttl = REPORT_TYPE_TTL[dbType as keyof typeof REPORT_TYPE_TTL] || 2 * 60 * 60 * 1000;
      if (subtype === 'ice_snow') {
        ttl = REPORT_TYPE_TTL.ice_snow || 4 * 60 * 60 * 1000;
      }

      const expiresAt = new Date(Date.now() + ttl).toISOString();

      // Build details
      let details: Json = {};
      if (dbType === 'parking') {
        details = { parking_status: subtype };
      } else if (dbType === 'weigh_station') {
        details = { status: subtype };
      } else if (dbType === 'road_condition') {
        details = { condition: subtype };
      }

      const { error } = await supabase.from('road_reports').insert({
        user_id: user.id,
        report_type: dbType,
        subtype,
        lat: latitude,
        lng: longitude,
        details,
        expires_at: expiresAt,
      });

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      toast.success(t.report.thanks);
      setSelectedReport(null);
      setSelectedOption(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    }

    setSubmitting(false);
  };

  const currentReportType = reportTypes.find(r => r.id === selectedReport);

  // Get POI icon based on type
  const getPoiIcon = () => {
    if (!poi) return <MapPin className="w-5 h-5 text-primary" />;
    const type = poi.type.toLowerCase();
    if (type.includes('fuel') || type.includes('gas')) {
      return <Fuel className="w-5 h-5 text-primary" />;
    }
    if (type.includes('truck') || type.includes('travel')) {
      return <Building2 className="w-5 h-5 text-primary" />;
    }
    return <MapPin className="w-5 h-5 text-primary" />;
  };

  // Check if still loading location info
  const isLoadingLocation = locationLoading || poiLoading;

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
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {isLoadingLocation ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              getPoiIcon()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{t.report.currentLocation}</p>
            {isLoadingLocation ? (
              <p className="font-medium text-foreground">Getting location...</p>
            ) : !latitude || !longitude ? (
              <p className="font-medium text-foreground">Location unavailable</p>
            ) : poi ? (
              <>
                <p className="font-medium text-foreground truncate">{poi.name}</p>
                {poi.address && (
                  <p className="text-xs text-muted-foreground truncate">{poi.address}</p>
                )}
              </>
            ) : (
              <p className="font-medium text-foreground">{`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}</p>
            )}
          </div>
        </div>

        {/* Restaurant Info */}
        {poi && !restaurantLoading && !showRestaurantSelector && (
          <div className="mt-3 pt-3 border-t border-border">
            {getCurrentRestaurant() ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Restaurant</p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {getCurrentRestaurant()}
                  </p>
                  {!manualRestaurant && restaurantResult && restaurantResult.restaurants.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      +{restaurantResult.restaurants.length - 1} more nearby
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowRestaurantSelector(true)}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  title="Change restaurant"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : restaurantResult?.fallback ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Food Options</p>
                  <p className="text-sm font-medium text-foreground">
                    Convenience Store
                  </p>
                </div>
                <button
                  onClick={() => setShowRestaurantSelector(true)}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  title="Add restaurant"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRestaurantSelector(true)}
                className="flex items-center gap-2 text-sm text-primary"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>Add restaurant at this location</span>
              </button>
            )}
          </div>
        )}

        {/* Restaurant Selector */}
        {poi && showRestaurantSelector && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Select Restaurant</p>
              <button
                onClick={() => {
                  setShowRestaurantSelector(false);
                  setCustomRestaurantInput('');
                }}
                className="p-1 rounded hover:bg-muted/50"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Custom input */}
            <div className="flex gap-2">
              <Input
                placeholder="Type restaurant name..."
                value={customRestaurantInput}
                onChange={(e) => setCustomRestaurantInput(e.target.value.slice(0, 50))}
                className="flex-1 h-9 text-sm"
                maxLength={50}
              />
              <button
                onClick={() => {
                  const trimmed = customRestaurantInput.trim();
                  if (trimmed) {
                    setManualRestaurant(trimmed);
                    setShowRestaurantSelector(false);
                    setCustomRestaurantInput('');
                    toast.success(`Restaurant set to ${trimmed}`);
                  }
                }}
                disabled={!customRestaurantInput.trim()}
                className="px-3 h-9 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
              >
                Set
              </button>
            </div>

            {/* Quick select */}
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {COMMON_RESTAURANTS.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setManualRestaurant(name);
                    setShowRestaurantSelector(false);
                    toast.success(`Restaurant set to ${name}`);
                  }}
                  className="px-2 py-1 text-xs bg-muted/50 hover:bg-muted rounded-full text-foreground transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Clear selection */}
            {manualRestaurant && (
              <button
                onClick={() => {
                  setManualRestaurant(null);
                  setShowRestaurantSelector(false);
                  toast.info('Using auto-detected restaurant');
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear manual selection (use auto-detect)
              </button>
            )}
          </div>
        )}

        {/* Restaurant Loading */}
        {poi && restaurantLoading && !showRestaurantSelector && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              </div>
              <p className="text-xs text-muted-foreground">Finding restaurants...</p>
            </div>
          </div>
        )}
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
            disabled={!selectedOption || submitting || !latitude || !longitude}
            className="w-full mt-6 h-14 bg-primary text-primary-foreground rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              t.report.submit
            )}
          </button>
        </div>
      )}

      <BottomNav activeTab="report" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default ReportScreen;
