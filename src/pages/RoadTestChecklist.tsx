import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoadTest } from '@/contexts/RoadTestContext';
import { ArrowLeft, CheckCircle, XCircle, Circle, RotateCcw, Download, Share2, Clipboard, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/navigation/BottomNav';
import { toast } from 'sonner';

const RoadTestChecklist: React.FC = () => {
  const navigate = useNavigate();
  const { checklist, updateChecklistItem, resetChecklist, exportDiagnosticReport, isRoadTestMode, diagnostics } = useRoadTest();
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = async (itemId: string) => {
    setTesting(itemId);
    
    // Simulate test based on item
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let result: 'pass' | 'fail' = 'pass';
    let errorLog: string | undefined;

    switch (itemId) {
      case 'gps_fixed':
        if (diagnostics.gps && diagnostics.gps.accuracy < 50) {
          result = 'pass';
        } else {
          result = 'fail';
          errorLog = `GPS accuracy: ${diagnostics.gps?.accuracy || 'N/A'}m (expected < 50m)`;
        }
        break;
        
      case 'cursor_on_road':
        result = diagnostics.cursorOnRoad ? 'pass' : 'fail';
        if (!diagnostics.cursorOnRoad) {
          errorLog = 'Cursor not aligned with road - check map matching';
        }
        break;
        
      case 'reroute_working':
        result = diagnostics.isNavigating ? 'pass' : 'fail';
        if (!diagnostics.isNavigating) {
          errorLog = 'Navigation not active - start navigation to test';
        }
        break;
        
      case 'voice_working':
        result = diagnostics.voiceEnabled ? 'pass' : 'fail';
        if (!diagnostics.voiceEnabled) {
          errorLog = 'Voice guidance disabled';
        }
        break;
        
      case 'no_api_errors':
        result = !diagnostics.lastApiError ? 'pass' : 'fail';
        if (diagnostics.lastApiError) {
          errorLog = `Last error: ${diagnostics.lastApiError.endpoint} - ${diagnostics.lastApiError.status}`;
        }
        break;
        
      default:
        // For other items, default to pending manual verification
        result = 'pass';
    }

    updateChecklistItem(itemId, result, errorLog);
    setTesting(null);
    
    toast(result === 'pass' ? 'Teste passou!' : 'Teste falhou', {
      description: errorLog || undefined,
    });
  };

  const handleExport = async () => {
    const report = exportDiagnosticReport();
    
    // Try to use share API on mobile
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Road Test Diagnostic Report',
          text: report,
        });
        return;
      } catch (e) {
        // Fall through to clipboard
      }
    }
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(report);
      toast.success('Relatório copiado!', {
        description: 'Diagnóstico exportado para a área de transferência',
      });
    } catch (e) {
      toast.error('Erro ao copiar relatório');
    }
  };

  const passCount = checklist.filter(i => i.status === 'pass').length;
  const failCount = checklist.filter(i => i.status === 'fail').length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background pt-safe">
        <div className="p-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Road Test Checklist</h1>
            <p className="text-sm text-muted-foreground">
              {isRoadTestMode ? 'Mode: ACTIVE' : 'Mode: OFF'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4">
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Progresso</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle className="w-4 h-4" />
                {passCount}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="w-4 h-4" />
                {failCount}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Circle className="w-4 h-4" />
                {checklist.length - passCount - failCount}
              </span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${((passCount + failCount) / checklist.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2">
          {checklist.map(item => (
            <div 
              key={item.id}
              className="bg-card rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {item.status === 'pass' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {item.status === 'fail' && <XCircle className="w-5 h-5 text-red-500" />}
                    {item.status === 'pending' && <Circle className="w-5 h-5 text-muted-foreground" />}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 ml-7">
                    {item.description}
                  </p>
                  {item.errorLog && (
                    <p className="text-xs text-red-500 mt-1 ml-7 font-mono">
                      {item.errorLog}
                    </p>
                  )}
                  {item.testedAt && (
                    <p className="text-xs text-muted-foreground mt-1 ml-7">
                      Testado: {new Date(item.testedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={item.status === 'pending' ? 'default' : 'outline'}
                  onClick={() => handleTest(item.id)}
                  disabled={testing === item.id}
                >
                  {testing === item.id ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={resetChecklist}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Resetar Checklist
          </Button>
          
          <Button 
            className="w-full"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório de Diagnóstico
          </Button>
        </div>
      </div>

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default RoadTestChecklist;
