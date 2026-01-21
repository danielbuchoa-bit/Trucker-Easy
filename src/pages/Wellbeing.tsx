import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Zap, Brain, Activity, Star, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import BottomNav from '@/components/navigation/BottomNav';
import { useEmotionalCheckIn } from '@/contexts/EmotionalCheckInContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MetricCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}> = ({ icon: Icon, label, value, color, bgColor }) => {
  const percentage = (value / 5) * 100;
  
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-full ${bgColor}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className={`text-2xl font-bold ${color}`}>
              {value > 0 ? value.toFixed(1) : '-'}
            </span>
            <span className="text-xs text-muted-foreground">/5</span>
          </div>
          <Progress value={value > 0 ? percentage : 0} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
};

const WellbeingPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    weeklyHistory, 
    insights, 
    getAverages, 
    refreshHistory,
    openMorningCheckIn,
    openEveningCheckIn,
    todayMorningCheckIn,
    todayEveningCheckIn
  } = useEmotionalCheckIn();

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const weeklyAverages = getAverages(7);
  const currentHour = new Date().getHours();
  const canDoMorning = !todayMorningCheckIn;
  const canDoEvening = !todayEveningCheckIn && currentHour >= 18;

  // Group history by date
  const historyByDate = weeklyHistory.reduce((acc, record) => {
    const date = format(new Date(record.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(record);
    return acc;
  }, {} as Record<string, typeof weeklyHistory>);

  const getSeverityColor = (severity: 'info' | 'warning' | 'alert') => {
    switch (severity) {
      case 'alert': return 'border-destructive/50 bg-destructive/10';
      case 'warning': return 'border-warning/50 bg-warning/10';
      default: return 'border-primary/50 bg-primary/10';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            <h1 className="text-lg font-semibold">Meu Bem-Estar</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-3">
          {canDoMorning && (
            <Button 
              onClick={openMorningCheckIn}
              className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
            >
              <Zap className="w-4 h-4 mr-2" />
              Check-in Manhã
            </Button>
          )}
          {canDoEvening && (
            <Button 
              onClick={openEveningCheckIn}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            >
              <Star className="w-4 h-4 mr-2" />
              Check-in Noite
            </Button>
          )}
          {!canDoMorning && !canDoEvening && (
            <div className="flex-1 p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">
                ✅ Check-ins do dia concluídos
              </p>
            </div>
          )}
        </div>

        {/* Weekly Averages */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Média dos últimos 7 dias</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={Zap}
              label="Energia"
              value={weeklyAverages.energy}
              color="text-yellow-500"
              bgColor="bg-yellow-500/20"
            />
            <MetricCard
              icon={Brain}
              label="Estresse"
              value={weeklyAverages.stress}
              color="text-purple-500"
              bgColor="bg-purple-500/20"
            />
            <MetricCard
              icon={Activity}
              label="Corpo"
              value={weeklyAverages.body}
              color="text-green-500"
              bgColor="bg-green-500/20"
            />
            <MetricCard
              icon={Star}
              label="Dia"
              value={weeklyAverages.overall}
              color="text-amber-500"
              bgColor="bg-amber-500/20"
            />
          </div>
        </section>

        {/* Insights */}
        {insights.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Insights</h2>
            </div>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <Card key={index} className={`border ${getSeverityColor(insight.severity)}`}>
                  <CardContent className="p-4">
                    <p className="text-sm text-foreground">{insight.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Histórico</h2>
          </div>
          
          {Object.keys(historyByDate).length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Nenhum registro ainda. Faça seu primeiro check-in!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(historyByDate).map(([date, records]) => (
                <Card key={date} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {records.map((record) => (
                      <div 
                        key={record.id} 
                        className={`p-3 rounded-lg ${
                          record.checkin_type === 'morning' 
                            ? 'bg-amber-500/10' 
                            : 'bg-indigo-500/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {record.checkin_type === 'morning' ? '☀️ Manhã' : '🌙 Noite'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(record.created_at), 'HH:mm')}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-yellow-500 font-semibold">
                              {record.energy_level}/5
                            </div>
                            <div className="text-muted-foreground">Energia</div>
                          </div>
                          <div className="text-center">
                            <div className="text-purple-500 font-semibold">
                              {record.stress_level}/5
                            </div>
                            <div className="text-muted-foreground">Estresse</div>
                          </div>
                          <div className="text-center">
                            <div className="text-green-500 font-semibold">
                              {record.body_condition}/5
                            </div>
                            <div className="text-muted-foreground">Corpo</div>
                          </div>
                        </div>
                        {record.day_quality && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-center text-xs">
                            <span className="text-amber-500 font-semibold">
                              ⭐ Dia: {record.day_quality}/5
                            </span>
                          </div>
                        )}
                        {record.notes && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                            "{record.notes}"
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default WellbeingPage;
