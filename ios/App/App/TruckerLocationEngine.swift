import Foundation
import CoreLocation
import Accelerate

/**
 * TruckerLocationEngine
 * 
 * High-precision location engine for truck navigation with:
 * - Kalman filter for GPS smoothing
 * - Speed smoothing (moving average)
 * - Heading interpolation (lerp)
 * - Stale update detection
 * - Map matching / snap-to-road
 * - Configurable thresholds
 */

// MARK: - Configuration

struct TruckerLocationConfig {
    // CoreLocation settings
    var desiredAccuracy: CLLocationAccuracy = kCLLocationAccuracyBestForNavigation
    var distanceFilter: CLLocationDistance = 5.0 // meters
    var activityType: CLActivityType = .automotiveNavigation
    
    // Update frequency
    var minUpdateIntervalMs: Double = 200 // 5Hz max
    var maxStaleUpdateMs: Double = 2000 // 2 seconds
    
    // Kalman filter
    var kalmanQ: Double = 0.00001 // Process noise
    var kalmanR: Double = 0.01 // Measurement noise
    
    // Speed smoothing
    var speedSmoothingSamples: Int = 5
    var minSpeedThreshold: Double = 0.5 // m/s - below this show 0
    var maxReasonableSpeed: Double = 45.0 // m/s (~100 mph) - reject above
    
    // Heading
    var headingLerpFactor: Double = 0.15
    var minSpeedForHeading: Double = 2.0 // m/s - use course only above this
    
    // Snap-to-road
    var snapThresholdMeters: Double = 25.0 // snap if within this distance
    var offRouteThresholdMeters: Double = 50.0 // highway default
    var offRouteDurationSeconds: Double = 4.0 // time before reroute
    
    // Teleport prevention
    var maxPositionJumpMeters: Double = 100.0 // reject jumps larger than this
    var maxAccelerationMps2: Double = 5.0 // ~0.5g max acceleration
    
    // Debug
    var enableDebugLogging: Bool = true
    
    static let highway = TruckerLocationConfig()
    
    static var city: TruckerLocationConfig {
        var config = TruckerLocationConfig()
        config.offRouteThresholdMeters = 25.0
        config.snapThresholdMeters = 15.0
        return config
    }
}

// MARK: - Kalman Filter

class KalmanFilter1D {
    private var q: Double // Process noise
    private var r: Double // Measurement noise
    private var x: Double // State estimate
    private var p: Double // Error covariance
    private var k: Double // Kalman gain
    
    init(q: Double = 0.00001, r: Double = 0.01, initialValue: Double = 0) {
        self.q = q
        self.r = r
        self.x = initialValue
        self.p = 1.0
        self.k = 0
    }
    
    func update(measurement: Double) -> Double {
        // Prediction
        p = p + q
        
        // Update
        k = p / (p + r)
        x = x + k * (measurement - x)
        p = (1 - k) * p
        
        return x
    }
    
    func reset(value: Double) {
        x = value
        p = 1.0
    }
    
    var currentValue: Double { x }
}

// MARK: - Location Data

struct TruckerLocationUpdate {
    // Raw GPS data
    let rawLatitude: Double
    let rawLongitude: Double
    let rawSpeed: Double
    let rawCourse: Double
    let rawAccuracy: Double
    let timestamp: Date
    
    // Filtered/smoothed data
    let smoothedLatitude: Double
    let smoothedLongitude: Double
    let smoothedSpeed: Double
    let smoothedHeading: Double
    
    // Snapped data (if route active)
    var snappedLatitude: Double?
    var snappedLongitude: Double?
    var snapOffsetMeters: Double?
    var distanceToRouteMeters: Double?
    var isOnRoute: Bool
    
    // Derived
    let speedMph: Double
    let speedKph: Double
    
    // Status flags
    let isStale: Bool
    let isRejected: Bool
    let rejectionReason: String?
    
    // Debug
    let updateFrequencyHz: Double
    let timeSinceLastUpdateMs: Double
}

// MARK: - Route Segment for Snapping

