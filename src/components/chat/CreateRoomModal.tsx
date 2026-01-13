import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Globe, MapPin, Truck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';
import { useChatContext } from '@/contexts/ChatContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { id: 'all', label: 'Todos os idiomas', flag: '🌍' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
];

const REGIONS = [
  { id: 'all', label: 'Todas as regiões' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'southeast', label: 'Southeast' },
  { id: 'midwest', label: 'Midwest' },
  { id: 'southwest', label: 'Southwest' },
  { id: 'west', label: 'West Coast' },
];

const TRAILER_TYPES = [
  { id: 'all', label: 'Todos os tipos' },
  { id: 'dry_van', label: 'Dry Van' },
  { id: 'reefer', label: 'Reefer' },
  { id: 'flatbed', label: 'Flatbed' },
  { id: 'tanker', label: 'Tanker' },
];

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { refreshMyRooms, currentUserId } = useChatContext();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('all');
  const [region, setRegion] = useState('all');
  const [trailerType, setTrailerType] = useState('all');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para a sala.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUserId) {
      toast({
        title: 'Login necessário',
        description: 'Você precisa estar logado para criar uma sala.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setIsCreating(true);

    try {
      // Create the room
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          language,
          region,
          trailer_type: trailerType,
          created_by: currentUserId,
          icon: '💬',
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Auto-join the room
      const { error: joinError } = await supabase
        .from('chat_room_members')
        .insert({
          room_id: room.id,
          user_id: currentUserId,
          nickname: 'Admin',
        });

      if (joinError) throw joinError;

      await refreshMyRooms();

      toast({
        title: 'Sala criada!',
        description: `"${room.name}" foi criada com sucesso.`,
      });

      onClose();
      navigate(`/chat/${room.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a sala.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Criar Nova Sala</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Nome da sala *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Motoristas de Reefer"
              className="w-full h-12 px-4 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={50}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sobre o que é essa sala..."
              className="w-full h-20 p-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              maxLength={200}
            />
          </div>

          {/* Language */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Idioma
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    language === lang.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/50'
                  }`}
                >
                  <span className="mr-2">{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Região
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full h-12 px-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Trailer Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Tipo de Carreta
            </label>
            <select
              value={trailerType}
              onChange={(e) => setTrailerType(e.target.value)}
              className="w-full h-12 px-4 bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TRAILER_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4">
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar e Entrar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;
