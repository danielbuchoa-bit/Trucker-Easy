import Foundation
import Capacitor
import MapboxNavigation
import MapboxMaps
import CoreLocation

/**
 * POI Overlay Controller
 * 
 * Manages fuel stations and weigh station POI layers on the map
 * Displays only major truck stop brands: Love's, Pilot, Flying J, TA, Petro, etc.
 */
class POIOverlayController {
    
    // MARK: - Properties
    
    weak var mapView: MapView?
    
    // Major truck stop brands to display
    private let MAJOR_TRUCK_STOP_BRANDS = [
        "love's", "loves",
        "pilot", "flying j", "flyingj",
        "ta", "travel america", "travelamerica",
        "petro", "petro stopping",
        "sapp bros", "sappbros",
        "ambest",
        "buc-ee's", "bucees",
        "kenly 95", "iowa 80"
    ]
    
    // POI layer IDs
    private let FUEL_LAYER_ID = "truck-fuel-stops"
    private let WEIGH_STATION_LAYER_ID = "weigh-stations"
    
    // MARK: - Initialization
    
    init(mapView: MapView?) {
        self.mapView = mapView
    }
    
    // MARK: - Public Methods
    
    /// Add fuel station POI layer with truck stop filtering
    func addFuelStationLayer(stops: [TruckStop]) {
        guard let mapView = mapView else { return }
        
        // Filter to major brands only
        let filteredStops = stops.filter { stop in
            let name = stop.name.lowercased()
            return MAJOR_TRUCK_STOP_BRANDS.contains { brand in
                name.contains(brand)
            }
        }
        
        // Create GeoJSON source
        var features: [Feature] = []
        for stop in filteredStops {
            var feature = Feature(geometry: .point(Point(CLLocationCoordinate2D(
                latitude: stop.latitude,
                longitude: stop.longitude
            ))))
            feature.properties = [
                "name": .string(stop.name),
                "brand": .string(stop.brand),
                "hasDiesel": .boolean(stop.hasDiesel),
                "hasDef": .boolean(stop.hasDef),
                "hasParking": .boolean(stop.hasTruckParking)
            ]
            features.append(feature)
        }
        
        let featureCollection = FeatureCollection(features: features)
        
        do {
            var source = GeoJSONSource(id: "fuel-stops-source")
            source.data = .featureCollection(featureCollection)
            try mapView.mapboxMap.addSource(source)
            
            // Add symbol layer with truck stop icon
            var layer = SymbolLayer(id: FUEL_LAYER_ID, source: "fuel-stops-source")
            layer.iconImage = .constant(.name("fuel-pump"))
            layer.iconSize = .constant(1.2)
            layer.iconAllowOverlap = .constant(true)
            layer.textField = .expression(Exp(.get) { "name" })
            layer.textSize = .constant(12)
            layer.textOffset = .constant([0, 1.5])
            layer.textAnchor = .constant(.top)
            layer.textColor = .constant(StyleColor(.white))
            layer.textHaloColor = .constant(StyleColor(.black))
            layer.textHaloWidth = .constant(1)
            
            try mapView.mapboxMap.addLayer(layer)
            
            print("[POIOverlay] Added \(filteredStops.count) truck stops to map")
        } catch {
            print("[POIOverlay] Error adding fuel layer: \(error)")
        }
    }
    
    /// Add weigh station POI layer
    func addWeighStationLayer(stations: [WeighStation]) {
        guard let mapView = mapView else { return }
        
        var features: [Feature] = []
        for station in stations {
            var feature = Feature(geometry: .point(Point(CLLocationCoordinate2D(
                latitude: station.latitude,
                longitude: station.longitude
            ))))
            feature.properties = [
                "name": .string(station.name),
                "state": .string(station.state),
                "isOpen": .boolean(station.isOpen),
                "bypassAvailable": .boolean(station.bypassAvailable)
            ]
            features.append(feature)
        }
        
        let featureCollection = FeatureCollection(features: features)
        
        do {
            var source = GeoJSONSource(id: "weigh-stations-source")
            source.data = .featureCollection(featureCollection)
            try mapView.mapboxMap.addSource(source)
            
            // Add symbol layer with weigh station icon
            var layer = SymbolLayer(id: WEIGH_STATION_LAYER_ID, source: "weigh-stations-source")
            layer.iconImage = .constant(.name("weight-scale"))
            layer.iconSize = .constant(1.0)
            layer.iconAllowOverlap = .constant(true)
            
            // Color based on open/closed status
            layer.iconColor = .expression(
                Exp(.match) {
                    Exp(.get) { "isOpen" }
                    true
                    UIColor.green
                    false
                    UIColor.red
                    UIColor.gray
                }
            )
            
            layer.textField = .expression(Exp(.get) { "name" })
            layer.textSize = .constant(10)
            layer.textOffset = .constant([0, 1.2])
            layer.textAnchor = .constant(.top)
            layer.textColor = .constant(StyleColor(.white))
            layer.textHaloColor = .constant(StyleColor(.black))
            layer.textHaloWidth = .constant(1)
            
            try mapView.mapboxMap.addLayer(layer)
            
            print("[POIOverlay] Added \(stations.count) weigh stations to map")
        } catch {
            print("[POIOverlay] Error adding weigh station layer: \(error)")
        }
    }
    
    /// Remove all POI layers
    func removeAllLayers() {
        guard let mapView = mapView else { return }
        
        do {
            try mapView.mapboxMap.removeLayer(withId: FUEL_LAYER_ID)
            try mapView.mapboxMap.removeLayer(withId: WEIGH_STATION_LAYER_ID)
            try mapView.mapboxMap.removeSource(withId: "fuel-stops-source")
            try mapView.mapboxMap.removeSource(withId: "weigh-stations-source")
        } catch {
            // Layers may not exist
        }
    }
    
    /// Update POI visibility
    func setLayerVisibility(layerId: String, visible: Bool) {
        guard let mapView = mapView else { return }
        
        do {
            try mapView.mapboxMap.updateLayer(withId: layerId, type: SymbolLayer.self) { layer in
                layer.visibility = .constant(visible ? .visible : .none)
            }
        } catch {
            print("[POIOverlay] Error updating visibility: \(error)")
        }
    }
}

// MARK: - Data Models

struct TruckStop {
    let id: String
    let name: String
    let brand: String
    let latitude: Double
    let longitude: Double
    let hasDiesel: Bool
    let hasDef: Bool
    let hasTruckParking: Bool
    let address: String?
}

struct WeighStation {
    let id: String
    let name: String
    let state: String
    let latitude: Double
    let longitude: Double
    let isOpen: Bool
    let bypassAvailable: Bool
}
