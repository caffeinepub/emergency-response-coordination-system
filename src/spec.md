# Specification

## Summary
**Goal:** Fix the profile creation error that prevents new users from completing their profile setup on first login.

**Planned changes:**
- Investigate and resolve the "Unable to save profile. Please try logging in again." error occurring during profile creation for new users (specifically when selecting Ambulance Crew role)
- Add comprehensive error logging to both frontend (ProfileSetup.tsx) and backend (createUserProfile function) to capture exact failure reasons including authorization issues, validation errors, and backend state conflicts
- Ensure profile data is correctly saved and users are properly redirected to their role-specific interface after successful profile creation

**User-visible outcome:** New users can successfully create their profile on first login from any device without encountering the error, and are redirected to the appropriate interface (e.g., Ambulance Interface for Ambulance Crew role).
