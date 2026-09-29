import { Outlet } from 'react-router-dom';
import { atom, useAtom, useSetAtom } from 'jotai';
import { Box, CircularProgress } from '@mui/material';
import { styled } from '@mui/system';
import { useIframe } from '../hooks/useIframeListener';
import { useInitializeProfile } from '../hooks/useInitializeProfile';
import { useInitializeName } from '../hooks/useInitializeName';
import { useInitializeOwnedGroups } from '../hooks/useInitializeOwnedGroups';
import {
  hasProfileAtom,
  isLoadingProfileAtom,
  profileNameAtom,
} from '../state/global/profile';
import { RefObject, useEffect, useRef } from 'react';
import { useGlobal } from 'qapp-core';
import { useFollowingStorage } from '../hooks/useFollowingStorage';
import { useNotificationStorage } from '../hooks/useNotificationStorage';
import { useInitializePublicNode } from '../hooks/useInitializePublicNode';
import { useInitializeNotificationPermission } from '../hooks/useInitializeNotificationPermission';
import { useMentionNotificationRegistration } from '../hooks/useMentionNotificationRegistration';

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: 'var(--torq-app-height)',
  backgroundColor: theme.palette.background.default,
}));
export const scrollRefAtom = atom<RefObject<HTMLElement> | null>(null);

const Layout = () => {
  useIframe();
  const { auth } = useGlobal();
  const setScrollRef = useSetAtom(scrollRefAtom);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    // Attach scrollRef to the body element where scrolling happens
    scrollRef.current = document.body;
    setScrollRef(scrollRef);
  }, [setScrollRef]);

  // Initialize profile from IndexedDB cache on mount
  useInitializeProfile();

  // Check for preferred name and auto-switch before loading the app
  const { isCheckingName } = useInitializeName();

  // Initialize owned groups when auth address is available
  useInitializeOwnedGroups();

  // Initialize following storage background sync
  useFollowingStorage();

  // Initialize notification storage background sync
  useNotificationStorage();

  // Initialize public node status
  useInitializePublicNode();

  // Request notification permission when user is authenticated
  useInitializeNotificationPermission();

  // Register for push notifications when someone mentions the user
  useMentionNotificationRegistration();

  // Show loading indicator while authentication is in progress
  if (auth?.isLoadingUser) {
    return (
      <LoadingContainer>
        <CircularProgress size={48} />
      </LoadingContainer>
    );
  }

  // Show loading indicator while checking for name (only if authenticated)
  if (auth?.name && isCheckingName) {
    return (
      <LoadingContainer>
        <CircularProgress size={48} />
      </LoadingContainer>
    );
  }

  // Allow access to the app regardless of profile status
  // Users can browse without authentication or profile
  return (
    <>
      {/* Add Header here */}
      <main>
        <Outlet /> {/* This is where page content will be rendered */}
      </main>
      {/* Add Footer here */}
    </>
  );
};

export default Layout;
