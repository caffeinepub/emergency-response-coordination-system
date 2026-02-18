import { useEffect, useRef } from 'react';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import { getSecretParameter } from '../utils/urlParams';

const SESSION_KEY = 'caffeineAdminTokenInitialized';

export function useAdminTokenInitialization() {
    const { actor } = useActor();
    const { identity } = useInternetIdentity();
    const hasRunRef = useRef(false);

    useEffect(() => {
        // Only run once per session when actor and identity are ready
        if (!actor || !identity || hasRunRef.current) {
            return;
        }

        // Check if already initialized this session
        const alreadyInitialized = sessionStorage.getItem(SESSION_KEY) === 'true';
        if (alreadyInitialized) {
            hasRunRef.current = true;
            return;
        }

        // Get admin token from URL hash (this clears the hash)
        const adminToken = getSecretParameter('caffeineAdminToken');
        
        if (adminToken) {
            // Run initialization once
            hasRunRef.current = true;
            sessionStorage.setItem(SESSION_KEY, 'true');
            
            actor._initializeAccessControlWithSecret(adminToken).catch((error) => {
                console.error('Admin token initialization failed:', error);
                // Clear session flag on error so it can be retried
                sessionStorage.removeItem(SESSION_KEY);
                hasRunRef.current = false;
            });
        } else {
            // No token present, mark as initialized to prevent repeated checks
            hasRunRef.current = true;
        }
    }, [actor, identity]);
}
