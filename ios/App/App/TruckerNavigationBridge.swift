import Foundation
import Capacitor
import CoreLocation

/**
 * TruckerNavigationBridge
 * 
 * Capacitor plugin that bridges native TruckerLocationEngine to JavaScript.
 * This is the ONLY source of truth for GPS data in the app.
 * 
 * Events emitted:
 * - nativeLocationUpdate: Real-time position updates
 * - nativeRouteProgress: Navigation progress updates  
 * - nativeRerouteRequired: When reroute is needed
 * - nativeDebugLog: Debug messages
 */

@objc(TruckerNavigationBridge)
public class TruckerNavigationBridge: CAPPlugin, TruckerLocationEngineDelegate {
    
    // MARK: - Properties
    
    private var locationEngine: TruckerLocationEngine?
    private var isNavigating = false
    private var debugLogBuffer: [String] = []
    private let maxDebugLogs = 100
    
    // MARK: - Plugin Lifecycle
    
    public override func load() {
        super.load()
        print("[TruckerNavigationBridge] Plugin loaded - Native GPS is source of truth")
    }
    
    // MARK: - Plugin Methods
    
    @objc func initialize(_ call: CAPPluginCall) {
        // Parse config from JS
        let config = parseConfig(from: call)
        
        locationEngine = TruckerLocationEngine(config: config)
        locationEngine?.delegate = self
        
        print("[TruckerNavigationBridge] Initialized with config")
        call.resolve(["success": true, "source": "native_ios"])
    }
    
    @objc func startLocationUpdates(_ call: CAPPluginCall) {
        guard let engine = locationEngine else {
            call.reject("Engine not initialized. Call initialize first.")
            return
        }
        
        engine.requestPermissions()
        engine.startUpdates()
        
        call.resolve(["success": true])
    }
    
    @objc func stopLocationUpdates(_ call: CAPPluginCall) {
        locationEngine?.stopUpdates()
        call.resolve(["success": true])
    }
    
