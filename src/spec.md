# Specification

## Summary
**Goal:** Unblock new user onboarding so newly authenticated users can create their initial profile and proceed past role selection (police/ambulance) without any admin setup, while preserving admin-only protections.

**Planned changes:**
- Adjust backend authorization to allow authenticated callers to create their own initial profile and read their own profile, while keeping admin-only methods restricted and blocking anonymous access.
- Fix profile creation flow so a brand-new user can submit ProfileSetup successfully and the app routes to the correct interface based on selected role (AmbulanceInterface or PoliceInterface).
- Improve ProfileSetup error handling to show clear English error messages on save failure and ensure the Continue button/loading state recovers so users can retry without refreshing.

**User-visible outcome:** A new user can sign in, choose police or ambulance, save their profile, and be taken into the correct interface; if saving fails, they see an error message and can retry immediately.
