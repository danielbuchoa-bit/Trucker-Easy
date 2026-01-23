import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Globe, MapPin, Truck, Loader2, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';
import { useChatContext } from '@/contexts/ChatContext';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { id: 'all', label: 'All Languages', flag: '🌍' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
];

const REGIONS = [
  { id: 'all', label: 'All Regions' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'southeast', label: 'Southeast' },
  { id: 'midwest', label: 'Midwest' },
  { id: 'southwest', label: 'Southwest' },
  { id: 'west', label: 'West Coast' },
];

const TRAILER_TYPES = [
  { id: 'all', label: 'All Types' },
  { id: 'dry_van', label: 'Dry Van' },
  { id: 'reefer', label: 'Reefer' },
  { id: 'flatbed', label: 'Flatbed' },
  { id: 'tanker', label: 'Tanker' },
];

const ROOM_ICONS = ['💬', '🚛', '🛣️', '⛽', '🏠', '🌍', '🔧', '💪', '🎯', '⚡'];

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
  const [icon, setIcon] = useState('💬');
  const [isCreating, setIsCreating] = useState(false);
  const [recentRoomsCount, setRecentRoomsCount] = useState(0);
  const [isCheckingSpam, setIsCheckingSpam] = useState(true);

  // Anti-spam: Check how many rooms user created in last hour
  useEffect(() => {
    const checkRecentRooms = async () => {
      if (!currentUserId || !isOpen) {
        setIsCheckingSpam(false);
        return;
      }
      
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase
          .from('chat_rooms')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', currentUserId)
          .gte('created_at', oneHourAgo);

        if (!error) {
          setRecentRoomsCount(count || 0);
          console.log('[CreateRoom] Recent rooms by user:', count);
        }
      } catch (err) {
        console.error('[CreateRoom] Spam check error:', err);
      } finally {
        setIsCheckingSpam(false);
      }
    };

    checkRecentRooms();
  }, [currentUserId, isOpen]);

  if (!isOpen) return null;

  // Max rooms per hour for anti-spam
  const MAX_ROOMS_PER_HOUR = 3;
  const canCreateRoom = recentRoomsCount < MAX_ROOMS_PER_HOUR;

  const handleCreate = async () => {
    // Validation: name required
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the room.',
        variant: 'destructive',
      });
      return;
    }

    // Validation: name length
    if (name.trim().length > 50) {
      toast({
        title: 'Name too long',
        description: 'Room name must be 50 characters or less.',
        variant: 'destructive',
      });
      return;
    }

    // Validation: auth required
    if (!currentUserId) {
      toast({
        title: 'Login required',
        description: 'You need to be logged in to create a room.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    // Anti-spam check
    if (!canCreateRoom) {
      toast({
        title: 'Too many rooms created',
        description: `You can only create ${MAX_ROOMS_PER_HOUR} rooms per hour. Please wait.`,
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      console.log('[CreateRoom] Creating room:', { name: name.trim(), language, region, trailerType, icon });
      
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
          icon,
        })
        .select()
        .single();

      if (roomError) {
        console.error('[CreateRoom] Room creation error:', roomError);
        throw roomError;
      }
      
      console.log('[CreateRoom] Room created:', room.id, room.name);

      // Auto-join the room as creator
      const { error: joinError } = await supabase
        .from('chat_room_members')
        .insert({
          room_id: room.id,
          user_id: currentUserId,
          nickname: 'Creator',
        });

      if (joinError) {
        console.error('[CreateRoom] Join error:', joinError);
        throw joinError;
      }
      
      console.log('[CreateRoom] Joined room as creator');

      await refreshMyRooms();

      toast({
        title: 'Room created!',
        description: `"${room.name}" is ready. You are the creator.`,
      });

      // Reset form
      setName('');
      setDescription('');
      setIcon('💬');
      setLanguage('all');
      setRegion('all');
      setTrailerType('all');
      
      onClose();
      navigate(`/chat/${room.id}`);
    } catch (error) {
      console.error('[CreateRoom] Error:', error);
      toast({
        title: 'Error',
        description: 'Could not create room. Please try again.',
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
          <h2 className="text-lg font-semibold text-foreground">Create New Room</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Anti-spam warning */}
        {!canCreateRoom && (
          <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Room limit reached</p>
              <p className="text-xs text-muted-foreground">You've created {recentRoomsCount} rooms in the last hour. Please wait before creating more.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Icon Selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Room Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {ROOM_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 text-xl rounded-xl border transition-all ${
                    icon === emoji
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Room Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Reefer Drivers, Northeast Truckers"
              className="w-full h-12 px-4 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground mt-1">{name.length}/50 characters</p>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this room about..."
              className="w-full h-20 p-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              maxLength={200}
            />
          </div>

          {/* Language */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Language
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
              Region
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
              Trailer Type
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
        <div className="sticky bottom-0 bg-background border-t border-border p-4 space-y-2">
          {/* Creator Badge Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mb-2">
            <User className="w-3.5 h-3.5" />
            <span>You'll be marked as the room creator</span>
          </div>
          
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || !canCreateRoom || isCheckingSpam}
            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCheckingSpam ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Checking...
              </>
            ) : isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create & Enter Room'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;
