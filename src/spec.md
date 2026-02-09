# Specification

## Summary
**Goal:** Target ambulance-triggered SOS alerts to only the nearest 2 police officers within a 20 meter radius, based on recently-updated police locations.

**Planned changes:**
- Add backend support for police users to periodically update and store their current location (with timestamps) in canister state.
- Update backend SOS creation so it selects and records up to the nearest 2 police users within 20 meters of the SOS coordinates (ignoring stale location entries).
- Restrict backend SOS alert queries so police users only retrieve active alerts targeted to them (admins still see all).
- Update the Police frontend to send periodic police location updates while the Police interface is open, and rely on backend-targeted SOS results.
- Update Ambulance UI copy to state SOS targets the nearest 2 police within 20 meters (replacing any “all police” / “1 km” wording).

**User-visible outcome:** Ambulance SOS alerts are no longer broadcast; only the nearest 2 police within 20 meters (when available) can see the active SOS alert, and the UI messaging reflects this behavior.
