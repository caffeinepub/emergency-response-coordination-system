import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";

module {
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
  type SOSAlertOld = {
    ambulanceId : AmbulanceId;
    coordinates : Coordinates;
    timestamp : Time.Time;
    active : Bool;
  };

  type SOSAlertNew = {
    ambulanceId : AmbulanceId;
    coordinates : Coordinates;
    timestamp : Time.Time;
    active : Bool;
    targetPolice : [Principal];
  };

  type AppStateOld = {
    userProfiles : Map.Map<Principal, UserProfile>;
    ambulanceLocations : Map.Map<AmbulanceId, AmbulanceLocation>;
    sosAlerts : Map.Map<AmbulanceId, SOSAlertOld>;
  };

  type AppStateNew = {
    userProfiles : Map.Map<Principal, UserProfile>;
    ambulanceLocations : Map.Map<AmbulanceId, AmbulanceLocation>;
    sosAlerts : Map.Map<AmbulanceId, SOSAlertNew>;
  };

  public func run(old : AppStateOld) : AppStateNew {
    let newSosAlerts = old.sosAlerts.map<AmbulanceId, SOSAlertOld, SOSAlertNew>(
      func(_aid, oldAlert) {
        {
          oldAlert with
          targetPolice = []
        };
      }
    );

    {
      old with
      sosAlerts = newSosAlerts
    };
  };
};
