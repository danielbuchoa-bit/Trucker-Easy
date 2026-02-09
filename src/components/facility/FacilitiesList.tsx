import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Star, Clock, Search, Loader2, Plus, MapPin, Navigation, MessageSquare, Sparkles, Calendar, Fuel } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import type { Facility, FacilityAggregate } from '@/types/collaborative';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { detectLocationType } from '@/components/facility/UnifiedRatingPrompt';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Helper to check if facility was created in the last 7 days
const isNewFacility = (createdAt: string): boolean => {
  const createdDate = new Date(createdAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return createdDate > sevenDaysAgo;
};

interface GeocodedResult {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
}

interface LatestTip {
  facility_id: string;
  tips: string;
  created_at: string;
}

const FacilitiesList: React.FC = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [aggregates, setAggregates] = useState<Record<string, FacilityAggregate>>({});
  const [latestTips, setLatestTips] = useState<Record<string, LatestTip>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [geocodedResults, setGeocodedResults] = useState<GeocodedResult[]>([]);
  const [showGeoResults, setShowGeoResults] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [categoryTab, setCategoryTab] = useState<'all' | 'truck_stops' | 'facilities'>('all');

  // Manual entry modal state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualType, setManualType] = useState<'shipper' | 'receiver' | 'both'>('both');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facilitiesRes, aggregatesRes, poiAggRes, tipsRes] = await Promise.all([
          supabase.from('facilities').select('*').limit(100),
          supabase.from('facility_aggregates').select('*'),
          supabase.from('poi_ratings_aggregate').select('*'),
          supabase.from('facility_reviews')
            .select('facility_id, tips, created_at')
            .not('tips', 'is', null)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        if (facilitiesRes.data) {
          setFacilities(facilitiesRes.data as unknown as Facility[]);
        }
        
        const map: Record<string, FacilityAggregate> = {};
        if (aggregatesRes.data) {
          aggregatesRes.data.forEach((agg: unknown) => {
            const a = agg as FacilityAggregate;
            map[a.facility_id] = a;
          });
        }
        
        // Merge poi_ratings_aggregate as fallback for facilities without facility_aggregates
        if (poiAggRes.data) {
          poiAggRes.data.forEach((poi: any) => {
            if (poi.poi_id && !map[poi.poi_id] && (poi.review_count || 0) > 0) {
              map[poi.poi_id] = {
                facility_id: poi.poi_id,
                review_count: poi.review_count || 0,
                avg_overall: poi.avg_overall || 0,
                avg_parking: null,
                avg_speed: null,
                avg_staff_help: null,
                avg_treatment: null,
                avg_exit_ease: null,
                typical_time: null,
                updated_at: new Date().toISOString(),
              } as FacilityAggregate;
            }
          });
        }
        setAggregates(map);

        if (tipsRes.data) {
          const tipsMap: Record<string, LatestTip> = {};
          // Only keep the latest tip per facility
          tipsRes.data.forEach((tip) => {
            if (!tipsMap[tip.facility_id]) {
              tipsMap[tip.facility_id] = tip as LatestTip;
            }
          });
          setLatestTips(tipsMap);
        }
      } catch (error) {
        console.error('Error fetching facilities:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim().length < 3) return;

    setSearching(true);
    setSearchPerformed(true);
    setGeocodedResults([]);

    try {
      // First check if we have matching facilities in DB
      const { data: dbFacilities } = await supabase
        .from('facilities')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`)
        .limit(10);

      if (dbFacilities && dbFacilities.length > 0) {
        setFacilities(dbFacilities as unknown as Facility[]);
        setShowGeoResults(false);
      } else {
        // No DB results, try geocoding
        const { data, error } = await supabase.functions.invoke('nb_geocode', {
          body: { query: searchQuery, limit: 5 },
        });

        if (error) {
          console.error('Geocode error:', error);
          toast.error('Error searching for location');
        } else if (data?.results && data.results.length > 0) {
          setGeocodedResults(data.results);
          setShowGeoResults(true);
        } else {
          setGeocodedResults([]);
          setShowGeoResults(true);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Error during search');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSelectGeoResult = async (result: GeocodedResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to add facilities');
        return;
      }

      // Create facility from geocoded result
      const { data, error } = await supabase.from('facilities').insert({
        name: result.title,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
        facility_type: 'both',
        created_by: user.id,
      }).select().single();

      if (error) {
        console.error('Error creating facility:', error);
        toast.error('Error creating facility');
        return;
      }

      toast.success('Facility added!');
      setShowGeoResults(false);
      setGeocodedResults([]);
      
      // Navigate to facility detail to rate it
      if (data) {
        navigate(`/facility/${data.id}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error adding facility');
    }
  };

  const handleNavigateToResult = (result: GeocodedResult) => {
    navigate('/navigation', {
      state: {
        destinationLat: result.lat,
        destinationLng: result.lng,
        destinationName: result.title,
        autoStart: true,
      },
    });
  };

  const handleManualEntry = () => {
    setManualName(searchQuery);
    setManualAddress('');
    setManualType('both');
    setShowManualEntry(true);
  };

  const handleSaveManual = async () => {
    if (!manualName.trim()) {
      toast.error('Please enter a facility name');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to add facilities');
        return;
      }

      // Use current location or default coords
      const lat = latitude || 0;
      const lng = longitude || 0;

      const { data, error } = await supabase.from('facilities').insert({
        name: manualName.trim(),
        address: manualAddress.trim() || null,
        lat,
        lng,
        facility_type: manualType,
        created_by: user.id,
      }).select().single();

      if (error) {
        console.error('Error creating facility:', error);
        toast.error('Error creating facility');
        return;
      }

      toast.success('Facility added!');
      setShowManualEntry(false);
      
      // Navigate to facility detail to rate it
      if (data) {
        navigate(`/facility/${data.id}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error adding facility');
    } finally {
      setSaving(false);
    }
  };

  const getDistance = (facility: Facility): number | null => {
    if (!latitude || !longitude) return null;
    return calculateDistance(latitude, longitude, facility.lat, facility.lng);
  };

  const formatDistance = (meters: number | null): string => {
    if (meters === null) return '';
    if (meters < 1000) return `${Math.round(meters)}m`;
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'shipper': return 'bg-blue-500/10 text-blue-400';
      case 'receiver': return 'bg-green-500/10 text-green-400';
      default: return 'bg-purple-500/10 text-purple-400';
    }
  };

  // Count new facilities for badge
  const newFacilitiesCount = facilities.filter(f => isNewFacility(f.created_at)).length;

  const filteredFacilities = facilities
    .filter(f => {
      // Filter by category tab
      if (categoryTab !== 'all') {
        const locType = detectLocationType(f.name, f.address || undefined);
        const isTruckStop = locType === 'truck_stop' || locType === 'fuel';
        if (categoryTab === 'truck_stops' && !isTruckStop) return false;
        if (categoryTab === 'facilities' && isTruckStop) return false;
      }

      // Filter by new only if toggle is on
      if (showNewOnly && !isNewFacility(f.created_at)) return false;
      
      // Filter by search query
      if (searchQuery && 
          !f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(f.address && f.address.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const distA = getDistance(a);
      const distB = getDistance(b);
      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;
      return distA - distB;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Sub-tabs */}
      <Tabs value={categoryTab} onValueChange={(v) => setCategoryTab(v as 'all' | 'truck_stops' | 'facilities')}>
        <TabsList className="grid grid-cols-3 h-auto">
          <TabsTrigger value="all" className="text-xs py-2">
            All
          </TabsTrigger>
          <TabsTrigger value="truck_stops" className="flex items-center gap-1 text-xs py-2">
            <Fuel className="w-3.5 h-3.5" />
            Truck Stops
          </TabsTrigger>
          <TabsTrigger value="facilities" className="flex items-center gap-1 text-xs py-2">
            <Building2 className="w-3.5 h-3.5" />
            Facilities
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={categoryTab === 'truck_stops' ? "Search truck stops..." : categoryTab === 'facilities' ? "Search facilities..." : "Search facilities..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchPerformed(false);
              setShowGeoResults(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={searchQuery.trim().length < 3 || searching}
          size="icon"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Filter: New Facilities */}
      {newFacilitiesCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant={showNewOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowNewOnly(!showNewOnly)}
            className={showNewOnly ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Novos
            <Badge 
              variant="secondary" 
              className={`ml-1.5 h-5 px-1.5 text-[10px] ${showNewOnly ? 'bg-white/20 text-white' : ''}`}
            >
              {newFacilitiesCount}
            </Badge>
          </Button>
          {showNewOnly && (
            <span className="text-xs text-muted-foreground">
              Últimos 7 dias
            </span>
          )}
        </div>
      )}

      {/* Geocoded Results */}
      {showGeoResults && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              {geocodedResults.length > 0 ? 'Found on map:' : 'No results found on map'}
            </h3>
            <Button variant="outline" size="sm" onClick={handleManualEntry}>
              <Plus className="w-4 h-4 mr-1" />
              Add manually
            </Button>
          </div>

          {geocodedResults.map((result) => (
            <Card key={result.id} className="border-dashed">
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{result.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{result.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleNavigateToResult(result)}
                    >
                      <Navigation className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSelectGeoResult(result)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add & Rate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {geocodedResults.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground mb-4">
                  Can't find "{searchQuery}" on the map
                </p>
                <Button onClick={handleManualEntry}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add facility manually
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* DB Facilities List */}
      {!showGeoResults && (
        <>
          {filteredFacilities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">
                  {searchPerformed ? 'No facilities found' : 'No facilities yet'}
                </p>
                <p className="text-sm mb-4">
                  Search for a company name above to find it on the map
                </p>
                <Button variant="outline" onClick={handleManualEntry} disabled={searchQuery.trim().length < 1}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add facility manually
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFacilities.map((facility) => {
                const agg = aggregates[facility.id];
                const distance = getDistance(facility);
                const locationType = detectLocationType(facility.name, facility.address || undefined);
                const isFuelStop = locationType === 'truck_stop' || locationType === 'fuel';
                const FacilityIcon = isFuelStop ? Fuel : Building2;
                
                return (
                  <Card 
                    key={facility.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/facility/${facility.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FacilityIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{facility.name}</h3>
                            {facility.address && (
                              <p className="text-sm text-muted-foreground">{facility.address}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {distance !== null && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDistance(distance)}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(facility.created_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={getTypeColor(facility.facility_type)}>
                            {facility.facility_type}
                          </Badge>
                          {isNewFacility(facility.created_at) && (
                            <Badge className="bg-emerald-500/90 text-white text-[10px] px-1.5 py-0 h-5 animate-pulse">
                              <Sparkles className="w-3 h-3 mr-0.5" />
                              Novo
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {agg && agg.review_count > 0 ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium">{Number(agg.avg_overall).toFixed(1)}</span>
                              <span className="text-muted-foreground">({agg.review_count})</span>
                            </div>
                            {agg.typical_time && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>{agg.typical_time}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Star className="w-4 h-4" />
                              <span className="text-xs">No ratings yet</span>
                            </div>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary/90 hover:bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/facility/${facility.id}`);
                              }}
                            >
                              <Star className="w-3 h-3 mr-1 fill-current" />
                              Rate
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Latest Tip Preview */}
                      {latestTips[facility.id] && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground line-clamp-2 italic">
                              "{latestTips[facility.id].tips}"
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Manual Entry Modal */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Facility Manually</DialogTitle>
            <DialogDescription>
              Enter the facility details to add it to the database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="manualName">Facility Name *</Label>
              <Input
                id="manualName"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g., Amazon Warehouse"
              />
            </div>

            <div>
              <Label htmlFor="manualAddress">Address (optional)</Label>
              <Input
                id="manualAddress"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div>
              <Label htmlFor="manualType">Facility Type</Label>
              <Select value={manualType} onValueChange={(v) => setManualType(v as 'shipper' | 'receiver' | 'both')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipper">Shipper</SelectItem>
                  <SelectItem value="receiver">Receiver</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowManualEntry(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveManual} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save & Rate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FacilitiesList;
