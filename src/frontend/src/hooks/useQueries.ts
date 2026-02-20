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
      console.log('[useGetCallerUserProfile] ========== Query function called ==========');
      console.log('[useGetCallerUserProfile] Query context:', {
        hasActor: !!actor,
        actorFetching,
        hasIdentity: !!identity,
        isAnonymous: identity ? Principal.anonymous().toString() === identity.getPrincipal().toString() : true,
        identityPrincipal: identity?.getPrincipal().toString(),
        timestamp: new Date().toISOString(),
      });

      if (!actor) {
        console.error('[useGetCallerUserProfile] ❌ Actor not available');
        throw new Error('Actor not available');
      }

      if (!identity) {
        console.error('[useGetCallerUserProfile] ❌ Identity not available');
        throw new Error('Identity not available');
      }

      // Check if user is anonymous
      const isAnonymous = Principal.anonymous().toString() === identity.getPrincipal().toString();
      if (isAnonymous) {
        console.warn('[useGetCallerUserProfile] ⚠️ Anonymous principal detected, returning null');
        return null;
      }

      try {
        console.log('[useGetCallerUserProfile] Calling actor.getCallerUserProfile()...');
        const profile = await actor.getCallerUserProfile();
        console.log('[useGetCallerUserProfile] ✅ Profile fetched successfully:', {
          hasProfile: !!profile,
          profileName: profile?.name,
          profileRole: profile?.role,
          profilePhone: profile?.phoneNumber,
          timestamp: new Date().toISOString(),
        });
        return profile;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        
        console.error('[useGetCallerUserProfile] ❌ Error fetching profile - FULL ERROR DETAILS:', {
          errorType: error?.constructor?.name,
          errorName: error?.name,
          errorMessage,
          errorString: String(error),
          errorStack: error?.stack,
          errorKeys: Object.keys(error || {}),
          errorCode: (error as any)?.code,
          errorStatus: (error as any)?.status,
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
          console.warn('[useGetCallerUserProfile] ⚠️ Authorization error - user may not be set up yet, returning null');
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
    timestamp: new Date().toISOString(),
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && !!identity && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      console.log('[useSaveCallerUserProfile] ========== Mutation started ==========');
      console.log('[useSaveCallerUserProfile] Mutation context:', {
        hasActor: !!actor,
        hasIdentity: !!identity,
        identityPrincipal: identity?.getPrincipal().toString(),
        timestamp: new Date().toISOString(),
      });
      
      if (!actor) {
        console.error('[useSaveCallerUserProfile] ❌ Actor not available');
        throw new Error('Actor not available');
      }
      
      console.log('[useSaveCallerUserProfile] Profile to save:', {
        name: profile.name,
        role: profile.role,
        phoneNumber: profile.phoneNumber,
        phoneLength: profile.phoneNumber.length,
        timestamp: new Date().toISOString(),
      });
      
      try {
        console.log('[useSaveCallerUserProfile] Calling actor.saveCallerUserProfile...');
        await actor.saveCallerUserProfile(profile);
        console.log('[useSaveCallerUserProfile] ✅ Profile saved successfully');
      } catch (error: any) {
        console.error('[useSaveCallerUserProfile] ❌ Error saving profile - FULL ERROR DETAILS:', {
          errorType: error?.constructor?.name,
          errorName: error?.name,
          errorMessage: error?.message,
          errorString: String(error),
          errorStack: error?.stack,
          errorKeys: Object.keys(error || {}),
          errorCode: (error as any)?.code,
          errorStatus: (error as any)?.status,
          errorResponse: (error as any)?.response,
          errorData: (error as any)?.data,
          // Context
          hasActor: !!actor,
          hasIdentity: !!identity,
          identityPrincipal: identity?.getPrincipal().toString(),
          attemptedProfile: profile,
          timestamp: new Date().toISOString(),
        });
        
        // Preserve the original error message from backend
        // The backend sends specific error messages via Runtime.trap()
        throw error;
      }
    },
    onSuccess: async () => {
      console.log('[useSaveCallerUserProfile] ✅ Mutation succeeded, invalidating queries');
      // Invalidate and immediately refetch to ensure UI transitions properly
      await queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      await queryClient.refetchQueries({ queryKey: ['currentUserProfile'] });
      console.log('[useSaveCallerUserProfile] Queries invalidated and refetched');
    },
    onError: (error: any) => {
      console.error('[useSaveCallerUserProfile] ❌ Mutation error callback:', {
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
        errorString: String(error),
        timestamp: new Date().toISOString(),
      });
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
        if (errorMessage.includes('Unauthorized')) {
          console.error('Authorization error fetching ambulance locations:', errorMessage);
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: POLICE_REFRESH_INTERVAL, // Poll every 5 seconds for police interface
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

export function useGetAmbulanceContactsInRadius(center: Coordinates | null, radius: number) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<AmbulanceContact[]>({
    queryKey: ['ambulanceContacts', center, radius],
    queryFn: async () => {
      if (!actor || !center) return [];
      return actor.getAmbulanceContactsInRadius(center, radius);
    },
    enabled: !!actor && !actorFetching && !!center,
    refetchInterval: POLICE_REFRESH_INTERVAL, // Poll every 5 seconds
    staleTime: 4000,
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
      try {
        return await actor.getActiveSOSAlerts();
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized')) {
          console.error('Authorization error fetching SOS alerts:', errorMessage);
          return [];
        }
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: POLICE_REFRESH_INTERVAL, // Poll every 5 seconds for real-time alerts
    staleTime: 4000,
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
        // Use the caller's principal as the alert ID (ambulance ID)
        const myPrincipal = identity.getPrincipal();
        const alert = await actor.getSOSAlert(myPrincipal);
        return alert;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('Unauthorized')) {
          console.error('Authorization error fetching my SOS alert:', errorMessage);
          return null;
        }
        // If no alert found, return null (not an error)
        return null;
      }
    },
    enabled: !!actor && !actorFetching && !!identity,
    refetchInterval: 5000, // Poll every 5 seconds to check SOS status
    staleTime: 4000,
  });
}

// Ambulance logout mutation
export function useAmbulanceLogout() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.ambulanceLogout();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambulanceLocations'] });
      queryClient.invalidateQueries({ queryKey: ['allAmbulanceLocations'] });
      queryClient.invalidateQueries({ queryKey: ['sosAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['mySOSAlert'] });
    },
  });
}
