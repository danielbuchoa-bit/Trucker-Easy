import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Phone, Clock, ExternalLink, Navigation, Loader2, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGeolocation } from '@/hooks/useGeolocation';

interface DMVLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  hours: string;
  distance?: number;
  url?: string;
}

interface FindDMVModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Mock data - in production, this would come from an API
const getMockDMVLocations = (state: string): DMVLocation[] => [
  {
    id: '1',
    name: `${state} DMV - Main Office`,
    address: '123 State St',
    city: 'Capital City',
    state,
    phone: '(555) 123-4567',
    hours: 'Mon-Fri: 8:00 AM - 5:00 PM',
    distance: 2.3,
    url: 'https://dmv.gov',
  },
  {
    id: '2',
    name: `${state} DMV - North Branch`,
    address: '456 North Ave',
    city: 'Northville',
    state,
    phone: '(555) 234-5678',
    hours: 'Mon-Fri: 9:00 AM - 4:00 PM, Sat: 9:00 AM - 12:00 PM',
    distance: 5.7,
    url: 'https://dmv.gov',
  },
  {
    id: '3',
    name: `${state} DMV - Express Center`,
    address: '789 Quick Ln',
    city: 'Speedtown',
    state,
    phone: '(555) 345-6789',
    hours: 'Mon-Sat: 7:00 AM - 7:00 PM',
    distance: 8.1,
    url: 'https://dmv.gov',
  },
];

const FindDMVModal: React.FC<FindDMVModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [selectedState, setSelectedState] = useState<string>('');
  const [locations, setLocations] = useState<DMVLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const { latitude, longitude, loading: geoLoading, requestPosition } = useGeolocation();

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLocations(getMockDMVLocations(state));
      setLoading(false);
    }, 500);
  };

  const handleUseLocation = () => {
    requestPosition();
    // In production, reverse geocode to get state
    // For demo, just use a default state
    setTimeout(() => {
      handleStateChange('TX');
    }, 1000);
  };

  const openDirections = (location: DMVLocation) => {
    // Navigate to in-app GPS navigation instead of Google Maps
    const destination = `${location.address}, ${location.city}, ${location.state}`;
    onClose();
    navigate('/navigation', { 
      state: { 
        destination,
        destinationName: location.name
      } 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🏛️ Find DMV Office
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* State Selector */}
          <div className="flex gap-2">
            <Select value={selectedState} onValueChange={handleStateChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={handleUseLocation}
              disabled={geoLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              {geoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Use GPS</span>
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {!loading && locations.length === 0 && selectedState && (
              <div className="text-center py-8 text-muted-foreground">
                No DMV offices found
              </div>
            )}

            {!loading && !selectedState && (
              <div className="text-center py-8 text-muted-foreground">
                Select a state or use GPS to find nearby DMV offices
              </div>
            )}

            {!loading && locations.map((location) => (
              <div
                key={location.id}
                className="p-4 bg-card rounded-xl border border-border space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{location.name}</h4>
                    {location.distance && (
                      <Badge variant="outline" className="mt-1">
                        {location.distance} mi away
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{location.address}, {location.city}, {location.state}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <a href={`tel:${location.phone}`} className="hover:text-primary">
                      {location.phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{location.hours}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => openDirections(location)}
                    className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Directions
                  </button>

                  {location.url && (
                    <button
                      onClick={() => window.open(location.url, '_blank')}
                      className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FindDMVModal;
