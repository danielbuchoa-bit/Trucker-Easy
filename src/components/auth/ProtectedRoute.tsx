import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If true, skip subscription check (e.g. for /choose-plan, /subscription/success) */
  skipSubscriptionCheck?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, skipSubscriptionCheck = false }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { isSubscribed, isLoading: subLoading } = useSubscription();
  const location = useLocation();

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user is authenticated but has no active subscription, redirect to choose plan
  if (!skipSubscriptionCheck && !isSubscribed) {
    return <Navigate to="/choose-plan" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
