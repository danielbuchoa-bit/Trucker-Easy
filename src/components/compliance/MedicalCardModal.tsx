import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Phone, Clock, ExternalLink, Navigation, Loader2, Upload, Calendar, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGeolocation } from '@/hooks/useGeolocation';

interface TestingLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  hours: string;
  distance?: number;
  type: 'drug_test' | 'medical_exam' | 'both';
  url?: string;
}

interface MedicalCardModalProps {
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

const getMockLocations = (state: string): TestingLocation[] => [
  {
    id: '1',
    name: 'DOT Medical Examiners LLC',
    address: '100 Medical Plaza',
    city: 'Healthcare City',
    state,
    phone: '(555) 111-2222',
    hours: 'Mon-Fri: 7:00 AM - 6:00 PM',
    distance: 1.5,
    type: 'both',
    url: 'https://example.com',
  },
  {
    id: '2',
    name: 'QuickTest Drug Screening',
    address: '200 Lab Avenue',
    city: 'Testville',
    state,
    phone: '(555) 222-3333',
    hours: 'Mon-Sat: 6:00 AM - 8:00 PM',
    distance: 3.2,
    type: 'drug_test',
    url: 'https://example.com',
  },
  {
    id: '3',
    name: 'Certified Medical Examiner',
    address: '300 Doctor Drive',
    city: 'Medtown',
    state,
    phone: '(555) 333-4444',
    hours: 'Mon-Fri: 8:00 AM - 5:00 PM',
    distance: 4.8,
    type: 'medical_exam',
    url: 'https://example.com',
  },
];

const MedicalCardModal: React.FC<MedicalCardModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('find');
  const [selectedState, setSelectedState] = useState<string>('');
  const [locations, setLocations] = useState<TestingLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [cardUploaded, setCardUploaded] = useState(false);
  const { loading: geoLoading, requestPosition } = useGeolocation();

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setLoading(true);
    setTimeout(() => {
      setLocations(getMockLocations(state));
      setLoading(false);
    }, 500);
  };

  const handleUseLocation = () => {
    requestPosition();
    setTimeout(() => {
      handleStateChange('TX');
    }, 1000);
  };

  const openDirections = (location: TestingLocation) => {
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'drug_test': return 'Drug Testing';
      case 'medical_exam': return 'Medical Exam';
      case 'both': return 'Both Services';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'drug_test': return 'bg-info/20 text-info';
      case 'medical_exam': return 'bg-success/20 text-success';
      case 'both': return 'bg-primary/20 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const daysUntilExpiration = expirationDate
    ? Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // In production, upload to storage
      setCardUploaded(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🩺 Drug Test & Medical Card
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="find">Find Locations</TabsTrigger>
            <TabsTrigger value="card">My Medical Card</TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="flex-1 overflow-hidden flex flex-col mt-4 space-y-4">
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

              {!loading && !selectedState && (
                <div className="text-center py-8 text-muted-foreground">
                  Select a state or use GPS to find nearby testing locations
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
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getTypeColor(location.type)}>
                          {getTypeLabel(location.type)}
                        </Badge>
                        {location.distance && (
                          <Badge variant="outline">
                            {location.distance} mi
                          </Badge>
                        )}
                      </div>
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

                  <button
                    onClick={() => openDirections(location)}
                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Get Directions
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="card" className="flex-1 overflow-y-auto mt-4 space-y-4">
            {/* Medical Card Upload */}
            <div className="p-4 bg-card rounded-xl border border-border space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Upload Medical Card
              </h4>

              {cardUploaded ? (
                <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="text-sm text-success">Medical card uploaded successfully</span>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload your medical card</span>
                  <span className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>

            {/* Expiration Date */}
            <div className="p-4 bg-card rounded-xl border border-border space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Expiration Tracking
              </h4>

              <div className="space-y-2">
                <Label htmlFor="expiration">Card Expiration Date</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="bg-background"
                />
              </div>

              {daysUntilExpiration !== null && (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${
                  daysUntilExpiration <= 30
                    ? 'bg-destructive/10'
                    : daysUntilExpiration <= 60
                    ? 'bg-warning/10'
                    : 'bg-success/10'
                }`}>
                  {daysUntilExpiration <= 30 ? (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  ) : daysUntilExpiration <= 60 ? (
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      daysUntilExpiration <= 30
                        ? 'text-destructive'
                        : daysUntilExpiration <= 60
                        ? 'text-warning'
                        : 'text-success'
                    }`}>
                      {daysUntilExpiration <= 0
                        ? 'Card has expired!'
                        : `${daysUntilExpiration} days until expiration`}
                    </p>
                    {daysUntilExpiration <= 30 && daysUntilExpiration > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Schedule your renewal exam soon
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reminder Info */}
            <div className="p-4 bg-secondary/50 rounded-xl text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  You'll receive notifications 30 days before your medical card expires to ensure you have time to schedule a renewal exam.
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default MedicalCardModal;