struct RouteSegment {
    let startLat: Double
    let startLng: Double
    let endLat: Double
    let endLng: Double
    let bearing: Double
}

// MARK: - Location Engine Delegate

protocol TruckerLocationEngineDelegate: AnyObject {
    func locationEngine(_ engine: TruckerLocationEngine, didUpdate location: TruckerLocationUpdate)
    func locationEngine(_ engine: TruckerLocationEngine, didDetectOffRoute distance: Double, duration: Double)
    func locationEngine(_ engine: TruckerLocationEngine, didRequestReroute reason: String)
    func locationEngine(_ engine: TruckerLocationEngine, didLogDebug message: String)
}

// MARK: - Location Engine

class TruckerLocationEngine: NSObject, CLLocationManagerDelegate {
    
    // MARK: - Properties
    
    private let locationManager = CLLocationManager()
    private var config: TruckerLocationConfig
    weak var delegate: TruckerLocationEngineDelegate?
    
    // Kalman filters for lat/lng
    private var latKalman: KalmanFilter1D
    private var lngKalman: KalmanFilter1D
    
    // Speed smoothing buffer
    private var speedBuffer: [Double] = []
    
    // Heading lerp
    private var currentHeading: Double = 0
    private var lastValidHeading: Double = 0
    
    // Last valid location
    private var lastValidLocation: CLLocation?
    private var lastUpdateTime: Date?
    private var updateCount: Int = 0
    
    // Off-route tracking
    private var offRouteStartTime: Date?
    private var isCurrentlyOffRoute = false
    private var rerouteCount = 0
    private var lastRerouteTime: Date?
    
    // Route data for snapping
    private var routePolyline: [CLLocationCoordinate2D] = []
    private var routeSegments: [RouteSegment] = []
    
    // Statistics
    private var totalUpdates: Int = 0
    private var rejectedUpdates: Int = 0
    
    // MARK: - Initialization
    
    init(config: TruckerLocationConfig = .highway) {
        self.config = config
        self.latKalman = KalmanFilter1D(q: config.kalmanQ, r: config.kalmanR)
        self.lngKalman = KalmanFilter1D(q: config.kalmanQ, r: config.kalmanR)
        
        super.init()
        
        setupLocationManager()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = config.desiredAccuracy
        locationManager.distanceFilter = config.distanceFilter
        locationManager.activityType = config.activityType
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }
    
    // MARK: - Public Methods
    
    func startUpdates() {
        locationManager.startUpdatingLocation()
        locationManager.startUpdatingHeading()
        log("Location updates started")
    }
    
    func stopUpdates() {
        locationManager.stopUpdatingLocation()
        locationManager.stopUpdatingHeading()
        log("Location updates stopped")
    }
    
    func requestPermissions() {
        locationManager.requestAlwaysAuthorization()
    }
    
    func setRoutePolyline(_ coordinates: [CLLocationCoordinate2D]) {
        routePolyline = coordinates
        routeSegments = buildRouteSegments(from: coordinates)
        log("Route set with \(coordinates.count) points, \(routeSegments.count) segments")
    }
    
    func clearRoute() {
        routePolyline = []
        routeSegments = []
        offRouteStartTime = nil
        isCurrentlyOffRoute = false
    }
    
    func updateConfig(_ newConfig: TruckerLocationConfig) {
        config = newConfig
        latKalman = KalmanFilter1D(q: config.kalmanQ, r: config.kalmanR)
        lngKalman = KalmanFilter1D(q: config.kalmanQ, r: config.kalmanR)
        setupLocationManager()
    }
    
