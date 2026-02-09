import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { UserProfile, Coordinates, AmbulanceLocation, SOSAlert } from '../backend';

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
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('trap')) {
          throw new Error('Unable to save profile. Please try logging in again.');
        }
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
    refetchInterval: 3000, // Poll every 3 seconds for live updates
    staleTime: 2000, // Consider data stale after 2 seconds
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
