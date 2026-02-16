import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Float "mo:core/Float";
import List "mo:core/List";
import Int "mo:core/Int";
import Char "mo:core/Char";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type Coordinates = {
    latitude : Float;
    longitude : Float;
  };

  type AmbulanceId = Principal;
  type PoliceId = Principal;

  type UserProfile = {
    name : Text;
    phoneNumber : Text;
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

  type PoliceLocation = {
    policeId : PoliceId;
    coordinates : Coordinates;
    timestamp : Time.Time;
  };

  type SOSAlert = {
    ambulanceId : AmbulanceId;
    coordinates : Coordinates;
    timestamp : Time.Time;
    active : Bool;
    targetPolice : [PoliceId];
  };

  type AmbulanceContact = {
    name : Text;
    phoneNumber : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let ambulanceLocations = Map.empty<AmbulanceId, AmbulanceLocation>();
  let policeLocations = Map.empty<PoliceId, PoliceLocation>();
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
      Runtime.trap("Unauthorized: Only users can fetch profiles");
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

    validatePhoneNumber(profile.phoneNumber);

    switch (userProfiles.get(caller)) {
      case (?existingProfile) {
        let updatedProfile : UserProfile = {
          name = profile.name;
          phoneNumber = profile.phoneNumber;
          role = existingProfile.role; // Keep existing role
        };
        userProfiles.add(caller, updatedProfile);
      };
      case (null) {
        userProfiles.add(caller, profile);
      };
    };
  };

  // Admin function to create/update user profiles with roles
  public shared ({ caller }) func setUserProfile(user : Principal, profile : UserProfile) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can set user profiles with roles");
    };
    validatePhoneNumber(profile.phoneNumber);
    userProfiles.add(user, profile);
  };

  func validatePhoneNumber(phoneNumber : Text) {
    if (phoneNumber.size() != 10) {
      Runtime.trap("Phone number must be exactly 10 digits");
    };

    for (c in phoneNumber.chars()) {
      if (c < '0' or c > '9') {
        Runtime.trap("Phone number must contain only digits (0-9)");
      };
    };
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

  // Police Location Management
  public shared ({ caller }) func updatePoliceLocation(coordinates : Coordinates) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update police location");
    };
    if (not isPolice(caller)) {
      Runtime.trap("Unauthorized: Only police users can update police location");
    };

    let location : PoliceLocation = {
      policeId = caller;
      coordinates = coordinates;
      timestamp = Time.now();
    };
    policeLocations.add(caller, location);
  };

  public query ({ caller }) func getPoliceLocation(policeId : PoliceId) : async ?PoliceLocation {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view police locations");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can view police locations");
    };
    policeLocations.get(policeId);
  };

  // New function for police to get all ambulance locations
  public query ({ caller }) func getAllAmbulanceLocations() : async [AmbulanceLocation] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view ambulance locations");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can view all ambulance locations");
    };
    let allLocations = ambulanceLocations.toArray();
    allLocations.map<(AmbulanceId, AmbulanceLocation), AmbulanceLocation>(func((_, loc)) { loc });
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

  // Police query for ambulance contacts in radius
  public query ({ caller }) func getAmbulanceContactsInRadius(center : Coordinates, radius : Float) : async [AmbulanceContact] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can query ambulance contacts");
    };
    if (not isPolice(caller) and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only police or admin can query ambulance contacts");
    };

    let filteredLocations = ambulanceLocations.toArray().filter(
      func((_, location)) {
        calculateDistance(center, location.coordinates) <= radius;
      }
    );

    filteredLocations.map(
      func((ambulanceId, _)) {
        switch (userProfiles.get(ambulanceId)) {
          case (?profile) {
            {
              name = profile.name;
              phoneNumber = profile.phoneNumber;
            };
          };
          case (null) {
            {
              name = "Unknown";
              phoneNumber = "Unknown";
            };
          };
        };
      }
    );
  };

  // SOS Alert Management
  public shared ({ caller }) func triggerSOS(coordinates : Coordinates) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can trigger SOS");
    };
    if (not isAmbulance(caller)) {
      Runtime.trap("Unauthorized: Only ambulance users can trigger SOS");
    };

    let allPolice = policeLocations.toArray();
    let radius = 0.05; // 50 meters (0.05 km)

    let policeWithinRadius = allPolice.filter(
      func((_, location)) {
        calculateDistance(coordinates, location.coordinates) <= radius;
      }
    );

    let policeWithDistances = policeWithinRadius.map(
      func((id, location)) {
        (id, location, calculateDistance(coordinates, location.coordinates));
      }
    );

    let list = List.fromArray<(PoliceId, PoliceLocation, Float)>(policeWithDistances);

    let sortedList = List.fromArray<(PoliceId, PoliceLocation, Float)>(
      list.toArray().sort(
        func(a, b) {
          Float.compare(a.2, b.2);
        }
      )
    );

    let filteredList = sortedList.toArray().sliceToArray(0, Int.min(2, sortedList.size().toInt()));
    let targetPolice = filteredList.map(
      func((id, _, _)) { id }
    );

    let alert : SOSAlert = {
      ambulanceId = caller;
      coordinates = coordinates;
      timestamp = Time.now();
      active = true;
      targetPolice;
    };
    sosAlerts.add(caller, alert);
  };

  public shared ({ caller }) func deactivateSOS() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can deactivate SOS");
    };

    switch (sosAlerts.get(caller)) {
      case (?alert) {
        if (alert.ambulanceId != caller) {
          Runtime.trap("Unauthorized: Can only deactivate your own SOS");
        };
        let updatedAlert : SOSAlert = {
          ambulanceId = alert.ambulanceId;
          coordinates = alert.coordinates;
          timestamp = alert.timestamp;
          active = false;
          targetPolice = alert.targetPolice;
        };
        sosAlerts.add(caller, updatedAlert);
      };
      case (null) {
        Runtime.trap("No SOS alert found for this ambulance");
      };
    };
  };

  public shared ({ caller }) func deactivateSOSForAmbulance(ambulanceId : AmbulanceId) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can deactivate SOS for other ambulances");
    };

    switch (sosAlerts.get(ambulanceId)) {
      case (?alert) {
        let updatedAlert : SOSAlert = {
          ambulanceId = alert.ambulanceId;
          coordinates = alert.coordinates;
          timestamp = alert.timestamp;
          active = false;
          targetPolice = alert.targetPolice;
        };
        sosAlerts.add(ambulanceId, updatedAlert);
      };
      case (null) {
        Runtime.trap("No SOS alert found for this ambulance");
      };
    };
  };

  public query ({ caller }) func getActiveSOSAlerts() : async [SOSAlert] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view SOS alerts");
    };

    if (AccessControl.isAdmin(accessControlState, caller)) {
      let activeAlerts = sosAlerts.toArray().filter(
        func((_, alert)) {
          alert.active;
        }
      );
      return activeAlerts.map<(AmbulanceId, SOSAlert), SOSAlert>(func((_, alert)) { alert });
    };

    if (not isPolice(caller)) {
      Runtime.trap("Unauthorized: Only police or admin can view SOS alerts");
    };

    let activeAlertsForCaller = sosAlerts.toArray().filter(
      func((_, alert)) {
        alert.active and alert.targetPolice.any(func(id) { id == caller });
      }
    );
    activeAlertsForCaller.map<(AmbulanceId, SOSAlert), SOSAlert>(func((_, alert)) { alert });
  };

  public query ({ caller }) func getSOSAlert(alertId : AmbulanceId) : async ?SOSAlert {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view SOS alerts");
    };

    switch (sosAlerts.get(alertId)) {
      case (?alert) {
        if (AccessControl.isAdmin(accessControlState, caller)) {
          return ?alert;
        };

        if (not isPolice(caller)) {
          Runtime.trap("Unauthorized: Only police or admin can view SOS alerts");
        };

        let isTargetPolice = alert.targetPolice.any(func(id) { id == caller });
        if (not isTargetPolice) {
          return null;
        };
        ?alert;
      };
      case (null) { null };
    };
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

  public query ({ caller }) func getAllAmbulanceContacts() : async [AmbulanceContact] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can view ambulance contacts");
    };
    let profiles = userProfiles.toArray();
    profiles.map<(Principal, UserProfile), AmbulanceContact>(
      func((_, profile)) {
        {
          name = profile.name;
          phoneNumber = profile.phoneNumber;
        };
      }
    );
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
