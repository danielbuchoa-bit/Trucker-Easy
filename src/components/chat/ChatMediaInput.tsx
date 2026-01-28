import React, { useState, useRef } from 'react';
import { Image, MapPin, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMediaInputProps {
  onImageSelected: (url: string) => void;
  onLocationSelected: (lat: number, lng: number, name: string) => void;
  disabled?: boolean;
}

const ChatMediaInput: React.FC<ChatMediaInputProps> = ({
  onImageSelected,
  onLocationSelected,
  disabled
}) => {
  const [uploading, setUploading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Apenas JPG, PNG, GIF e WebP são permitidos.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(data.path);

      onImageSelected(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLocationClick = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Não suportado',
        description: 'Seu navegador não suporta geolocalização.',
        variant: 'destructive',
      });
      return;
    }

    setGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Try to get location name using reverse geocoding
      let locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      
      try {
        const response = await supabase.functions.invoke('nb_reverse_geocode', {
          body: { lat: latitude, lng: longitude }
        });
        
        if (response.data?.address?.label) {
          locationName = response.data.address.label;
        }
      } catch (geoError) {
        console.log('Reverse geocoding failed, using coordinates');
      }

      onLocationSelected(latitude, longitude, locationName);
    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: 'Erro de localização',
        description: 'Não foi possível obter sua localização.',
        variant: 'destructive',
      });
    } finally {
      setGettingLocation(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <button
        onClick={handleImageClick}
        disabled={disabled || uploading}
        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors disabled:opacity-50"
        title="Enviar foto"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Image className="w-5 h-5" />
        )}
      </button>

      <button
        onClick={handleLocationClick}
        disabled={disabled || gettingLocation}
        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors disabled:opacity-50"
        title="Enviar localização"
      >
        {gettingLocation ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <MapPin className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

export default ChatMediaInput;
