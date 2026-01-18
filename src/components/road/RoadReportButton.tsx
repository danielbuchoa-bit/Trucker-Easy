import React, { useState } from 'react';
import { AlertTriangle, Scale, CloudSnow, Car, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from '@/hooks/use-toast';
import { ROAD_CONDITIONS, INSPECTION_LEVELS, REPORT_TYPE_TTL } from '@/types/collaborative';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';

const RoadReportButton: React.FC = () => {
  const { latitude, longitude } = useGeolocation();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<'weigh_station' | 'road_condition' | 'parking' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Weigh station fields
  const [wsStatus, setWsStatus] = useState<'open' | 'closed' | 'unknown'>('open');
  const [pulledIn, setPulledIn] = useState<boolean | null>(null);
  const [bypassUsed, setBypassUsed] = useState<boolean | null>(null);
  const [inspection, setInspection] = useState('none');
  
  // Road condition
  const [roadCondition, setRoadCondition] = useState('');
  
  // Parking
  const [parkingStatus, setParkingStatus] = useState<'full' | 'few_spots' | 'plenty'>('plenty');

  const resetForm = () => {
    setReportType(null);
    setWsStatus('open');
    setPulledIn(null);
    setBypassUsed(null);
    setInspection('none');
    setRoadCondition('');
    setParkingStatus('plenty');
  };

  const handleSubmit = async () => {
    if (!latitude || !longitude || !reportType) {
      toast({ title: 'Location required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Please sign in', variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Check rate limit
      const { data: canReport, error: checkError } = await supabase.rpc('can_create_report', {
        p_user_id: user.id,
      });

      if (checkError) throw checkError;
      
      if (!canReport) {
        toast({ 
          title: 'Rate limit reached', 
          description: 'Maximum 10 reports per hour.',
          variant: 'destructive' 
        });
        setSubmitting(false);
        return;
      }

      // Calculate TTL
      let ttl = REPORT_TYPE_TTL[reportType] || 2 * 60 * 60 * 1000;
      if (roadCondition === 'ice_snow' || roadCondition === 'high_wind') {
        ttl = REPORT_TYPE_TTL[roadCondition];
      }
      
      const expiresAt = new Date(Date.now() + ttl).toISOString();

      // Build details as JSON-compatible object
      let details: Json = {};
      let subtype: string | null = null;
      
      if (reportType === 'weigh_station') {
        details = {
          status: wsStatus,
          pulled_in: pulledIn,
          bypass: bypassUsed,
          inspection,
        };
        subtype = wsStatus;
      } else if (reportType === 'road_condition') {
        details = { condition: roadCondition };
        subtype = roadCondition;
      } else if (reportType === 'parking') {
        details = { parking_status: parkingStatus };
        subtype = parkingStatus;
      }

      const { error } = await supabase.from('road_reports').insert({
        user_id: user.id,
        report_type: reportType as string,
        subtype,
        lat: latitude,
        lng: longitude,
        details,
        expires_at: expiresAt,
      });

      if (error) throw error;
      
      toast({ title: 'Report submitted!', description: 'Thanks for helping other drivers.' });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      const errorMessage = error?.message || error?.code || 'Unknown error';
      toast({ 
        title: 'Failed to submit report', 
        description: errorMessage,
        variant: 'destructive' 
      });
    }
    
    setSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          size="lg" 
          className="fixed bottom-24 right-4 z-50 rounded-full w-14 h-14 shadow-lg"
        >
          <AlertTriangle className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Report</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {!reportType ? (
            /* Report Type Selection */
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setReportType('weigh_station')}
                className="flex flex-col items-center gap-2 p-4 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors"
              >
                <Scale className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium">Weigh Station</span>
              </button>
              
              <button
                onClick={() => setReportType('road_condition')}
                className="flex flex-col items-center gap-2 p-4 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors"
              >
                <CloudSnow className="w-8 h-8 text-blue-500" />
                <span className="text-sm font-medium">Road Condition</span>
              </button>
              
              <button
                onClick={() => setReportType('parking')}
                className="flex flex-col items-center gap-2 p-4 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors"
              >
                <Car className="w-8 h-8 text-green-500" />
                <span className="text-sm font-medium">Truck Parking</span>
              </button>
            </div>
          ) : reportType === 'weigh_station' ? (
            /* Weigh Station Form */
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setReportType(null)}>
                ← Back
              </Button>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-2">
                  {['open', 'closed', 'unknown'].map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={wsStatus === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setWsStatus(status as typeof wsStatus)}
                      className={cn(
                        "flex-1 capitalize",
                        wsStatus === status && status === 'open' && "bg-green-600 hover:bg-green-700",
                        wsStatus === status && status === 'closed' && "bg-red-600 hover:bg-red-700"
                      )}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pulled In?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={pulledIn === true ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPulledIn(true)}
                    className="flex-1"
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={pulledIn === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPulledIn(false)}
                    className="flex-1"
                  >
                    No
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bypass?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={bypassUsed === true ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBypassUsed(true)}
                    className="flex-1"
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={bypassUsed === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBypassUsed(false)}
                    className="flex-1"
                  >
                    No
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Inspection</Label>
                <RadioGroup value={inspection} onValueChange={setInspection}>
                  {INSPECTION_LEVELS.map((level) => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={level.value} id={level.value} />
                      <Label htmlFor={level.value}>{level.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          ) : reportType === 'road_condition' ? (
            /* Road Condition Form */
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setReportType(null)}>
                ← Back
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                {ROAD_CONDITIONS.map((condition) => (
                  <button
                    key={condition.value}
                    onClick={() => setRoadCondition(condition.value)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border transition-colors",
                      roadCondition === condition.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 border-border hover:bg-secondary"
                    )}
                  >
                    <span className="text-xl">{condition.icon}</span>
                    <span className="text-sm font-medium">{condition.label}</span>
                  </button>
                ))}
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={!roadCondition || submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          ) : (
            /* Parking Form */
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setReportType(null)}>
                ← Back
              </Button>
              
              <div className="space-y-2">
                <Label>Parking Status</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'plenty', label: 'Plenty', color: 'bg-green-600' },
                    { value: 'few_spots', label: 'Few Spots', color: 'bg-yellow-600' },
                    { value: 'full', label: 'Full', color: 'bg-red-600' },
                  ].map((status) => (
                    <Button
                      key={status.value}
                      type="button"
                      variant={parkingStatus === status.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setParkingStatus(status.value as typeof parkingStatus)}
                      className={cn(
                        "flex-1",
                        parkingStatus === status.value && status.color
                      )}
                    >
                      {status.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RoadReportButton;
