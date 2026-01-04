import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Building2, Loader2, Clock } from 'lucide-react';
import StarRating from './StarRating';
import { FACILITY_TAGS } from '@/types/stops';
import { cn } from '@/lib/utils';

interface FacilityRatingFormProps {
  facilityName?: string;
  onSubmit: (rating: {
    facility_name: string;
    facility_type: 'shipper' | 'receiver' | 'both';
    address?: string;
    overall_rating: number;
    wait_time_rating?: number;
    dock_access_rating?: number;
    staff_rating?: number;
    restroom_rating?: number;
    tags: string[];
    avg_wait_minutes?: number;
    comment?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const TAG_LABELS: Record<string, string> = {
  appointment_only: 'Appointment Only',
  drop_hook: 'Drop & Hook',
  lumper_required: 'Lumper Required',
  driver_friendly: 'Driver Friendly',
  no_restroom: 'No Restroom',
  fast_loading: 'Fast Loading',
  slow_loading: 'Slow Loading',
  night_shift: 'Night Shift',
};

const FacilityRatingForm: React.FC<FacilityRatingFormProps> = ({
  facilityName: initialName = '',
  onSubmit,
  isLoading = false,
}) => {
  const [facilityName, setFacilityName] = useState(initialName);
  const [facilityType, setFacilityType] = useState<'shipper' | 'receiver' | 'both'>('shipper');
  const [address, setAddress] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [waitTimeRating, setWaitTimeRating] = useState(0);
  const [dockAccessRating, setDockAccessRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [restroomRating, setRestroomRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [avgWaitMinutes, setAvgWaitMinutes] = useState('');
  const [comment, setComment] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!facilityName.trim() || overallRating === 0) return;

    await onSubmit({
      facility_name: facilityName.trim(),
      facility_type: facilityType,
      address: address.trim() || undefined,
      overall_rating: overallRating,
      wait_time_rating: waitTimeRating || undefined,
      dock_access_rating: dockAccessRating || undefined,
      staff_rating: staffRating || undefined,
      restroom_rating: restroomRating || undefined,
      tags: selectedTags,
      avg_wait_minutes: avgWaitMinutes ? parseInt(avgWaitMinutes) : undefined,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-primary" />
          Rate Facility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Facility Name */}
        <div className="space-y-2">
          <Label>Facility Name *</Label>
          <Input
            placeholder="Company name"
            value={facilityName}
            onChange={e => setFacilityName(e.target.value)}
          />
        </div>

        {/* Facility Type */}
        <div className="space-y-2">
          <Label>Type *</Label>
          <RadioGroup
            value={facilityType}
            onValueChange={(v) => setFacilityType(v as typeof facilityType)}
            className="flex gap-4"
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

        {/* Address */}
        <div className="space-y-2">
          <Label>Address (optional)</Label>
          <Input
            placeholder="Street address, city, state"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>

        {/* Overall Rating */}
        <div className="space-y-2">
          <Label>Overall Rating *</Label>
          <StarRating
            rating={overallRating}
            interactive
            onChange={setOverallRating}
            size="lg"
          />
        </div>

        {/* Wait Time Input */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Average Wait Time (minutes)
          </Label>
          <Input
            type="number"
            placeholder="e.g., 120"
            value={avgWaitMinutes}
            onChange={e => setAvgWaitMinutes(e.target.value)}
          />
        </div>

        {/* Sub-ratings */}
        <div className="space-y-3">
          <Label className="text-muted-foreground">Detailed Ratings (optional)</Label>
          
          <StarRating
            rating={waitTimeRating}
            interactive
            onChange={setWaitTimeRating}
            label="Wait Time"
          />
          <StarRating
            rating={dockAccessRating}
            interactive
            onChange={setDockAccessRating}
            label="Dock Access"
          />
          <StarRating
            rating={staffRating}
            interactive
            onChange={setStaffRating}
            label="Staff"
          />
          <StarRating
            rating={restroomRating}
            interactive
            onChange={setRestroomRating}
            label="Restroom"
          />
        </div>

        {/* Quick Tags */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Quick Tags</Label>
          <div className="flex flex-wrap gap-2">
            {FACILITY_TAGS.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedTags.includes(tag) && "bg-primary"
                )}
                onClick={() => toggleTag(tag)}
              >
                {TAG_LABELS[tag] || tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Comment (optional)</Label>
          <Textarea
            placeholder="Share your experience..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!facilityName.trim() || overallRating === 0 || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Rating'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default FacilityRatingForm;
