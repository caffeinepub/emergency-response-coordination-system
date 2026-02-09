# Specification

## Summary
**Goal:** Standardize coordinate refresh behavior to 12 seconds, set the Police nearby-ambulance detection radius to 30m, and resolve the Police interface runtime/UX bug.

**Planned changes:**
- Update all continuous coordinate update/polling intervals (Ambulance updates, Police updates, and nearby-ambulance polling) to run every 12 seconds, with an immediate initial update for both Ambulance and Police.
- Change Police-side nearby-ambulance radius to 0.03 km (30m) and update all Police UI radius text to display “30m”, including meter formatting for sub‑1km values.
- Investigate and fix the Police interface bug to prevent runtime errors, ensure correct loading/empty/error states in Nearby Ambulances, and ensure SOS alert sound failures do not crash the interface.

**User-visible outcome:** Location updates and nearby-ambulance results refresh every 12 seconds; the Police screen monitors a 30m radius with correctly formatted text; the Police interface runs reliably with proper loading/error feedback even if location permission is denied or alert audio cannot play.
