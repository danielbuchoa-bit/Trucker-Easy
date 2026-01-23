/**
 * HereService Compatibility Layer
 * 
 * This file re-exports everything from NextBillionService for backwards compatibility.
 * All geocoding, POI search, and routing is now handled by NextBillion.ai APIs.
 */
export * from './NextBillionService';
export { NextBillionService as HereService } from './NextBillionService';
