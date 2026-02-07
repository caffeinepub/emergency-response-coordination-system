import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export type AmbulanceId = Principal;
export interface Coordinates {
    latitude: number;
    longitude: number;
}
export interface SOSAlert {
    active: boolean;
    ambulanceId: AmbulanceId;
    timestamp: Time;
    coordinates: Coordinates;
}
export interface AmbulanceLocation {
    ambulanceId: AmbulanceId;
    timestamp: Time;
    coordinates: Coordinates;
}
export interface UserProfile {
    name: string;
    role: AppRole;
}
export enum AppRole {
    ambulance = "ambulance",
    police = "police"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deactivateSOS(): Promise<void>;
    deactivateSOSForAmbulance(ambulanceId: AmbulanceId): Promise<void>;
    deleteAmbulanceLocation(ambulanceId: AmbulanceId): Promise<void>;
    getActiveSOSAlerts(): Promise<Array<SOSAlert>>;
    getAllLocations(): Promise<Array<AmbulanceLocation>>;
    getAllSOSAlerts(): Promise<Array<SOSAlert>>;
    getAmbulanceLocation(ambulanceId: AmbulanceId): Promise<AmbulanceLocation | null>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getLocationsCountInRadius(center: Coordinates, radius: number): Promise<bigint>;
    getLocationsInRadius(center: Coordinates, radius: number): Promise<Array<AmbulanceLocation>>;
    getLocationsInTimeRange(start: bigint, end: bigint): Promise<Array<AmbulanceLocation>>;
    getSOSAlert(ambulanceId: AmbulanceId): Promise<SOSAlert | null>;
    getSortedLocationsInRadius(center: Coordinates, radius: number): Promise<Array<AmbulanceLocation>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setUserProfile(user: Principal, profile: UserProfile): Promise<void>;
    triggerSOS(coordinates: Coordinates): Promise<void>;
    updateAmbulanceLocation(coordinates: Coordinates): Promise<void>;
}