    @objc func setRoute(_ call: CAPPluginCall) {
        guard let engine = locationEngine else {
            call.reject("Engine not initialized")
            return
        }
        
        guard let polyline = call.getArray("polyline") as? [[String: Double]] else {
            call.reject("Missing or invalid polyline")
            return
        }
        
        let coordinates = polyline.compactMap { point -> CLLocationCoordinate2D? in
            guard let lat = point["lat"], let lng = point["lng"] else { return nil }
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        
        engine.setRoutePolyline(coordinates)
        isNavigating = true
        
        call.resolve([
            "success": true,
            "pointCount": coordinates.count
        ])
    }
    
    @objc func clearRoute(_ call: CAPPluginCall) {
        locationEngine?.clearRoute()
        isNavigating = false
        call.resolve(["success": true])
    }
    
    @objc func updateConfig(_ call: CAPPluginCall) {
        guard let engine = locationEngine else {
            call.reject("Engine not initialized")
            return
        }
        
        let config = parseConfig(from: call)
        engine.updateConfig(config)
        
        call.resolve(["success": true])
    }
    
    @objc func getStatistics(_ call: CAPPluginCall) {
        guard let engine = locationEngine else {
            call.reject("Engine not initialized")
            return
        }
        
        let stats = engine.getStatistics()
        call.resolve(stats as PluginCallResultData)
    }
    
    @objc func getDebugLogs(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 50
        let logs = Array(debugLogBuffer.suffix(limit))
        call.resolve(["logs": logs])
    }
    
    @objc func requestPermissions(_ call: CAPPluginCall) {
        locationEngine?.requestPermissions()
        call.resolve(["success": true])
    }
    
    // MARK: - TruckerLocationEngineDelegate
    
    func locationEngine(_ engine: TruckerLocationEngine, didUpdate location: TruckerLocationUpdate) {
        // Use snapped position if available and on route, otherwise use filtered
        let displayLat = location.isOnRoute ? (location.snappedLatitude ?? location.smoothedLatitude) : location.smoothedLatitude
        let displayLng = location.isOnRoute ? (location.snappedLongitude ?? location.smoothedLongitude) : location.smoothedLongitude
        
        let payload: [String: Any] = [
            // Primary display values (what UI should use)
            "latitude": displayLat,
            "longitude": displayLng,
            "heading": location.smoothedHeading,
            "speed": location.smoothedSpeed,
            "speedMph": location.speedMph,
            "speedKph": location.speedKph,
            
            // Raw values (for debug)
            "rawLatitude": location.rawLatitude,
            "rawLongitude": location.rawLongitude,
            "rawSpeed": location.rawSpeed,
            "rawCourse": location.rawCourse,
            "rawAccuracy": location.rawAccuracy,
            
            // Filtered values
            "filteredLatitude": location.smoothedLatitude,
            "filteredLongitude": location.smoothedLongitude,
            
            // Snapped values (only when route active)
            "snappedLatitude": location.snappedLatitude ?? NSNull(),
            "snappedLongitude": location.snappedLongitude ?? NSNull(),
            "snapOffsetMeters": location.snapOffsetMeters ?? NSNull(),
            "distanceToRouteMeters": location.distanceToRouteMeters ?? NSNull(),
            
            // Status
            "isOnRoute": location.isOnRoute,
            "isStale": location.isStale,
            "isRejected": location.isRejected,
            "rejectionReason": location.rejectionReason ?? NSNull(),
            
            // Timing
            "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
            "updateFrequencyHz": location.updateFrequencyHz,
            "timeSinceLastUpdateMs": location.timeSinceLastUpdateMs,
            
            // Source indicator
            "source": "native_ios"
        ]
        
        notifyListeners("nativeLocationUpdate", data: payload as [String: Any])
    }
    
    func locationEngine(_ engine: TruckerLocationEngine, didDetectOffRoute distance: Double, duration: Double) {
        notifyListeners("nativeOffRouteDetected", data: [
            "distanceMeters": distance,
            "durationSeconds": duration
        ])
    }
    
    func locationEngine(_ engine: TruckerLocationEngine, didRequestReroute reason: String) {
        notifyListeners("nativeRerouteRequired", data: [
            "reason": reason,
            "timestamp": Date().timeIntervalSince1970 * 1000
        ])
    }
    
    func locationEngine(_ engine: TruckerLocationEngine, didLogDebug message: String) {
        let logEntry = "[\(ISO8601DateFormatter().string(from: Date()))] \(message)"
        debugLogBuffer.append(logEntry)
        
        // Keep buffer size limited
        if debugLogBuffer.count > maxDebugLogs {
            debugLogBuffer.removeFirst()
        }
        
        notifyListeners("nativeDebugLog", data: ["message": logEntry])
    }
    
    // MARK: - Private Methods
    
    private func parseConfig(from call: CAPPluginCall) -> TruckerLocationConfig {
        var config = TruckerLocationConfig()
        
        // CoreLocation
        if let distanceFilter = call.getDouble("distanceFilter") {
            config.distanceFilter = distanceFilter
        }
        
        // Kalman
        if let kalmanQ = call.getDouble("kalmanQ") {
            config.kalmanQ = kalmanQ
        }
        if let kalmanR = call.getDouble("kalmanR") {
            config.kalmanR = kalmanR
        }
        
        // Speed
        if let speedSmoothingSamples = call.getInt("speedSmoothingSamples") {
            config.speedSmoothingSamples = speedSmoothingSamples
        }
        if let minSpeedThreshold = call.getDouble("minSpeedThreshold") {
            config.minSpeedThreshold = minSpeedThreshold
        }
        
        // Heading
        if let headingLerpFactor = call.getDouble("headingLerpFactor") {
            config.headingLerpFactor = headingLerpFactor
        }
        if let minSpeedForHeading = call.getDouble("minSpeedForHeading") {
            config.minSpeedForHeading = minSpeedForHeading
        }
        
        // Snap/Route
        if let snapThreshold = call.getDouble("snapThresholdMeters") {
            config.snapThresholdMeters = snapThreshold
        }
        if let offRouteThreshold = call.getDouble("offRouteThresholdMeters") {
            config.offRouteThresholdMeters = offRouteThreshold
        }
        if let offRouteDuration = call.getDouble("offRouteDurationSeconds") {
            config.offRouteDurationSeconds = offRouteDuration
        }
        
        // Teleport
        if let maxJump = call.getDouble("maxPositionJumpMeters") {
            config.maxPositionJumpMeters = maxJump
        }
        
        // Debug
        if let enableDebug = call.getBool("enableDebugLogging") {
            config.enableDebugLogging = enableDebug
        }
        
        return config
    }
}
