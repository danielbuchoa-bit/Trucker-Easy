import { AlertCircle, MapPin, ExternalLink, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationErrorCardProps {
  errorCode?: number;
  onRetry: () => void;
  loading?: boolean;
}

const LocationErrorCard = ({ errorCode, onRetry, loading }: LocationErrorCardProps) => {
  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Twitter|Line|WhatsApp/.test(navigator.userAgent);
  
  const getErrorInfo = () => {
    // Permission denied
    if (errorCode === 1) {
      return {
        title: 'Permissão de Localização Negada',
        description: 'O aplicativo precisa de acesso à sua localização para mostrar lugares próximos.',
        instructions: getPermissionInstructions(),
      };
    }
    
    // Position unavailable
    if (errorCode === 2) {
      return {
        title: 'Localização Indisponível',
        description: 'Não foi possível determinar sua localização. Verifique se o GPS está ativado.',
        instructions: getGPSInstructions(),
      };
    }
    
    // Timeout
    if (errorCode === 3) {
      return {
        title: 'Tempo Esgotado',
        description: 'Demorou muito para obter sua localização. Tente novamente em um local com melhor sinal.',
        instructions: ['Vá para uma área aberta', 'Aguarde o GPS estabilizar', 'Tente novamente'],
      };
    }
    
    // Generic error
    return {
      title: 'Erro de Localização',
      description: 'Não foi possível obter sua localização.',
      instructions: getGenericInstructions(),
    };
  };

  const getPermissionInstructions = (): string[] => {
    if (isInAppBrowser) {
      return [
        '⚠️ Você está usando um navegador integrado',
        'Toque nos 3 pontos (...) no topo',
        'Selecione "Abrir no Safari" ou "Abrir no Chrome"',
        'Permita o acesso à localização quando solicitado',
      ];
    }
    
    if (isIOS) {
      return [
        'Abra Ajustes do iPhone',
        'Role até encontrar Safari (ou seu navegador)',
        'Toque em "Localização"',
        'Selecione "Permitir" ou "Ao Usar o App"',
        'Volte aqui e tente novamente',
      ];
    }
    
    if (isAndroid) {
      return [
        'Abra Configurações do Android',
        'Vá em "Apps" ou "Aplicativos"',
        'Encontre seu navegador (Chrome, etc)',
        'Toque em "Permissões" → "Localização"',
        'Selecione "Permitir"',
      ];
    }
    
    return [
      'Clique no ícone de cadeado na barra de endereço',
      'Encontre a opção "Localização"',
      'Selecione "Permitir"',
      'Recarregue a página',
    ];
  };

  const getGPSInstructions = (): string[] => {
    if (isIOS) {
      return [
        'Abra Ajustes → Privacidade → Serviços de Localização',
        'Verifique se está ATIVADO',
        'Role até Safari e verifique se está permitido',
      ];
    }
    
    if (isAndroid) {
      return [
        'Deslize de cima para baixo na tela',
        'Verifique se o ícone de Localização está ativado',
        'Se não, toque para ativar',
      ];
    }
    
    return [
      'Verifique se os serviços de localização estão ativados',
      'Certifique-se que seu dispositivo tem GPS',
    ];
  };

  const getGenericInstructions = (): string[] => {
    if (isInAppBrowser) {
      return [
        '📱 Você está em um navegador integrado',
        'Para melhor experiência, abra no Safari/Chrome',
        'Toque em ⋯ ou ⋮ e escolha "Abrir no navegador"',
      ];
    }
    
    return [
      'Verifique sua conexão com a internet',
      'Ative os serviços de localização',
      'Permita o acesso à localização para este site',
    ];
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-destructive/20 rounded-full flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-destructive" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{errorInfo.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{errorInfo.description}</p>
          
          {/* Instructions */}
          <div className="mt-4 bg-background/50 rounded-lg p-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {isIOS ? '📱 No iPhone:' : isAndroid ? '📱 No Android:' : '💻 No seu dispositivo:'}
            </h4>
            <ol className="space-y-1.5">
              {errorInfo.instructions.map((instruction, index) => (
                <li key={index} className="text-sm text-foreground flex gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{index + 1}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* In-App Browser Warning */}
          {isInAppBrowser && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-primary">
                <Smartphone className="w-4 h-4" />
                <span className="text-sm font-medium">Navegador Integrado Detectado</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Para melhor experiência, abra este link diretamente no Safari ou Chrome do seu celular.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Button 
              variant="default" 
              size="sm" 
              onClick={onRetry} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4 mr-2" />
              )}
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationErrorCard;
