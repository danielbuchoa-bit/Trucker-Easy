import React, { useState, useEffect } from 'react';
import { X, Plus, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Medication, MedicationFormData } from '@/hooks/useMedications';

interface MedicationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MedicationFormData) => Promise<boolean>;
  medication?: Medication | null;
}

const DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'No horário' },
  { value: 5, label: '5 minutos antes' },
  { value: 10, label: '10 minutos antes' },
];

const MedicationForm: React.FC<MedicationFormProps> = ({
  open,
  onClose,
  onSubmit,
  medication,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MedicationFormData>({
    name: '',
    dosage_text: '',
    schedule_type: 'daily',
    times_of_day: ['08:00'],
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    reminder_minutes_before: 0,
    snooze_enabled: true,
    snooze_options: [10, 15, 30, 60],
    driving_modal_disabled: true,
    notes: '',
  });

  useEffect(() => {
    if (medication) {
      setFormData({
        name: medication.name,
        dosage_text: medication.dosage_text,
        schedule_type: medication.schedule_type,
        times_of_day: medication.times_of_day,
        days_of_week: medication.days_of_week,
        reminder_minutes_before: medication.reminder_minutes_before,
        snooze_enabled: medication.snooze_enabled,
        snooze_options: medication.snooze_options,
        driving_modal_disabled: medication.driving_modal_disabled,
        notes: medication.notes || '',
      });
    } else {
      setFormData({
        name: '',
        dosage_text: '',
        schedule_type: 'daily',
        times_of_day: ['08:00'],
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        reminder_minutes_before: 0,
        snooze_enabled: true,
        snooze_options: [10, 15, 30, 60],
        driving_modal_disabled: true,
        notes: '',
      });
    }
  }, [medication, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.dosage_text.trim()) return;
    
    setLoading(true);
    const success = await onSubmit(formData);
    setLoading(false);
    
    if (success) {
      onClose();
    }
  };

  const addTime = () => {
    setFormData(prev => ({
      ...prev,
      times_of_day: [...prev.times_of_day, '12:00'],
    }));
  };

  const updateTime = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      times_of_day: prev.times_of_day.map((t, i) => i === index ? value : t),
    }));
  };

  const removeTime = (index: number) => {
    if (formData.times_of_day.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      times_of_day: prev.times_of_day.filter((_, i) => i !== index),
    }));
  };

  const toggleDay = (day: number) => {
    setFormData(prev => {
      const days = prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort();
      return { ...prev, days_of_week: days };
    });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {medication ? 'Editar Medicamento' : 'Adicionar Medicamento'}
          </SheetTitle>
          <SheetDescription>
            Configure os detalhes e horários do medicamento
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pb-8">
          {/* Nome do Medicamento */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Medicamento *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Losartana"
              required
            />
          </div>

          {/* Dose */}
          <div className="space-y-2">
            <Label htmlFor="dosage">Dose *</Label>
            <Input
              id="dosage"
              value={formData.dosage_text}
              onChange={(e) => setFormData(prev => ({ ...prev, dosage_text: e.target.value }))}
              placeholder="Ex: 1 comprimido de 50mg"
              required
            />
          </div>

          {/* Frequência */}
          <div className="space-y-3">
            <Label>Frequência</Label>
            <RadioGroup
              value={formData.schedule_type}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                schedule_type: value as 'daily' | 'weekly' 
              }))}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily" className="font-normal cursor-pointer">Diário</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly" className="font-normal cursor-pointer">Dias da semana</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Dias da Semana (if weekly) */}
          {formData.schedule_type === 'weekly' && (
            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.days_of_week.includes(day.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Horários */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Horários do Dia</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addTime}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {formData.times_of_day.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => updateTime(index, e.target.value)}
                    className="flex-1"
                  />
                  {formData.times_of_day.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTime(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: Tomar com comida, antes de dormir..."
              rows={2}
            />
          </div>

          {/* Lembrete Antecipado */}
          <div className="space-y-2">
            <Label>Lembrete Antecipado</Label>
            <Select
              value={String(formData.reminder_minutes_before)}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                reminder_minutes_before: Number(value) 
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Soneca */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir Soneca</Label>
                <p className="text-xs text-muted-foreground">
                  Adiar o lembrete por alguns minutos
                </p>
              </div>
              <Switch
                checked={formData.snooze_enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  snooze_enabled: checked 
                }))}
              />
            </div>

            {formData.snooze_enabled && (
              <div className="flex gap-2 flex-wrap">
                {[10, 15, 30, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const opts = prev.snooze_options.includes(mins)
                          ? prev.snooze_options.filter(m => m !== mins)
                          : [...prev.snooze_options, mins].sort((a, b) => a - b);
                        return { ...prev, snooze_options: opts.length ? opts : [10] };
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      formData.snooze_options.includes(mins)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border text-foreground'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Modo Direção */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <Label>Não exibir pop-up enquanto dirige</Label>
              <p className="text-xs text-muted-foreground">
                Exibir apenas banner discreto durante navegação
              </p>
            </div>
            <Switch
              checked={formData.driving_modal_disabled}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                driving_modal_disabled: checked 
              }))}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : medication ? 'Salvar Alterações' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default MedicationForm;
