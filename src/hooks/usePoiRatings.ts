import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PoiRating {
  poi_id: string;
  poi_name: string;
  poi_type: string;
  review_count: number;
  avg_friendliness: number;
  avg_cleanliness: number;
  avg_structure: number;
  avg_recommendation: number;
  avg_overall: number;
  would_return_pct: number;
}

interface UsePoiRatingsReturn {
  ratings: Map<string, PoiRating>;
  fetchRatingForPoi: (poiId: string) => Promise<PoiRating | null>;
  fetchRatingsForPois: (poiIds: string[]) => Promise<void>;
  isLoading: boolean;
}

export const usePoiRatings = (): UsePoiRatingsReturn => {
  const [ratings, setRatings] = useState<Map<string, PoiRating>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const fetchedIds = useRef<Set<string>>(new Set());

  const fetchRatingForPoi = useCallback(async (poiId: string): Promise<PoiRating | null> => {
    if (fetchedIds.current.has(poiId)) {
      // Return from current state via ref pattern
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('poi_feedback')
        .select('*')
        .eq('poi_id', poiId);

      if (error || !data || data.length === 0) {
        fetchedIds.current.add(poiId);
        return null;
      }

      // Calculate aggregates manually since we can't query views directly
      const count = data.length;
      const avgFriendliness = data.reduce((sum, r) => sum + r.friendliness_rating, 0) / count;
      const avgCleanliness = data.reduce((sum, r) => sum + r.cleanliness_rating, 0) / count;
      const avgStructure = data.reduce((sum, r) => sum + (r.structure_rating || 0), 0) / count;
      const avgRecommendation = data.reduce((sum, r) => sum + r.recommendation_rating, 0) / count;
      const avgOverall = (avgFriendliness + avgCleanliness + avgStructure + avgRecommendation) / 4;
      const wouldReturnCount = data.filter((r) => r.would_return).length;
      const wouldReturnPct = (wouldReturnCount / count) * 100;

      const rating: PoiRating = {
        poi_id: poiId,
        poi_name: data[0].poi_name,
        poi_type: data[0].poi_type,
        review_count: count,
        avg_friendliness: Math.round(avgFriendliness * 10) / 10,
        avg_cleanliness: Math.round(avgCleanliness * 10) / 10,
        avg_structure: Math.round(avgStructure * 10) / 10,
        avg_recommendation: Math.round(avgRecommendation * 10) / 10,
        avg_overall: Math.round(avgOverall * 10) / 10,
        would_return_pct: Math.round(wouldReturnPct),
      };

      fetchedIds.current.add(poiId);
      setRatings((prev) => new Map(prev).set(poiId, rating));
      return rating;
    } catch (err) {
      console.error('[usePoiRatings] Error fetching rating:', err);
      return null;
    }
  }, []); // No dependencies - stable reference

  const fetchRatingsForPois = useCallback(async (poiIds: string[]): Promise<void> => {
    const newIds = poiIds.filter((id) => !fetchedIds.current.has(id));
    if (newIds.length === 0) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('poi_feedback')
        .select('*')
        .in('poi_id', newIds);

      if (error || !data) {
        newIds.forEach((id) => fetchedIds.current.add(id));
        setIsLoading(false);
        return;
      }

      // Group by poi_id
      const grouped = new Map<string, typeof data>();
      data.forEach((record) => {
        const existing = grouped.get(record.poi_id) || [];
        existing.push(record);
        grouped.set(record.poi_id, existing);
      });

      setRatings((prevRatings) => {
        const newRatings = new Map(prevRatings);
        
        grouped.forEach((records, poiId) => {
          const count = records.length;
          const avgFriendliness = records.reduce((sum, r) => sum + r.friendliness_rating, 0) / count;
          const avgCleanliness = records.reduce((sum, r) => sum + r.cleanliness_rating, 0) / count;
          const avgStructure = records.reduce((sum, r) => sum + (r.structure_rating || 0), 0) / count;
          const avgRecommendation = records.reduce((sum, r) => sum + r.recommendation_rating, 0) / count;
          const avgOverall = (avgFriendliness + avgCleanliness + avgStructure + avgRecommendation) / 4;
          const wouldReturnCount = records.filter((r) => r.would_return).length;
          const wouldReturnPct = (wouldReturnCount / count) * 100;

          const rating: PoiRating = {
            poi_id: poiId,
            poi_name: records[0].poi_name,
            poi_type: records[0].poi_type,
            review_count: count,
            avg_friendliness: Math.round(avgFriendliness * 10) / 10,
            avg_cleanliness: Math.round(avgCleanliness * 10) / 10,
            avg_structure: Math.round(avgStructure * 10) / 10,
            avg_recommendation: Math.round(avgRecommendation * 10) / 10,
            avg_overall: Math.round(avgOverall * 10) / 10,
            would_return_pct: Math.round(wouldReturnPct),
          };

          newRatings.set(poiId, rating);
          fetchedIds.current.add(poiId);
        });

        // Mark unfound IDs as fetched
        newIds.forEach((id) => fetchedIds.current.add(id));

        return newRatings;
      });
    } catch (err) {
      console.error('[usePoiRatings] Error fetching ratings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - stable reference

  return { ratings, fetchRatingForPoi, fetchRatingsForPois, isLoading };
};
