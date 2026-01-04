import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Star, Clock, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import type { Facility, FacilityAggregate } from '@/types/collaborative';

const FacilitiesList: React.FC = () => {
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [aggregates, setAggregates] = useState<Record<string, FacilityAggregate>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facilitiesRes, aggregatesRes] = await Promise.all([
          supabase.from('facilities').select('*').limit(100),
          supabase.from('facility_aggregates').select('*'),
        ]);

        if (facilitiesRes.data) {
          setFacilities(facilitiesRes.data as unknown as Facility[]);
        }
        
        if (aggregatesRes.data) {
          const map: Record<string, FacilityAggregate> = {};
          aggregatesRes.data.forEach((agg: unknown) => {
            const a = agg as FacilityAggregate;
            map[a.facility_id] = a;
          });
          setAggregates(map);
        }
      } catch (error) {
        console.error('Error fetching facilities:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

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
      case 'shipper': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'receiver': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      default: return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
    }
  };

  const filteredFacilities = facilities
    .filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.address && f.address.toLowerCase().includes(searchQuery.toLowerCase()))
    )
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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search facilities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {filteredFacilities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {searchQuery ? 'No facilities found' : 'No facilities yet. Rate your first facility!'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFacilities.map((facility) => {
            const agg = aggregates[facility.id];
            const distance = getDistance(facility);
            
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
                        <Building2 className="w-5 h-5 text-primary" />
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
                        </div>
                      </div>
                    </div>
                    <Badge className={getTypeColor(facility.facility_type)}>
                      {facility.facility_type}
                    </Badge>
                  </div>

                  {agg && (
                    <div className="flex items-center gap-4 mt-2 text-sm">
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
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FacilitiesList;
