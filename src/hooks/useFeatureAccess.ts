/**
 * Hook to check feature access based on subscription
 * All features require PRO plan ($19.99/mo or $179.99/yr)
 */

import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionTier } from '@/lib/subscriptionTiers';

// All features require PRO
export const FEATURES = {
  truckGpsNavigation: 'pro',
  safeRoutes: 'pro',
  truckPois: 'pro',
  communityRatings: 'pro',
  nearMe: 'pro',
  basicRouteAlerts: 'pro',
  offlineMaps: 'pro',
  realTimeTraffic: 'pro',
  weatherAlerts: 'pro',
  smartStopSuggestions: 'pro',
  personalizedFoodSuggestions: 'pro',
  convenienceFallback: 'pro',
  routeHistory: 'pro',
  advancedMapMatching: 'pro',
  smartRerouting: 'pro',
  routeComparison: 'pro',
  tripReports: 'pro',
  advancedPoiRatings: 'pro',
  premiumCommunity: 'pro',
  prioritySupport: 'pro',
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function useFeatureAccess() {
  const { tier, hasAccess, isLoading, isSubscribed } = useSubscription();
  
  const canAccess = (feature: FeatureKey): boolean => {
    return hasAccess('pro');
  };
  
  const getRequiredTier = (_feature: FeatureKey): Exclude<SubscriptionTier, 'none'> => {
    return 'pro';
  };
  
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
    hasProAccess: hasAccess('pro'),
    // Legacy compat
    hasGoldFeatures: hasAccess('pro'),
    hasDiamondFeatures: hasAccess('pro'),
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
