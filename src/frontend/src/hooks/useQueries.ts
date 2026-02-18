import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { UserProfile, Coordinates, AmbulanceLocation, SOSAlert, AmbulanceContact, AmbulanceId } from '../backend';
import { LOCATION_UPDATE_INTERVAL, POLICE_REFRESH_INTERVAL } from '../utils/locationRefresh';
import { Principal } from '@dfinity/principal';

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      console.log('[useGetCallerUserProfile] Query function called', {
        hasActor: !!actor,
        actorFetching,
        hasIdentity: !!identity,
        isAnonymous: identity ? Principal.anonymous().toString() === identity.getPrincipal().toString() : true,
        timestamp: new Date().toISOString(),
      });

      if (!actor) {
        console.error('[useGetCallerUserProfile] Actor not available');
        throw new Error('Actor not available');
      }

      if (!identity) {
        console.error('[useGetCallerUserProfile] Identity not available');
        throw new Error('Identity not available');
      }

      // Check if user is anonymous
      const isAnonymous = Principal.anonymous().toString() === identity.getPrincipal().toString();
      if (isAnonymous) {
        console.warn('[useGetCallerUserProfile] Anonymous principal detected, returning null');
        return null;
      }

      try {
        console.log('[useGetCallerUserProfile] Calling actor.getCallerUserProfile()...');
        const profile = await actor.getCallerUserProfile();
        console.log('[useGetCallerUserProfile] Profile fetched successfully:', {
          hasProfile: !!profile,
          profileName: profile?.name,
          profileRole: profile?.role,
          profilePhone: profile?.phoneNumber,
        });
        return profile;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        
        console.error('[useGetCallerUserProfile] Error fetching profile:', {
          errorType: error?.constructor?.name,
          errorMessage,
          errorString: String(error),
          errorStack: error?.stack,
          hasActor: !!actor,
          hasIdentity: !!identity,
          principalId: identity?.getPrincipal().toString(),
          timestamp: new Date().toISOString(),
        });

        // Check if this is an authorization error (user not yet set up in backend)
        if (
          errorMessage.includes('Unauthorized') ||
          errorMessage.includes('Only users can view profiles') ||
          errorMessage.includes('Anonymous') ||
          errorMessage.includes('permission')
        ) {
          console.warn('[useGetCallerUserProfile] Authorization error - user may not be set up yet, returning null');
          // Return null instead of throwing - this indicates a new user who needs profile setup
          return null;
        }
        
        // For other errors, re-throw with enhanced error information
        const enhancedError = new Error(
          error?.message || 'Failed to fetch user profile'
        );
        enhancedError.stack = error?.stack;
        (enhancedError as any).originalError = error;
        (enhancedError as any).errorType = 'PROFILE_FETCH_ERROR';
        throw enhancedError;
      }
    },
    enabled: !!actor && !actorFetching && !!identity,
    retry: (failureCount, error: any) => {
      // Don't retry authorization errors
      const errorMessage = error?.message || String(error);
      if (
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('Anonymous') ||
        (error as any)?.errorType === 'AUTHORIZATION_ERROR'
      ) {
        console.log('[useGetCallerUserProfile] Not retrying authorization error');
        return false;
      }

      console.log('[useGetCallerUserProfile] Retry decision:', {
        failureCount,
        error: errorMessage,
        willRetry: failureCount < 3,
      });
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  console.log('[useGetCallerUserProfile] Query state:', {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error?.message,
    hasData: !!query.data,
    actorFetching,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && !!identity && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      try {
        console.log('[useSaveCallerUserProfile] Saving profile:', {
          name: profile.name,
          role: profile.role,
          phoneLength: profile.phoneNumber.length,
        });
        await actor.saveCallerUserProfile(profile);
        console.log('[useSaveCallerUserProfile] Profile saved successfully');
      } catch (error: any) {
        console.error('[useSaveCallerUserProfile] Error saving profile:', {
          errorType: error?.constructor?.name,
          errorMessage: error?.message,
          errorString: String(error),
        });
        
        // Extract meaningful error message from backend trap
        const errorMessage = error?.message || String(error);
        
        // Check for phone number validation errors
        if (errorMessage.includes('Phone number must be exactly 10 digits')) {
          throw new Error('Phone number must be exactly 10 digits');
        }
        if (errorMessage.includes('Phone number must contain only digits')) {
          throw new Error('Phone number must contain only digits (0-9)');
        }
        
        // Check for authorization errors
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Anonymous')) {
          throw new Error('Unable to save profile. Please try logging in again.');
        }
        
        // Generic error
        throw new Error('Failed to save profile. Please try again.');
      }
    },
    onSuccess: async () => {
      console.log('[useSaveCallerUserProfile] Invalidating and refetching profile queries');
      // Invalidate and immediately refetch to ensure UI transitions properly
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

// Fetch user profile by principal (for police to get ambulance contact info)
export function useGetUserProfile(userId: Principal | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<UserProfile | null>({
    queryKey: ['userProfile', userId?.toString()],
    queryFn: async () => {
      if (!actor || !userId) return null;
      try {
        return await actor.getUserProfile(userId);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Can only view your own profile')) {
          console.error('Authorization error fetching user profile:', errorMessage);
          return null;
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching && !!userId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Ambulance Location Queries
export function useUpdateAmbulanceLocation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coordinates: Coordinates) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateAmbulanceLocation(coordinates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambulanceLocations'] });
      queryClient.invalidateQueries({ queryKey: ['allAmbulanceLocations'] });
    },
  });
}

// Police Location Queries
export function useUpdatePoliceLocation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coordinates: Coordinates) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updatePoliceLocation(coordinates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policeLocations'] });
    },
  });
}

