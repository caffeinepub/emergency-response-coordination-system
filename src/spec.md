# Specification

## Summary
**Goal:** Fix the blank white screen issue occurring in production by adding comprehensive error logging, loading states, and error boundaries.

**Planned changes:**
- Add error logging throughout app initialization (React Query, Internet Identity, actor creation, bootstrap)
- Add a loading fallback UI in main.tsx to show a spinner during app initialization
- Wrap the root App component with ErrorBoundary to catch render-time errors
- Add defensive null checks and error handling in App.tsx for actor, identity, and profile data failures
- Verify Leaflet CDN script loading with onload handler and error fallback logging

**User-visible outcome:** Users will see a loading indicator instead of a blank screen during app initialization, and clear error messages if something goes wrong, making the app more reliable and debuggable in production.
