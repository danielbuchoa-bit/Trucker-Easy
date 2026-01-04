import React, { useState } from 'react';
import { Search, MapPin, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Facility } from '@/types/collaborative';

interface FacilityIdentifyModalProps {
  lat: number;
  lng: number;
  onComplete: (facility: Facility) => void;
  onClose: () => void;
}

const FacilityIdentifyModal: React.FC<FacilityIdentifyModalProps> = ({
  lat,
  lng,
  onComplete,
  onClose,
}) => {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Facility[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Create form state
  const [facilityName, setFacilityName] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [facilityType, setFacilityType] = useState<'shipper' | 'receiver' | 'both'>('both');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults((data || []) as unknown as Facility[]);
    } catch (error) {
      console.error('Error searching facilities:', error);
    }
    setSearching(false);
  };

  const handleSelectFacility = (facility: Facility) => {
    onComplete(facility);
  };

  const handleCreateFacility = async () => {
    if (!facilityName.trim()) return;
    
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Please sign in', variant: 'destructive' });
        setCreating(false);
        return;
      }

      const { data, error } = await supabase
        .from('facilities')
        .insert({
          name: facilityName.trim(),
          address: facilityAddress.trim() || null,
          lat,
          lng,
          facility_type: facilityType,
          created_by: user.id,
          geofence_radius_m: 200,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Location saved!' });
      onComplete(data as unknown as Facility);
    } catch (error) {
      console.error('Error creating facility:', error);
      toast({ title: 'Failed to save location', variant: 'destructive' });
    }
    setCreating(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Which facility is this?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('search')}
              className="flex-1"
            >
              <Search className="w-4 h-4 mr-1" />
              Search
            </Button>
            <Button
              variant={mode === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('create')}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add New
            </Button>
          </div>

          {mode === 'search' ? (
            <>
              {/* Search Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Search Results */}
              <div className="max-h-48 overflow-y-auto space-y-2">
                {searchResults.map((facility) => (
                  <button
                    key={facility.id}
                    onClick={() => handleSelectFacility(facility)}
                    className="w-full p-3 text-left bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <p className="font-medium">{facility.name}</p>
                    {facility.address && (
                      <p className="text-sm text-muted-foreground">{facility.address}</p>
                    )}
                  </button>
                ))}
                {searchResults.length === 0 && searchQuery && !searching && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No results. Try creating a new location.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Create Form */}
              <div className="space-y-3">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    placeholder="Enter company name"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Address (optional)</Label>
                  <Input
                    placeholder="Street, City, State"
                    value={facilityAddress}
                    onChange={(e) => setFacilityAddress(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Type</Label>
                  <RadioGroup
                    value={facilityType}
                    onValueChange={(v) => setFacilityType(v as typeof facilityType)}
                    className="flex gap-4 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="shipper" id="shipper" />
                      <Label htmlFor="shipper">Shipper</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="receiver" id="receiver" />
                      <Label htmlFor="receiver">Receiver</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both">Both</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button
                  onClick={handleCreateFacility}
                  disabled={!facilityName.trim() || creating}
                  className="w-full"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save as New Location'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FacilityIdentifyModal;
