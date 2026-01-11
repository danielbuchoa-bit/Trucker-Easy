import React, { useState } from 'react';
import { Camera, Plus, Car, Construction, Shield, X } from 'lucide-react';
import { SpeedAlertType } from '@/types/speedAlerts';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ReportAlertButtonProps {
  onReport: (type: SpeedAlertType) => void;
}

const REPORT_OPTIONS: { type: SpeedAlertType; label: string; icon: React.ReactNode; color: string }[] = [
  { 
    type: 'speed_camera', 
    label: 'Speed Camera', 
    icon: <Camera className="w-6 h-6" />,
    color: 'bg-red-500 hover:bg-red-600',
  },
  { 
    type: 'mobile_patrol', 
    label: 'Police/Patrol', 
    icon: <Car className="w-6 h-6" />,
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  { 
    type: 'construction_zone', 
    label: 'Construction', 
    icon: <Construction className="w-6 h-6" />,
    color: 'bg-orange-500 hover:bg-orange-600',
  },
  { 
    type: 'enforcement_zone', 
    label: 'Enforcement Zone', 
    icon: <Shield className="w-6 h-6" />,
    color: 'bg-yellow-500 hover:bg-yellow-600',
  },
];

const ReportAlertButton: React.FC<ReportAlertButtonProps> = ({ onReport }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleReport = (type: SpeedAlertType) => {
    onReport(type);
    setIsOpen(false);
    toast.success('Alert reported!', {
      description: 'Thanks for helping other drivers.',
    });
  };

  return (
    <>
      {/* Floating Report Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="
          absolute bottom-32 right-4 z-30
          bg-primary text-primary-foreground
          rounded-full p-3 shadow-lg
          hover:bg-primary/90 transition-colors
          flex items-center gap-2
        "
      >
        <Plus className="w-5 h-5" />
        <Camera className="w-5 h-5" />
      </button>

      {/* Report Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[50vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Report Alert
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {REPORT_OPTIONS.map((option) => (
              <Button
                key={option.type}
                variant="outline"
                className={`
                  h-auto py-4 flex flex-col gap-2
                  ${option.color} text-white border-none
                `}
                onClick={() => handleReport(option.type)}
              >
                {option.icon}
                <span className="text-sm font-medium">{option.label}</span>
              </Button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              Your report will help warn other drivers. Reports expire after 30 minutes if not confirmed.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ReportAlertButton;
