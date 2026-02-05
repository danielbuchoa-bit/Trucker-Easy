import React, { useEffect, useRef, useState } from 'react';
import { useEmotionalCheckIn } from '@/contexts/EmotionalCheckInContext';
import { useActiveNavigation } from '@/contexts/ActiveNavigationContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Invisible component that triggers check-in prompts based on context:
 * - Morning: First app open of the day (truck stopped)
 * - Evening: After navigation ends or prolonged stop
 * Only triggers for authenticated users.
 */
const CheckInTrigger: React.FC = () => {
  const { 
    shouldShowMorningCheckIn, 
    shouldShowEveningCheckIn,
    openMorningCheckIn,
    openEveningCheckIn,
    isCheckInModalOpen
  } = useEmotionalCheckIn();
  
  const { isNavigating, userPosition } = useActiveNavigation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const hasTriggeredMorning = useRef(false);
  const hasTriggeredEvening = useRef(false);
  const navigationEndedRef = useRef(false);

  // Use centralized auth state - only consider authenticated after loading completes
  const isAuthenticated = !isAuthLoading && !!user;

  // Determine if truck is stopped (speed < 5 km/h or no speed data)
  const isTruckStopped = !userPosition?.speed || userPosition.speed < 5;

  // Morning check-in: First app open, truck stopped, not navigating, authenticated
  useEffect(() => {
    // Don't trigger anything while auth is still loading
    if (isAuthLoading) return;
    
    if (
      isAuthenticated &&
      shouldShowMorningCheckIn && 
      !hasTriggeredMorning.current && 
      !isNavigating && 
      isTruckStopped &&
      !isCheckInModalOpen
    ) {
      // Small delay to ensure app is fully loaded
      const timer = setTimeout(() => {
        openMorningCheckIn();
        hasTriggeredMorning.current = true;
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthLoading, isAuthenticated, shouldShowMorningCheckIn, isNavigating, isTruckStopped, openMorningCheckIn, isCheckInModalOpen]);

  // Track navigation end
  useEffect(() => {
    if (!isNavigating && navigationEndedRef.current === false) {
      // Navigation was active and now ended
      navigationEndedRef.current = true;
    }
  }, [isNavigating]);

  // Evening check-in: After navigation ends, truck stopped, authenticated
  useEffect(() => {
    // Don't trigger anything while auth is still loading
    if (isAuthLoading) return;
    
    if (
      isAuthenticated &&
      shouldShowEveningCheckIn && 
      !hasTriggeredEvening.current && 
      !isNavigating && 
      isTruckStopped &&
      navigationEndedRef.current &&
      !isCheckInModalOpen
    ) {
      // Delay to let driver settle
      const timer = setTimeout(() => {
        openEveningCheckIn();
        hasTriggeredEvening.current = true;
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthLoading, isAuthenticated, shouldShowEveningCheckIn, isNavigating, isTruckStopped, openEveningCheckIn, isCheckInModalOpen]);

  // Reset triggers on new day
  useEffect(() => {
    const checkNewDay = () => {
      const today = new Date().toDateString();
      const lastCheck = localStorage.getItem('checkin_trigger_date');
      
      if (lastCheck !== today) {
        hasTriggeredMorning.current = false;
        hasTriggeredEvening.current = false;
        navigationEndedRef.current = false;
        localStorage.setItem('checkin_trigger_date', today);
      }
    };
    
    checkNewDay();
    const interval = setInterval(checkNewDay, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  return null; // Invisible component
};

export default CheckInTrigger;
