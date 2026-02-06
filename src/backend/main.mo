import Option "mo:core/Option";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Nat64 "mo:core/Nat64";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Float "mo:core/Float";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type Coordinates = {
    latitude : Float;
    longitude : Float;
  };

  type AmbulanceId = Principal;
  type LocationId = Nat;

  type UserProfile = {
    name : Text;
    role : AppRole;
  };

  type AppRole = {
    #police;
    #ambulance;
  };

  type AmbulanceLocation = {
    ambulanceId : AmbulanceId;
    coordinates : Coordinates;
    timestamp : Time.Time;
  };

  type SOSAlert = {
    ambulanceId : AmbulanceId;
    coordinates : Coordinates;
    timestamp : Time.Time;
    active : Bool;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let ambulanceLocations = Map.empty<AmbulanceId, AmbulanceLocation>();
  let sosAlerts = Map.empty<AmbulanceId, SOSAlert>();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Helper function to check if caller is ambulance
  func isAmbulance(caller : Principal) : Bool {
    switch (userProfiles.get(caller)) {
      case (?profile) {
        switch (profile.role) {
          case (#ambulance) { true };
          case (_) { false };
        };
      };
      case (null) { false };
    };
  };

  // Helper function to check if caller is police
  func isPolice(caller : Principal) : Bool {
    switch (userProfiles.get(caller)) {
      case (?profile) {
        switch (profile.role) {
          case (#police) { true };
          case (_) { false };
        };
      };
      case (null) { false };
    };
  };

  func deg2rad(deg : Float) : Float {
    deg * (3.1415926 / 180.0);
  };

  func calculateDistance(coord1 : Coordinates, coord2 : Coordinates) : Float {
    let earthRadius = 6371.0; // Radius of the earth in km
    let dLat = deg2rad(coord2.latitude - coord1.latitude);
    let dLon = deg2rad(coord2.longitude - coord1.longitude);
    let a = (Float.sin(dLat / 2.0) ** 2) + Float.cos(deg2rad(coord1.latitude)) * Float.cos(deg2rad(coord2.latitude)) * (Float.sin(dLon / 2.0) ** 2);
    let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
    earthRadius * c;
  };

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Ambulance Location Management
  public shared ({ caller }) func updateAmbulanceLocation(coordinates : Coordinates) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update location");
    };
    if (not isAmbulance(caller)) {
      Runtime.trap("Unauthorized: Only ambulance users can update ambulance location");
    };

    let location : AmbulanceLocation = {
      ambulanceId = caller;
      coordinates = coordinates;
      timestamp = Time.now();
    };
    ambulanceLocations.add(caller, location);
  };

  public query ({ caller }) func getAmbulanceLocation(ambulanceId : AmbulanceId) : async ?AmbulanceLocation {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view locations");
    };
    if (caller != ambulanceId and not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own location or must be police/admin");
    };
    ambulanceLocations.get(ambulanceId);
  };

  // Police queries for nearby ambulances
  public query ({ caller }) func getLocationsInRadius(center : Coordinates, radius : Float) : async [AmbulanceLocation] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can query locations");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can query locations in radius");
    };

    let filtered = ambulanceLocations.toArray().filter(
      func((_, location)) {
        calculateDistance(center, location.coordinates) <= radius;
      }
    );
    filtered.map<(AmbulanceId, AmbulanceLocation), AmbulanceLocation>(func((_, loc)) { loc });
  };

  public query ({ caller }) func getSortedLocationsInRadius(center : Coordinates, radius : Float) : async [AmbulanceLocation] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can query locations");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can query locations in radius");
    };

    let locationsInRadius = ambulanceLocations.toArray().filter(
      func((_, location)) {
        calculateDistance(center, location.coordinates) <= radius;
      }
    );

    let sorted = locationsInRadius.sort(
      func((_, loc1), (_, loc2)) {
        let distance1 = calculateDistance(center, loc1.coordinates);
        let distance2 = calculateDistance(center, loc2.coordinates);
        Float.compare(distance1, distance2);
      }
    );

    sorted.map<(AmbulanceId, AmbulanceLocation), AmbulanceLocation>(func((_, loc)) { loc });
  };

  // SOS Alert Management
  public shared ({ caller }) func triggerSOS(coordinates : Coordinates) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can trigger SOS");
    };
    if (not isAmbulance(caller)) {
      Runtime.trap("Unauthorized: Only ambulance users can trigger SOS");
    };

    let alert : SOSAlert = {
      ambulanceId = caller;
      coordinates = coordinates;
      timestamp = Time.now();
      active = true;
    };
    sosAlerts.add(caller, alert);
  };

  public shared ({ caller }) func deactivateSOS() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can deactivate SOS");
    };

    switch (sosAlerts.get(caller)) {
      case (?alert) {
        if (alert.ambulanceId != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only deactivate your own SOS or must be admin");
        };
        let updatedAlert : SOSAlert = {
          ambulanceId = alert.ambulanceId;
          coordinates = alert.coordinates;
          timestamp = alert.timestamp;
          active = false;
        };
        sosAlerts.add(caller, updatedAlert);
      };
      case (null) {
        Runtime.trap("No active SOS alert found");
      };
    };
  };

  public query ({ caller }) func getActiveSOSAlerts() : async [SOSAlert] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view SOS alerts");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can view SOS alerts");
    };

    let activeAlerts = sosAlerts.toArray().filter(
      func((_, alert)) {
        alert.active;
      }
    );
    activeAlerts.map<(AmbulanceId, SOSAlert), SOSAlert>(func((_, alert)) { alert });
  };

  public query ({ caller }) func getSOSAlert(ambulanceId : AmbulanceId) : async ?SOSAlert {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view SOS alerts");
    };
    if (caller != ambulanceId and not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own SOS or must be police/admin");
    };
    sosAlerts.get(ambulanceId);
  };

  // Admin functions
  public shared ({ caller }) func deleteAmbulanceLocation(ambulanceId : AmbulanceId) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can delete locations");
    };
    ambulanceLocations.remove(ambulanceId);
  };

  public query ({ caller }) func getAllLocations() : async [AmbulanceLocation] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can view all locations");
    };
    let allLocations = ambulanceLocations.toArray();
    allLocations.map<(AmbulanceId, AmbulanceLocation), AmbulanceLocation>(func((_, loc)) { loc });
  };

  public query ({ caller }) func getLocationsInTimeRange(start : Int, end : Int) : async [AmbulanceLocation] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can query locations by time range");
    };
    let filtered = ambulanceLocations.toArray().filter(
      func((_, location)) {
        location.timestamp >= start and location.timestamp <= end
      }
    );
    filtered.map<(AmbulanceId, AmbulanceLocation), AmbulanceLocation>(func((_, loc)) { loc });
  };

  public query ({ caller }) func getLocationsCountInRadius(center : Coordinates, radius : Float) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can query location counts");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can query location counts");
    };

    let locationsInRadius = ambulanceLocations.toArray().filter(
      func((_, location)) {
        calculateDistance(center, location.coordinates) <= radius;
      }
    );
    locationsInRadius.size();
  };

  public query ({ caller }) func getAllSOSAlerts() : async [SOSAlert] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can view all SOS alerts");
    };
    let allAlerts = sosAlerts.toArray();
    allAlerts.map<(AmbulanceId, SOSAlert), SOSAlert>(func((_, alert)) { alert });
  };
};
