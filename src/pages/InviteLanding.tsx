import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Gift, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useReferrals } from '@/hooks/useReferrals';

const InviteLanding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code');
  const { redeemInvite } = useReferrals();
  
  const [status, setStatus] = useState<'loading' | 'checking' | 'needs_auth' | 'redeeming' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthAndRedeem = async () => {
      if (!inviteCode) {
        setStatus('error');
        setError('No invite code provided');
        return;
      }

      // Store invite code in localStorage for later redemption
      localStorage.setItem('pending_invite_code', inviteCode);
      
      setStatus('checking');
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAuthenticated(false);
        setStatus('needs_auth');
        return;
      }

      setIsAuthenticated(true);
      setStatus('redeeming');

      // Try to redeem the invite
      const success = await redeemInvite(inviteCode);
      
      if (success) {
        localStorage.removeItem('pending_invite_code');
        setStatus('success');
      } else {
        setStatus('error');
        setError('Could not redeem this invite. It may have already been used or is invalid.');
      }
    };

    checkAuthAndRedeem();
  }, [inviteCode, redeemInvite]);

  const handleSignUp = () => {
    // Navigate to auth with the invite code preserved
    navigate('/auth', { state: { fromInvite: true, inviteCode } });
  };

  const handleContinue = () => {
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            Someone wants you to join TruckerEasy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' || status === 'checking' ? (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Checking invite...</p>
            </div>
          ) : status === 'needs_auth' ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Sign up to redeem your invite and start using TruckerEasy!
              </p>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Invite Code</div>
                <div className="font-mono font-bold text-lg">{inviteCode}</div>
              </div>
              <Button onClick={handleSignUp} className="w-full" size="lg">
                Sign Up to Redeem
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <button 
                  onClick={() => navigate('/auth')} 
                  className="text-primary underline"
                >
                  Log in
                </button>
              </p>
            </div>
          ) : status === 'redeeming' ? (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Redeeming invite...</p>
            </div>
          ) : status === 'success' ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4">
                <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                <p className="font-medium">Invite Redeemed!</p>
                <p className="text-sm text-muted-foreground text-center">
                  Welcome to TruckerEasy! Your referrer will earn a reward when you complete 3 payment cycles.
                </p>
              </div>
              <Button onClick={handleContinue} className="w-full" size="lg">
                Continue to App
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4">
                <XCircle className="w-12 h-12 text-destructive mb-3" />
                <p className="font-medium">Oops!</p>
                <p className="text-sm text-muted-foreground text-center">
                  {error || 'Something went wrong'}
                </p>
              </div>
              <Button onClick={handleContinue} className="w-full" variant="outline">
                Continue to App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteLanding;
