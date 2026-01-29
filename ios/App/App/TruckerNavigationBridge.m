// TruckerNavigationBridge.m
// Objective-C bridge for Capacitor plugin registration

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Register the TruckerNavigationBridge plugin
CAP_PLUGIN(TruckerNavigationBridge, "TruckerNavigationBridge",
    CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startLocationUpdates, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopLocationUpdates, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setRoute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearRoute, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateConfig, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getStatistics, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getDebugLogs, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
)
