import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { UserProfile, Coordinates, AmbulanceLocation, SOSAlert, AmbulanceContact, AmbulanceId } from '../backend';
import { LOCATION_UPDATE_INTERVAL } from '../utils/locationRefresh';
import { Principal } from '@dfinity/principal';

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      try {
        await actor.saveCallerUserProfile(profile);
      } catch (error: any) {
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
    refetchInterval: LOCATION_UPDATE_INTERVAL, // Poll every 12 seconds for live updates
    staleTime: 10000, // Consider data stale after 10 seconds
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
    refetchInterval: 2000, // Poll every 2 seconds for immediate SOS detection
    staleTime: 1000, // Consider data stale after 1 second
  });
}

export function useGetMySOSAlert() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<SOSAlert | null>({
    queryKey: ['mySOSAlert'],
    queryFn: async () => {
      if (!actor || !identity) return null;
      const principal = identity.getPrincipal();
      return actor.getSOSAlert(principal);
    },
    enabled: !!actor && !actorFetching && !!identity,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}
