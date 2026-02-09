# Specification

## Summary
**Goal:** Collect and validate ambulance users’ 10-digit phone numbers, and let police view ambulance contact details on radar and place a direct call.

**Planned changes:**
- Extend the backend `UserProfile` to include `phoneNumber`, enforcing exactly 10 digits (0–9 only) on save while preserving existing role immutability rules.
- Add a police-authorized backend query that returns nearby ambulance locations along with each ambulance’s profile contact details (name + phone number) when available.
- Update the post-login `ProfileSetup` flow to require a phone number input, restrict to digits, validate exactly 10 digits, and show English validation errors.
- Update the Police interface radar list and map marker labels/popups to display ambulance name, phone number, and coordinates, and add a “Call” button using a `tel:` link (with safe fallback when missing).
- Add/extend React Query hooks and TypeScript types so the Police interface fetches and renders the combined radar + contact dataset without changing existing polling behavior.

**User-visible outcome:** Ambulance users are prompted to enter a name and valid 10-digit phone number on first setup; police users can see each nearby ambulance’s name, phone number, and coordinates on the radar/map and can tap a “Call” button to dial them (or see a clear fallback if no number is available).