    func getStatistics() -> [String: Any] {
        return [
            "totalUpdates": totalUpdates,
            "rejectedUpdates": rejectedUpdates,
            "rerouteCount": rerouteCount,
            "acceptanceRate": totalUpdates > 0 ? Double(totalUpdates - rejectedUpdates) / Double(totalUpdates) : 1.0
        ]
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        totalUpdates += 1
        let now = Date()
        
        // Calculate time since last update
        let timeSinceLastUpdate = lastUpdateTime.map { now.timeIntervalSince($0) * 1000 } ?? 0
        let updateFrequency = timeSinceLastUpdate > 0 ? 1000 / timeSinceLastUpdate : 0
        
        // Check for stale update
        let isStale = abs(location.timestamp.timeIntervalSince(now)) > config.maxStaleUpdateMs / 1000
        if isStale {
            log("Stale update rejected: \(abs(location.timestamp.timeIntervalSince(now)))s old")
            rejectedUpdates += 1
            return
        }
        
        // Check for teleportation / jump
        var rejectionReason: String?
        var isRejected = false
        
        if let lastLocation = lastValidLocation {
            let distance = location.distance(from: lastLocation)
            let timeDelta = location.timestamp.timeIntervalSince(lastLocation.timestamp)
            
            if timeDelta > 0 {
                let impliedSpeed = distance / timeDelta
                
                // Reject if implies impossible speed
                if impliedSpeed > config.maxReasonableSpeed * 2 {
                    rejectionReason = "Teleport detected: \(Int(distance))m in \(timeDelta)s = \(Int(impliedSpeed))m/s"
                    isRejected = true
                    rejectedUpdates += 1
                    log(rejectionReason!)
                }
                
                // Reject if implies impossible acceleration
                let lastSpeed = lastValidLocation?.speed ?? 0
                let acceleration = abs(impliedSpeed - lastSpeed) / timeDelta
                if acceleration > config.maxAccelerationMps2 * 3 {
                    rejectionReason = "Impossible acceleration: \(acceleration) m/s²"
                    isRejected = true
                    rejectedUpdates += 1
                    log(rejectionReason!)
                }
            }
        }
        
        // If rejected, use dead reckoning instead
        var processedLocation = location
        if isRejected, let lastLoc = lastValidLocation {
            processedLocation = projectPosition(from: lastLoc, timeDelta: timeSinceLastUpdate / 1000)
        }
        
        // Apply Kalman filter
        let filteredLat = latKalman.update(measurement: processedLocation.coordinate.latitude)
        let filteredLng = lngKalman.update(measurement: processedLocation.coordinate.longitude)
        
        // Smooth speed
        var rawSpeed = processedLocation.speed
        if rawSpeed < 0 {
            // CLLocation returns -1 when speed is invalid
            // Fallback to distance/time calculation
            if let lastLoc = lastValidLocation {
                let dist = processedLocation.distance(from: lastLoc)
                let time = processedLocation.timestamp.timeIntervalSince(lastLoc.timestamp)
                rawSpeed = time > 0 ? dist / time : 0
            } else {
                rawSpeed = 0
            }
        }
        
        let smoothedSpeed = smoothSpeed(rawSpeed)
        let displaySpeed = smoothedSpeed < config.minSpeedThreshold ? 0 : smoothedSpeed
        
        // Smooth heading
        var newHeading = processedLocation.course
        if newHeading < 0 || smoothedSpeed < config.minSpeedForHeading {
            newHeading = lastValidHeading
        }
        let smoothedHeading = lerpHeading(from: currentHeading, to: newHeading, factor: config.headingLerpFactor)
        currentHeading = smoothedHeading
        if processedLocation.course >= 0 && smoothedSpeed >= config.minSpeedForHeading {
            lastValidHeading = processedLocation.course
        }
        
        // Snap to route if available
        var snappedLat: Double?
        var snappedLng: Double?
        var snapOffset: Double?
        var distanceToRoute: Double?
        var isOnRoute = true
        
        if !routeSegments.isEmpty {
            let snapResult = snapToRoute(
                lat: filteredLat,
                lng: filteredLng,
                segments: routeSegments
            )
            
            snappedLat = snapResult.snappedLat
            snappedLng = snapResult.snappedLng
            snapOffset = snapResult.distance
            distanceToRoute = snapResult.distance
            
            // Determine if on route
            if snapResult.distance > config.offRouteThresholdMeters {
                isOnRoute = false
                
                if offRouteStartTime == nil {
                    offRouteStartTime = now
                }
                
                let offRouteDuration = now.timeIntervalSince(offRouteStartTime!)
                delegate?.locationEngine(self, didDetectOffRoute: snapResult.distance, duration: offRouteDuration)
                
                if offRouteDuration >= config.offRouteDurationSeconds && !isCurrentlyOffRoute {
                    isCurrentlyOffRoute = true
                    requestReroute(reason: "Off-route for \(offRouteDuration)s at \(Int(snapResult.distance))m")
                }
            } else {
                offRouteStartTime = nil
                isCurrentlyOffRoute = false
            }
            
            // Use snapped position if close enough
            if snapResult.distance <= config.snapThresholdMeters {
                // Override filtered with snapped
            }
        }
        
        // Build update
        let update = TruckerLocationUpdate(
            rawLatitude: location.coordinate.latitude,
            rawLongitude: location.coordinate.longitude,
            rawSpeed: location.speed,
            rawCourse: location.course,
            rawAccuracy: location.horizontalAccuracy,
            timestamp: location.timestamp,
            smoothedLatitude: filteredLat,
            smoothedLongitude: filteredLng,
            smoothedSpeed: displaySpeed,
            smoothedHeading: smoothedHeading,
            snappedLatitude: snappedLat,
            snappedLongitude: snappedLng,
            snapOffsetMeters: snapOffset,
            distanceToRouteMeters: distanceToRoute,
            isOnRoute: isOnRoute,
            speedMph: displaySpeed * 2.23694,
            speedKph: displaySpeed * 3.6,
            isStale: isStale,
            isRejected: isRejected,
            rejectionReason: rejectionReason,
            updateFrequencyHz: updateFrequency,
            timeSinceLastUpdateMs: timeSinceLastUpdate
        )
        
        // Update state
        if !isRejected {
            lastValidLocation = location
        }
        lastUpdateTime = now
        updateCount += 1
        
        // Notify delegate
        delegate?.locationEngine(self, didUpdate: update)
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        log("Location error: \(error.localizedDescription)")
    }
    
