/**
 * Hook to check feature access based on subscription tier
 * 
 * Features by tier:
 * 
 * SILVER ($8.99/mo):
 * - Truck-aware GPS navigation (height, weight, length)
 * - Safe routes for semi-trucks
 * - Truck-only POIs (truck stops, rest areas, weigh stations)
 * - Community ratings & reviews
 * - Near Me with truck-relevant locations
 * - Basic route alerts (closures & detours)
 * 
 * GOLD ($18.99/mo) - Everything in Silver, plus:
 * - Offline maps (full coverage)
 * - Real-time traffic updates
 * - Weather alerts for trucks (wind, snow, ice, rain)
 * - Smart stop suggestions (drive time & rest)
 * - Personalized food suggestions
 * - Convenience store fallback recommendations
 * - Complete route history
 * 
 * DIAMOND ($28.90/mo) - Everything in Gold, plus:
 * - Advanced map matching (stable cursor)
 * - Smart rerouting with minimal fluctuation
 * - Route comparison (shortest, safest, fewer stops)
 * - Trip reports (time, stops, usage patterns)
 * - Advanced POI ratings (photos & detailed reviews)
 * - Premium community access (exclusive rooms)
 * - Priority support
 */

import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTier } from '@/lib/subscriptionTiers';

// Feature definitions with required tier
export const FEATURES = {
  // Silver features (included in all plans)
  truckGpsNavigation: 'silver',
  safeRoutes: 'silver',
  truckPois: 'silver',
  communityRatings: 'silver',
  nearMe: 'silver',
  basicRouteAlerts: 'silver',
  
  // Gold features
  offlineMaps: 'gold',
  realTimeTraffic: 'gold',
  weatherAlerts: 'gold',
  smartStopSuggestions: 'gold',
  personalizedFoodSuggestions: 'gold',
  convenienceFallback: 'gold',
  routeHistory: 'gold',
  
  // Diamond features
  advancedMapMatching: 'diamond',
  smartRerouting: 'diamond',
  routeComparison: 'diamond',
  tripReports: 'diamond',
  advancedPoiRatings: 'diamond',
  premiumCommunity: 'diamond',
  prioritySupport: 'diamond',
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function useFeatureAccess() {
  const { tier, hasAccess, isLoading, isSubscribed } = useSubscription();
  
  /**
   * Check if user has access to a specific feature
   */
  const canAccess = (feature: FeatureKey): boolean => {
    const requiredTier = FEATURES[feature] as SubscriptionTier;
    return hasAccess(requiredTier);
  };
  
  /**
   * Get the required tier for a feature
   */
  const getRequiredTier = (feature: FeatureKey): Exclude<SubscriptionTier, 'none'> => {
    return FEATURES[feature] as Exclude<SubscriptionTier, 'none'>;
  };
  
  /**
   * Check if user needs to upgrade for a feature
   */
  const needsUpgradeFor = (feature: FeatureKey): boolean => {
    return !canAccess(feature);
  };
  
  return {
    tier,
    isLoading,
    isSubscribed,
    canAccess,
    getRequiredTier,
    needsUpgradeFor,
    // Convenience accessors for common feature groups
    hasGoldFeatures: hasAccess('gold'),
    hasDiamondFeatures: hasAccess('diamond'),
  };
}

// Feature name translations
export const FEATURE_NAMES = {
  en: {
    truckGpsNavigation: 'Truck GPS Navigation',
    safeRoutes: 'Safe Routes',
    truckPois: 'Truck POIs',
    communityRatings: 'Community Ratings',
    nearMe: 'Near Me',
    basicRouteAlerts: 'Basic Route Alerts',
    offlineMaps: 'Offline Maps',
    realTimeTraffic: 'Real-Time Traffic',
    weatherAlerts: 'Weather Alerts',
    smartStopSuggestions: 'Smart Stop Suggestions',
    personalizedFoodSuggestions: 'Personalized Food Suggestions',
    convenienceFallback: 'Convenience Store Recommendations',
    routeHistory: 'Route History',
    advancedMapMatching: 'Advanced Map Matching',
    smartRerouting: 'Smart Rerouting',
    routeComparison: 'Route Comparison',
    tripReports: 'Trip Reports',
    advancedPoiRatings: 'Advanced POI Ratings',
    premiumCommunity: 'Premium Community',
    prioritySupport: 'Priority Support',
  },
  pt: {
    truckGpsNavigation: 'Navegação GPS para Caminhões',
    safeRoutes: 'Rotas Seguras',
    truckPois: 'POIs para Caminhões',
    communityRatings: 'Avaliações da Comunidade',
    nearMe: 'Próximo de Mim',
    basicRouteAlerts: 'Alertas Básicos de Rota',
    offlineMaps: 'Mapas Offline',
    realTimeTraffic: 'Tráfego em Tempo Real',
    weatherAlerts: 'Alertas Climáticos',
    smartStopSuggestions: 'Sugestões Inteligentes de Parada',
    personalizedFoodSuggestions: 'Sugestões Personalizadas de Alimentação',
    convenienceFallback: 'Recomendações de Conveniência',
    routeHistory: 'Histórico de Rotas',
    advancedMapMatching: 'Map Matching Avançado',
    smartRerouting: 'Rerouting Inteligente',
    routeComparison: 'Comparação de Rotas',
    tripReports: 'Relatórios de Viagem',
    advancedPoiRatings: 'Avaliações Avançadas de POI',
    premiumCommunity: 'Comunidade Premium',
    prioritySupport: 'Suporte Prioritário',
  },
  es: {
    truckGpsNavigation: 'Navegación GPS para Camiones',
    safeRoutes: 'Rutas Seguras',
    truckPois: 'POIs para Camiones',
    communityRatings: 'Calificaciones de la Comunidad',
    nearMe: 'Cerca de Mí',
    basicRouteAlerts: 'Alertas Básicos de Ruta',
    offlineMaps: 'Mapas Sin Conexión',
    realTimeTraffic: 'Tráfico en Tiempo Real',
    weatherAlerts: 'Alertas Climáticos',
    smartStopSuggestions: 'Sugerencias Inteligentes de Parada',
    personalizedFoodSuggestions: 'Sugerencias Personalizadas de Comida',
    convenienceFallback: 'Recomendaciones de Tienda',
    routeHistory: 'Historial de Rutas',
    advancedMapMatching: 'Map Matching Avanzado',
    smartRerouting: 'Rerouting Inteligente',
    routeComparison: 'Comparación de Rutas',
    tripReports: 'Reportes de Viaje',
    advancedPoiRatings: 'Calificaciones Avanzadas de POI',
    premiumCommunity: 'Comunidad Premium',
    prioritySupport: 'Soporte Prioritario',
  },
} as const;
