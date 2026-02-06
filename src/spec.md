# Specification

## Summary
**Goal:** Prevent the app from getting stuck on the global loading screen by adding timeouts, diagnostics, and clear recovery actions, and improve error/geolocation failure messaging.

**Planned changes:**
- Add a loading timeout so the UI transitions from spinner-only to a “Still loading” diagnostic state with recovery actions (retry profile fetch, invalidate/clear relevant React Query cache to re-create actor, and a hard reload option).
- Render explicit error states (instead of appearing stuck) when actor creation or profile queries fail, including a user-friendly message plus an expandable technical details section (e.g., underlying error text) and a retry control.
- Improve Ambulance and Police geolocation failure handling to detect permission/policy-related errors and show clear English guidance and next steps without blocking the rest of the page or looping on “Acquiring GPS location...”.

**User-visible outcome:** If authentication/profile loading or actor creation takes too long or fails, users see a helpful diagnostic/error screen with retry and recovery options; geolocation failures in Ambulance/Police show clear guidance while the page remains usable.
