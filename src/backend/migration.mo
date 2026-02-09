import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";

module {
  // Original types
  type OldUserProfile = {
    name : Text;
    role : AppRole;
  };

  type OldActor = {
    userProfiles : Map.Map<Principal, OldUserProfile>;
    ambulanceLocations : Map.Map<Principal, AmbulanceLocation>;
    policeLocations : Map.Map<Principal, PoliceLocation>;
    sosAlerts : Map.Map<Principal, SOSAlert>;
  };

  // New types
  type NewUserProfile = {
    name : Text;
    phoneNumber : Text;
    role : AppRole;
  };

  type NewActor = {
    userProfiles : Map.Map<Principal, NewUserProfile>;
    ambulanceLocations : Map.Map<Principal, AmbulanceLocation>;
    policeLocations : Map.Map<Principal, PoliceLocation>;
    sosAlerts : Map.Map<Principal, SOSAlert>;
  };

  type AppRole = {
    #police;
    #ambulance;
  };

  type Coordinates = {
    latitude : Float;
    longitude : Float;
  };

  type AmbulanceLocation = {
    ambulanceId : Principal;
    coordinates : Coordinates;
    timestamp : Time.Time;
  };

  type PoliceLocation = {
    policeId : Principal;
    coordinates : Coordinates;
    timestamp : Time.Time;
  };

  type SOSAlert = {
    ambulanceId : Principal;
    coordinates : Coordinates;
    timestamp : Time.Time;
    active : Bool;
    targetPolice : [Principal];
  };

  public func run(old : OldActor) : NewActor {
    let newUserProfiles = old.userProfiles.map<Principal, OldUserProfile, NewUserProfile>(
      func(_k, oldProfile) {
        {
          name = oldProfile.name;
          phoneNumber = "";
          role = oldProfile.role;
        };
      }
    );
    {
      old with userProfiles = newUserProfiles;
    };
  };
};