    // MARK: - Private Methods
    
    private func smoothSpeed(_ speed: Double) -> Double {
        // Add to buffer
        speedBuffer.append(speed)
        
        // Keep buffer size limited
        while speedBuffer.count > config.speedSmoothingSamples {
            speedBuffer.removeFirst()
        }
        
        // Calculate moving average
        let sum = speedBuffer.reduce(0, +)
        return sum / Double(speedBuffer.count)
    }
    
    private func lerpHeading(from: Double, to: Double, factor: Double) -> Double {
        // Handle wrap-around at 360 degrees
        var delta = to - from
        if delta > 180 { delta -= 360 }
        if delta < -180 { delta += 360 }
        
        var result = from + delta * factor
        if result < 0 { result += 360 }
        if result >= 360 { result -= 360 }
        
        return result
    }
    
    private func projectPosition(from location: CLLocation, timeDelta: Double) -> CLLocation {
        // Dead reckoning: project position based on last speed and heading
        let speed = location.speed > 0 ? location.speed : 0
        let heading = location.course > 0 ? location.course : lastValidHeading
        
        let distance = speed * timeDelta
        let headingRad = heading * .pi / 180
        
        let earthRadius = 6371000.0 // meters
        let lat1 = location.coordinate.latitude * .pi / 180
        let lng1 = location.coordinate.longitude * .pi / 180
        
        let lat2 = asin(sin(lat1) * cos(distance / earthRadius) +
                       cos(lat1) * sin(distance / earthRadius) * cos(headingRad))
        
        let lng2 = lng1 + atan2(sin(headingRad) * sin(distance / earthRadius) * cos(lat1),
                                cos(distance / earthRadius) - sin(lat1) * sin(lat2))
        
        let newCoord = CLLocationCoordinate2D(
            latitude: lat2 * 180 / .pi,
            longitude: lng2 * 180 / .pi
        )
        
        return CLLocation(
            coordinate: newCoord,
            altitude: location.altitude,
            horizontalAccuracy: location.horizontalAccuracy,
            verticalAccuracy: location.verticalAccuracy,
            course: heading,
            speed: speed,
            timestamp: Date()
        )
    }
    