export function useGetLocationsInRadius(center: Coordinates | null, radius: number) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<AmbulanceLocation[]>({
    queryKey: ['ambulanceLocations', center, radius],
    queryFn: async () => {
      if (!actor || !center) return [];
      return actor.getLocationsInRadius(center, radius);
    },
    enabled: !!actor && !actorFetching && !!center,
    refetchInterval: LOCATION_UPDATE_INTERVAL, // Poll every 12 seconds for live updates
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Police query to get ALL ambulance locations (not radius-limited)
export function useGetAllAmbulanceLocations() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<AmbulanceLocation[]>({
    queryKey: ['allAmbulanceLocations'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllAmbulanceLocations();
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Only police')) {
          console.error('Authorization error fetching all ambulance locations:', errorMessage);
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: POLICE_REFRESH_INTERVAL, // Poll every 5 seconds for faster updates
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

// Combined ambulance radar data (locations + contacts)
export function useGetAmbulanceContactsInRadius(center: Coordinates | null, radius: number) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<AmbulanceContact[]>({
    queryKey: ['ambulanceContacts', center, radius],
    queryFn: async () => {
      if (!actor || !center) return [];
      try {
        return actor.getAmbulanceContactsInRadius(center, radius);
      } catch (error: any) {
        // Handle authorization errors gracefully
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Only police')) {
          console.error('Authorization error fetching ambulance contacts:', errorMessage);
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching && !!center,
    refetchInterval: LOCATION_UPDATE_INTERVAL, // Poll every 12 seconds for live updates
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// SOS Alert Queries
export function useTriggerSOS() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coordinates: Coordinates) => {
      if (!actor) throw new Error('Actor not available');
      return actor.triggerSOS(coordinates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sosAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['mySOSAlert'] });
    },
  });
}

export function useDeactivateSOS() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.deactivateSOS();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sosAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['mySOSAlert'] });
    },
  });
}

export function useGetActiveSOSAlerts() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<SOSAlert[]>({
    queryKey: ['sosAlerts'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getActiveSOSAlerts();
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: POLICE_REFRESH_INTERVAL, // Poll every 5 seconds for live updates
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

// Get the current user's SOS alert (for ambulance interface)
export function useGetMySOSAlert() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<SOSAlert | null>({
    queryKey: ['mySOSAlert'],
    queryFn: async () => {
      if (!actor || !identity) return null;
      try {
        const ambulanceId = identity.getPrincipal();
        return await actor.getSOSAlert(ambulanceId);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized')) {
          console.error('Authorization error fetching SOS alert:', errorMessage);
          return null;
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching && !!identity,
    refetchInterval: POLICE_REFRESH_INTERVAL, // Poll every 5 seconds for live updates
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

// Ambulance logout mutation
export function useAmbulanceLogout() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      console.log('[useAmbulanceLogout] Calling ambulanceLogout...');
      await actor.ambulanceLogout();
      console.log('[useAmbulanceLogout] Logout successful');
    },
    onSuccess: () => {
      console.log('[useAmbulanceLogout] Invalidating location and SOS queries');
      queryClient.invalidateQueries({ queryKey: ['ambulanceLocations'] });
      queryClient.invalidateQueries({ queryKey: ['allAmbulanceLocations'] });
      queryClient.invalidateQueries({ queryKey: ['sosAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['mySOSAlert'] });
    },
  });
}
