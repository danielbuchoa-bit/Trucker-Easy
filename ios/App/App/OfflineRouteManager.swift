import Foundation
import MapboxNavigation
import MapboxCoreNavigation

/**
 * Offline Route Manager
 * 
 * Handles downloading and caching of map tiles along the route corridor
 * for offline navigation capability. Uses 10km radius around route.
 */
class OfflineRouteManager {
    
    // MARK: - Properties
    
    private let CACHE_RADIUS_KM: Double = 10.0
    private let MIN_ZOOM: UInt8 = 8
    private let MAX_ZOOM: UInt8 = 16
    
    // Download state
    private var isDownloading = false
    private var downloadProgress: Double = 0.0
    private var downloadedMegabytes: Double = 0.0
    
    // Callbacks
    var onProgressUpdate: ((Double) -> Void)?
    var onDownloadComplete: ((Bool, Double) -> Void)?
    
    // MARK: - Public Methods
    
    /// Download offline tiles for a route with 10km corridor
    func downloadRouteCorridorTiles(route: Route, completion: @escaping (Bool, Double) -> Void) {
        guard !isDownloading else {
            print("[OfflineManager] Download already in progress")
            return
        }
        
        isDownloading = true
        downloadProgress = 0.0
        downloadedMegabytes = 0.0
        
        // Get route bounding box
        guard let shape = route.shape,
              let bounds = calculateBoundsWithBuffer(coordinates: shape.coordinates) else {
            completion(false, 0.0)
            isDownloading = false
            return
        }
        
        print("[OfflineManager] Starting download for route corridor")
        print("[OfflineManager] Bounds: SW(\(bounds.southWest.latitude), \(bounds.southWest.longitude)) NE(\(bounds.northEast.latitude), \(bounds.northEast.longitude))")
        
        // Create offline region definition
        // Note: This uses Mapbox's Offline API - implementation depends on SDK version
        
        // Simulate download for demonstration
        // In production, use MapboxOffline or TileStore APIs
        simulateDownload(bounds: bounds) { success, megabytes in
            self.isDownloading = false
            completion(success, megabytes)
        }
    }
    
    /// Cancel ongoing download
    func cancelDownload() {
        if isDownloading {
            isDownloading = false
            print("[OfflineManager] Download cancelled")
        }
    }
    
    /// Get current download progress (0.0 - 1.0)
    func getProgress() -> Double {
        return downloadProgress
    }
    
    /// Check if route area is cached
    func isRouteCached(route: Route) -> Bool {
        // Check if tiles exist for this route
        // Implementation depends on Mapbox SDK caching APIs
        return false
    }
    
    /// Clear all cached tiles
    func clearCache() {
        print("[OfflineManager] Clearing tile cache")
        // Clear Mapbox tile cache
    }
    
    // MARK: - Private Methods
    
    private func calculateBoundsWithBuffer(coordinates: [CLLocationCoordinate2D]) -> (southWest: CLLocationCoordinate2D, northEast: CLLocationCoordinate2D)? {
        guard !coordinates.isEmpty else { return nil }
        
        var minLat = coordinates[0].latitude
        var maxLat = coordinates[0].latitude
        var minLng = coordinates[0].longitude
        var maxLng = coordinates[0].longitude
        
        for coord in coordinates {
            minLat = min(minLat, coord.latitude)
            maxLat = max(maxLat, coord.latitude)
            minLng = min(minLng, coord.longitude)
            maxLng = max(maxLng, coord.longitude)
        }
        
        // Add 10km buffer (approximately 0.09 degrees at mid-latitudes)
        let bufferDegrees = CACHE_RADIUS_KM / 111.0
        
        let southWest = CLLocationCoordinate2D(
            latitude: minLat - bufferDegrees,
            longitude: minLng - bufferDegrees
        )
        
        let northEast = CLLocationCoordinate2D(
            latitude: maxLat + bufferDegrees,
            longitude: maxLng + bufferDegrees
        )
        
        return (southWest, northEast)
    }
    
    private func simulateDownload(bounds: (southWest: CLLocationCoordinate2D, northEast: CLLocationCoordinate2D), completion: @escaping (Bool, Double) -> Void) {
        // Simulate progressive download
        let totalSteps = 20
        var currentStep = 0
        
        Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { timer in
            currentStep += 1
            self.downloadProgress = Double(currentStep) / Double(totalSteps)
            self.downloadedMegabytes = self.downloadProgress * 50.0 // ~50MB for typical route
            
            self.onProgressUpdate?(self.downloadProgress)
            
            if currentStep >= totalSteps {
                timer.invalidate()
                print("[OfflineManager] Download complete: \(String(format: "%.1f", self.downloadedMegabytes))MB")
                completion(true, self.downloadedMegabytes)
            }
        }
    }
}
