import React from 'react';
import { History, Check, AlarmClock, X, TrendingUp, Pill } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { MedicationLog, Medication } from '@/hooks/useMedications';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MedicationHistoryProps {
  logs: MedicationLog[];
  medications: Medication[];
  adherenceStats: {
    total: number;
    taken: number;
    skipped: number;
    snoozed: number;
    adherencePercent: number;
  };
}

const MedicationHistory: React.FC<MedicationHistoryProps> = ({
  logs,
  medications,
  adherenceStats,
}) => {
  const getMedicationName = (medicationId: string): string => {
    const med = medications.find(m => m.id === medicationId);
    return med?.name || 'Medicamento removido';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'taken':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'snoozed':
        return <AlarmClock className="w-4 h-4 text-amber-500" />;
      case 'skipped':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'taken': return 'Tomado';
      case 'snoozed': return 'Adiado';
      case 'skipped': return 'Pulado';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'taken': return 'bg-green-500/10 text-green-600';
      case 'snoozed': return 'bg-amber-500/10 text-amber-600';
      case 'skipped': return 'bg-red-500/10 text-red-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Group logs by date
  const logsByDate = logs.reduce((acc, log) => {
    const date = format(new Date(log.scheduled_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, MedicationLog[]>);

  return (
    <div className="space-y-4">
      {/* Adherence Summary */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Aderência Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-primary">
              {adherenceStats.adherencePercent}%
            </span>
            <span className="text-sm text-muted-foreground">
              {adherenceStats.taken} de {adherenceStats.total} doses
            </span>
          </div>
          <Progress value={adherenceStats.adherencePercent} className="h-3" />
          
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="text-center p-2 rounded-lg bg-green-500/10">
              <div className="text-lg font-semibold text-green-600">
                {adherenceStats.taken}
              </div>
              <div className="text-xs text-green-600">Tomados</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-500/10">
              <div className="text-lg font-semibold text-amber-600">
                {adherenceStats.snoozed}
              </div>
              <div className="text-xs text-amber-600">Adiados</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10">
              <div className="text-lg font-semibold text-red-600">
                {adherenceStats.skipped}
              </div>
              <div className="text-xs text-red-600">Pulados</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed History */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Medicação
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-8 text-center">
              <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum registro ainda
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(logsByDate).map(([date, dayLogs]) => (
                <div key={date}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </h4>
                  <div className="space-y-2">
                    {dayLogs.map((log) => {
                      const scheduledTime = new Date(log.scheduled_at);
                      const actionTime = new Date(log.action_at);
                      const delayMinutes = differenceInMinutes(actionTime, scheduledTime);
                      
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-full ${getActionColor(log.action)}`}>
                              {getActionIcon(log.action)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {getMedicationName(log.medication_id)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Agendado: {format(scheduledTime, 'HH:mm')}
                                {delayMinutes > 0 && log.action === 'taken' && (
                                  <span className="text-amber-500 ml-1">
                                    (+{delayMinutes} min)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className={getActionColor(log.action)}>
                              {getActionLabel(log.action)}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(actionTime, 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicationHistory;