    private func buildRouteSegments(from coordinates: [CLLocationCoordinate2D]) -> [RouteSegment] {
        var segments: [RouteSegment] = []
        
        for i in 0..<(coordinates.count - 1) {
            let start = coordinates[i]
            let end = coordinates[i + 1]
            let bearing = calculateBearing(from: start, to: end)
            
            segments.append(RouteSegment(
                startLat: start.latitude,
                startLng: start.longitude,
                endLat: end.latitude,
                endLng: end.longitude,
                bearing: bearing
            ))
        }
        
        return segments
    }
    
    private func calculateBearing(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let lat1 = from.latitude * .pi / 180
        let lat2 = to.latitude * .pi / 180
        let dLng = (to.longitude - from.longitude) * .pi / 180
        
        let y = sin(dLng) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng)
        
        var bearing = atan2(y, x) * 180 / .pi
        if bearing < 0 { bearing += 360 }
        
        return bearing
    }
    
    private func snapToRoute(lat: Double, lng: Double, segments: [RouteSegment]) -> (snappedLat: Double, snappedLng: Double, distance: Double) {
        var bestDistance = Double.infinity
        var bestLat = lat
        var bestLng = lng
        
        let point = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        
        for segment in segments {
            let start = CLLocationCoordinate2D(latitude: segment.startLat, longitude: segment.startLng)
            let end = CLLocationCoordinate2D(latitude: segment.endLat, longitude: segment.endLng)
            
            let (projLat, projLng, dist) = projectPointToSegment(point: point, start: start, end: end)
            
            if dist < bestDistance {
                bestDistance = dist
                bestLat = projLat
                bestLng = projLng
            }
        }
        
        return (bestLat, bestLng, bestDistance)
    }
    
    private func projectPointToSegment(
        point: CLLocationCoordinate2D,
        start: CLLocationCoordinate2D,
        end: CLLocationCoordinate2D
    ) -> (lat: Double, lng: Double, distance: Double) {
        // Vector from start to end
        let dx = end.longitude - start.longitude
        let dy = end.latitude - start.latitude
        
        // Vector from start to point
        let px = point.longitude - start.longitude
        let py = point.latitude - start.latitude
        
        // Calculate projection
        let segmentLengthSquared = dx * dx + dy * dy
        
        if segmentLengthSquared < 1e-10 {
            // Segment is essentially a point
            let dist = haversineDistance(from: point, to: start)
            return (start.latitude, start.longitude, dist)
        }
        
        var t = (px * dx + py * dy) / segmentLengthSquared
        t = max(0, min(1, t)) // Clamp to segment
        
        let projLng = start.longitude + t * dx
        let projLat = start.latitude + t * dy
        
        let projPoint = CLLocationCoordinate2D(latitude: projLat, longitude: projLng)
        let dist = haversineDistance(from: point, to: projPoint)
        
        return (projLat, projLng, dist)
    }
    
    private func haversineDistance(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let earthRadius = 6371000.0 // meters
        
        let lat1 = from.latitude * .pi / 180
        let lat2 = to.latitude * .pi / 180
        let dLat = (to.latitude - from.latitude) * .pi / 180
        let dLng = (to.longitude - from.longitude) * .pi / 180
        
        let a = sin(dLat / 2) * sin(dLat / 2) +
                cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return earthRadius * c
    }
    
    private func requestReroute(reason: String) {
        // Debounce reroutes
        if let lastReroute = lastRerouteTime,
           Date().timeIntervalSince(lastReroute) < 10 {
            log("Reroute debounced: too soon after last reroute")
            return
        }
        
        rerouteCount += 1
        lastRerouteTime = Date()
        
        log("Reroute requested: \(reason)")
        delegate?.locationEngine(self, didRequestReroute: reason)
    }
    
    private func log(_ message: String) {
        if config.enableDebugLogging {
            print("[TruckerLocationEngine] \(message)")
            delegate?.locationEngine(self, didLogDebug: message)
        }
    }
}
