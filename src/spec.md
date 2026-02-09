# Specification

## Summary
**Goal:** Update the app’s location update cadence to 12 seconds and expand SOS targeting radius to 30 meters, ensuring both behavior and UI text match.

**Planned changes:**
- Change periodic coordinate send/refresh intervals to 12 seconds for ambulance updates, police updates, and police-side polling of nearby ambulances.
- Update any user-facing UI copy that mentions the coordinate update frequency to state 12 seconds.
- Update backend SOS targeting logic to use a 30m (0.03 km) radius when selecting eligible police units (keeping nearest 2 and existing SOS duration unchanged).
- Update ambulance-side SOS UI copy (status text and any “How it works” bullets) to reference a 30m radius.

**User-visible outcome:** Location updates and nearby-ambulance polling occur every 12 seconds, and SOS calls can target police within 30 meters (e.g., ~25m eligible, ~35m not), with all related UI text reflecting the new values.
