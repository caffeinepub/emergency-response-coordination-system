# Specification

## Summary
**Goal:** Make the Police Command Center reliably display accurate ambulance locations and correct contact info, regardless of radius limits or stale update timeouts.

**Planned changes:**
- Add a police-authorized backend query that returns all current ambulance locations, and update the police UI to use it (with optional client-side radius filtering only as a view filter).
- Keep ambulances visible even when their last update is stale; mark them as “Offline / Last update: Xs ago” and add a police UI toggle to show/hide offline ambulances (applies to both list and map).
- Fix ambulance-to-contact matching in the police UI by associating contacts via ambulanceId instead of array index, with a per-ambulance fallback when contact info is missing.

**User-visible outcome:** Police users can see all ambulances with stored locations on the map and in the list, can optionally hide/show offline ambulances while still seeing stale units marked clearly, and will see the correct contact name/phone for each ambulance.
