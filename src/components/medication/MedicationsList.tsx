import React from 'react';
import { Pill, Clock, Pause, Play, Pencil, Trash2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Medication, useMedications } from '@/hooks/useMedications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MedicationsListProps {
  medications: Medication[];
  onAdd: () => void;
  onEdit: (medication: Medication) => void;
  onTogglePause: (id: string, paused: boolean) => void;
  onDelete: (id: string) => void;
  getNextReminder: (medication: Medication) => Date | null;
}

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MedicationsList: React.FC<MedicationsListProps> = ({
  medications,
  onAdd,
  onEdit,
  onTogglePause,
  onDelete,
  getNextReminder,
}) => {
  const formatNextReminder = (medication: Medication): string => {
    const next = getNextReminder(medication);
    if (!next) return 'Pausado';
    
    const now = new Date();
    const isToday = next.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === next.toDateString();
    
    if (isToday) {
      return `Hoje às ${format(next, 'HH:mm')}`;
    } else if (isTomorrow) {
      return `Amanhã às ${format(next, 'HH:mm')}`;
    }
    return format(next, "EEE 'às' HH:mm", { locale: ptBR });
  };

  if (medications.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted">
        <CardContent className="p-8 text-center">
          <Pill className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-foreground mb-2">Nenhum medicamento cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione seus medicamentos para receber lembretes automáticos
          </p>
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Medicamento
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-foreground">Meus Medicamentos</h3>
        <Button size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {medications.map((med) => (
        <Card 
          key={med.id} 
          className={`border ${med.paused ? 'opacity-60 border-muted' : 'border-border'}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`p-2 rounded-full ${med.paused ? 'bg-muted' : 'bg-primary/10'}`}>
                  <Pill className={`w-5 h-5 ${med.paused ? 'text-muted-foreground' : 'text-primary'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground truncate">{med.name}</h4>
                    {med.paused && (
                      <Badge variant="secondary" className="text-xs">Pausado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{med.dosage_text}</p>
                  
                  {/* Schedule info */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {med.times_of_day.map((time, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {time}
                      </Badge>
                    ))}
                  </div>
                  
                  {med.schedule_type === 'weekly' && (
                    <div className="flex gap-1 mb-2">
                      {DAYS_SHORT.map((day, i) => (
                        <span
                          key={i}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            med.days_of_week.includes(i)
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Next reminder */}
                  <p className="text-xs text-muted-foreground">
                    📅 Próximo: {formatNextReminder(med)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTogglePause(med.id, !med.paused)}
                className="flex-1"
              >
                {med.paused ? (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Reativar
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-1" />
                    Pausar
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(med)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir medicamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O medicamento "{med.name}" e todo o histórico
                      de lembretes serão removidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(med.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Medical disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mt-4">
        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Este recurso não substitui orientação médica. Sempre siga as instruções
          do seu médico ou farmacêutico.
        </p>
      </div>
    </div>
  );
};

export default MedicationsList;
