import { useState } from 'react';
import { X, User, Loader2 } from 'lucide-react';

interface NicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nickname: string) => Promise<void>;
  roomName: string;
}

const NicknameModal = ({ isOpen, onClose, onSubmit, roomName }: NicknameModalProps) => {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!nickname.trim()) return;
    
    setLoading(true);
    try {
      await onSubmit(nickname.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Entrar na Sala</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <p className="text-sm text-muted-foreground text-center">
            Escolha um apelido para ser identificado na sala <span className="font-medium text-foreground">"{roomName}"</span>
          </p>

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Seu apelido..."
              maxLength={30}
              className="w-full h-12 pl-12 pr-4 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            O apelido será visível para outros membros da sala
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!nickname.trim() || loading}
            className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NicknameModal;
