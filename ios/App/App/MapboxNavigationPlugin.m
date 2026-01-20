#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(MapboxNavigationPlugin, "MapboxNavigation",
    CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startNavigation, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopNavigation, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getCurrentPosition, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getUpcomingManeuver, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(addPositionListener, CAPPluginReturnCallback);
    CAP_PLUGIN_METHOD(addManeuverListener, CAPPluginReturnCallback);
    CAP_PLUGIN_METHOD(removePositionListener, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(enableBackgroundMode, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(cacheRouteArea, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestLocationPermission, CAPPluginReturnPromise);
)
