import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Calendar, Edit2, Trash2, Loader2, ThumbsUp, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import EditPoiRatingModal from '@/components/poi/EditPoiRatingModal';

interface PoiFeedbackRecord {
  id: string;
  poi_id: string;
  poi_name: string;
  poi_type: string;
  friendliness_rating: number;
  cleanliness_rating: number;
  structure_rating: number | null;
  recommendation_rating: number;
  would_return: boolean | null;
  created_at: string;
}

interface StopRatingRecord {
  id: string;
  place_id: string;
  place_name: string;
  place_type: string;
  overall_rating: number;
  food_rating: number | null;
  bathroom_rating: number | null;
  parking_rating: number | null;
  safety_rating: number | null;
  comment: string | null;
  created_at: string;
}

const RatingHistory: React.FC = () => {
  const navigate = useNavigate();
  const [poiFeedback, setPoiFeedback] = useState<PoiFeedbackRecord[]>([]);
  const [stopRatings, setStopRatings] = useState<StopRatingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPoi, setEditingPoi] = useState<PoiFeedbackRecord | null>(null);
  const [activeTab, setActiveTab] = useState('poi');

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado para ver seu histórico');
        navigate('/auth');
        return;
      }

      // Fetch POI feedback
      const { data: poiData, error: poiError } = await supabase
        .from('poi_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (poiError) {
        console.error('Error fetching POI feedback:', poiError);
      } else {
        setPoiFeedback(poiData || []);
      }

      // Fetch stop ratings
      const { data: stopData, error: stopError } = await supabase
        .from('stop_ratings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (stopError) {
        console.error('Error fetching stop ratings:', stopError);
      } else {
        setStopRatings(stopData || []);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getPoiTypeLabel = (type: string) => {
    switch (type) {
      case 'fuel': return 'Posto';
      case 'truck_stop': return 'Truck Stop';
      case 'rest_area': return 'Área de Descanso';
      default: return type;
    }
  };

  const getPoiTypeColor = (type: string) => {
    switch (type) {
      case 'fuel': return 'bg-amber-500/20 text-amber-600';
      case 'truck_stop': return 'bg-blue-500/20 text-blue-600';
      case 'rest_area': return 'bg-green-500/20 text-green-600';
      default: return 'bg-gray-500/20 text-gray-600';
    }
  };

  const calculateAvgRating = (record: PoiFeedbackRecord) => {
    const ratings = [
      record.friendliness_rating,
      record.cleanliness_rating,
      record.recommendation_rating,
      record.structure_rating || 0,
    ].filter(r => r > 0);
    return ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '0';
  };

  const renderStars = (rating: number, max: number = 5) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < rating
                ? 'fill-yellow-500 text-yellow-500'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  const handleEditSave = async (updatedRating: Partial<PoiFeedbackRecord>) => {
    if (!editingPoi) return;

    try {
      const { error } = await supabase
        .from('poi_feedback')
        .update({
          friendliness_rating: updatedRating.friendliness_rating,
          cleanliness_rating: updatedRating.cleanliness_rating,
          structure_rating: updatedRating.structure_rating,
          recommendation_rating: updatedRating.recommendation_rating,
          would_return: updatedRating.would_return,
        })
        .eq('id', editingPoi.id);

      if (error) throw error;

      toast.success('Rating updated!');
      setEditingPoi(null);
      fetchRatings();
    } catch (err) {
      console.error('Error updating rating:', err);
      toast.error('Error updating rating');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRatings = poiFeedback.length + stopRatings.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="flex items-center gap-4 p-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">My Reviews</h1>
            <p className="text-sm text-muted-foreground">
              {totalRatings} review{totalRatings !== 1 ? 's' : ''} submitted
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{poiFeedback.length}</p>
            <p className="text-xs text-muted-foreground">POIs</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stopRatings.length}</p>
            <p className="text-xs text-muted-foreground">Stops</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {poiFeedback.filter(p => p.would_return).length}
            </p>
            <p className="text-xs text-muted-foreground">Would return</p>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="poi" className="gap-2">
            <MapPin className="w-4 h-4" />
            POIs ({poiFeedback.length})
          </TabsTrigger>
          <TabsTrigger value="stops" className="gap-2">
            <Star className="w-4 h-4" />
            Stops ({stopRatings.length})
          </TabsTrigger>
        </TabsList>

        {/* POI Feedback Tab */}
        <TabsContent value="poi" className="space-y-3">
          {poiFeedback.length === 0 ? (
            <Card className="p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                You haven't rated any POIs yet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Visit gas stations and truck stops to rate them
              </p>
            </Card>
          ) : (
            poiFeedback.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{record.poi_name}</h3>
                      <Badge variant="secondary" className={getPoiTypeColor(record.poi_type)}>
                        {getPoiTypeLabel(record.poi_type)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        <span className="font-bold">{calculateAvgRating(record)}</span>
                      </div>
                      {record.would_return && (
                        <Badge variant="outline" className="text-green-600 border-green-600/50">
                          <ThumbsUp className="w-3 h-3 mr-1" />
                           Would return
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Service:</span>
                        {renderStars(record.friendliness_rating)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cleanliness:</span>
                        {renderStars(record.cleanliness_rating)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Facilities:</span>
                        {renderStars(record.structure_rating || 0)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recommendation:</span>
                        {renderStars(record.recommendation_rating)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(record.created_at), "MMM d, yyyy", { locale: enUS })}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setEditingPoi(record)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Stop Ratings Tab */}
        <TabsContent value="stops" className="space-y-3">
          {stopRatings.length === 0 ? (
            <Card className="p-8 text-center">
              <Star className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                You haven't rated any stops yet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Rate stops along your route
              </p>
            </Card>
          ) : (
            stopRatings.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{record.place_name}</h3>
                      <Badge variant="secondary">{record.place_type}</Badge>
                    </div>

                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-bold">{record.overall_rating}</span>
                      <span className="text-muted-foreground">/ 5</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {record.food_rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Food:</span>
                          {renderStars(record.food_rating)}
                        </div>
                      )}
                      {record.bathroom_rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Restroom:</span>
                          {renderStars(record.bathroom_rating)}
                        </div>
                      )}
                      {record.parking_rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Parking:</span>
                          {renderStars(record.parking_rating)}
                        </div>
                      )}
                      {record.safety_rating && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Safety:</span>
                          {renderStars(record.safety_rating)}
                        </div>
                      )}
                    </div>

                    {record.comment && (
                      <p className="text-sm text-muted-foreground mt-2 italic line-clamp-2">
                        "{record.comment}"
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(record.created_at), "MMM d, yyyy", { locale: enUS })}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      {editingPoi && (
        <EditPoiRatingModal
          rating={editingPoi}
          onSave={handleEditSave}
          onCancel={() => setEditingPoi(null)}
        />
      )}
    </div>
  );
};

export default RatingHistory;
