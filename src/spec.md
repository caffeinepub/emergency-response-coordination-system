# Emergency Response Coordination System

## Overview
An emergency response coordination application that enables communication between ambulance crews and police units through real-time location sharing and SOS alerts with live synchronization across devices.

## User Interface Selection
The application provides a simple interface selector allowing users to choose between:
- Ambulance interface
- Police interface

## Ambulance Interface

### Continuous Location Sharing
- Automatic GPS location detection using device geolocation API
- Continuous transmission of ambulance coordinates to backend every 2-5 seconds
- Location data includes precise coordinates and timestamp
- Visual indicator showing active location sharing status

### SOS Alert System
- Large, prominent SOS button for emergency activation
- When pressed, immediately triggers SOS alert in backend
- Visual confirmation displayed to ambulance user when SOS is activated
- SOS alert remains active for a predetermined duration
- Clear visual feedback indicating active SOS state

## Police Interface

### Real-time Map Display
- Interactive map showing live positions of all ambulances within 1 km radius
- Ambulance markers displayed using ambulance-marker icons
- Map updates ambulance positions automatically through periodic polling every 2-5 seconds
- Police device location automatically detected for radius calculation

### SOS Alert Management
- Automatic audio alert sound plays when new SOS notification is detected
- Visual alert highlighting with ambulance markers turning red when SOS is active
- Alert details display showing:
  - Ambulance coordinates
  - Alert timestamp
  - Ambulance identification
- Alert information presented in prominent popup or overlay format

### Live Data Synchronization
- Continuous polling of backend every 2-5 seconds for ambulance updates
- Automatic refresh of map markers and ambulance positions
- Real-time detection of new SOS alerts from nearby ambulances
- Visual and audible identification of new SOS signals even for already tracked ambulances

## Backend Data Storage
The backend stores:
- Active ambulance locations with precise coordinates and timestamps
- SOS alert status and activation time for each ambulance
- Ambulance identification and status data
- Location update history for synchronization

## Backend Operations
- Receive and store continuous ambulance location updates every 2-5 seconds
- Manage SOS alert states and real-time broadcasting
- Calculate and provide ambulance data within 1 km radius of requesting police units
- Handle high-frequency polling requests for live synchronization
- Track SOS alert timing and automatic deactivation

## Role-based Geolocation Sharing
- Ambulance devices continuously send GPS coordinates to backend
- Police devices receive and display location data from nearby ambulances
- Automatic role-based data filtering and radius-based location sharing
- Real-time synchronization ensures immediate updates across all connected devices

## Technical Requirements
- High-frequency geolocation access for ambulance interfaces
- Periodic polling system for real-time data synchronization (2-5 second intervals)
- Audio notification capability for SOS alerts on police devices
- Real-time map rendering with dynamic marker updates
- Efficient backend handling of frequent location updates and polling requests
