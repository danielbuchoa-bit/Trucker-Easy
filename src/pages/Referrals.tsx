import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Copy, Share2, Mail, MessageSquare, QrCode, Users, DollarSign, Clock, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useReferrals, Referral } from '@/hooks/useReferrals';
import { useLanguage } from '@/i18n/LanguageContext';
import QRCode from '@/components/referral/QRCodeDisplay';

const ReferralsScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const {
    referrals,
    stats,
    loading,
    creating,
    fetchReferrals,
    createInvite,
    getStatusLabel,
    getStatusColor,
    getCycleProgress,
  } = useReferrals();

  const [currentInvite, setCurrentInvite] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  // Set the most recent invite as current
  useEffect(() => {
    if (referrals.length > 0 && !currentInvite) {
      const latestInvite = referrals.find(r => r.status === 'invited');
      if (latestInvite) {
        setCurrentInvite({
          code: latestInvite.invite_code,
          link: latestInvite.invite_link,
        });
      }
    }
  }, [referrals, currentInvite]);

  const handleGenerateInvite = async () => {
    const result = await createInvite();
    if (result) {
      setCurrentInvite({
        code: result.invite_code,
        link: result.invite_link,
      });
      toast({
        title: 'Invite Created!',
        description: 'Share the link or QR code with a friend',
      });
    }
  };

  const handleCopyLink = async () => {
    if (!currentInvite) return;
    
    try {
      await navigator.clipboard.writeText(currentInvite.link);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Link copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!currentInvite) return;

    const shareData = {
      title: 'Join TruckerEasy!',
      text: 'Get the best trucking app! Use my invite link:',
      url: currentInvite.link,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy
        await handleCopyLink();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  const handleSendSMS = () => {
    if (!currentInvite) return;
    const message = encodeURIComponent(`Join TruckerEasy! Use my invite: ${currentInvite.link}`);
    window.open(`sms:?body=${message}`, '_blank');
  };

  const handleSendEmail = () => {
    if (!currentInvite) return;
    const subject = encodeURIComponent('Join TruckerEasy!');
    const body = encodeURIComponent(`Hey!\n\nI've been using TruckerEasy and I think you'd love it too.\n\nUse my invite link to sign up: ${currentInvite.link}\n\nWhen you subscribe and complete 3 payment cycles, I get a discount!\n\nSee you on the road!`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Refer a Friend</h1>
            <p className="text-sm text-muted-foreground">Earn rewards for invites</p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchReferrals} disabled={loading}>
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* How it works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="w-5 h-5 text-primary" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Invite a driver friend. When they subscribe and complete <strong className="text-foreground">3 paid monthly cycles</strong>, 
              both of you get a <strong className="text-primary">50% discount</strong> on your next payment!
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center p-3">
              <div className="text-2xl font-bold text-primary">{stats.total_invites}</div>
              <div className="text-xs text-muted-foreground">Invites</div>
            </Card>
            <Card className="text-center p-3">
              <div className="text-2xl font-bold text-green-500">{stats.rewards_earned}</div>
              <div className="text-xs text-muted-foreground">Rewards</div>
            </Card>
            <Card className="text-center p-3">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.available_credits_cents)}
              </div>
              <div className="text-xs text-muted-foreground">Credits</div>
            </Card>
          </div>
        )}

        {/* Generate / Share Invite */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Invite</CardTitle>
            <CardDescription>Share with friends to earn rewards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentInvite ? (
              <Button 
                onClick={handleGenerateInvite} 
                disabled={creating}
                className="w-full"
                size="lg"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 mr-2" />
                    Generate Invite
                  </>
                )}
              </Button>
            ) : (
              <>
                {/* QR Code */}
                <div className="flex justify-center">
                  <QRCode value={currentInvite.link} size={180} />
                </div>

                {/* Invite Code */}
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Invite Code</div>
                  <div className="text-2xl font-mono font-bold tracking-wider text-primary">
                    {currentInvite.code}
                  </div>
                </div>

                {/* Copy Link */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-lg p-3 text-sm font-mono truncate">
                    {currentInvite.link}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Share Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={handleSendSMS} className="flex-col h-auto py-3">
                    <MessageSquare className="w-5 h-5 mb-1" />
                    <span className="text-xs">SMS</span>
                  </Button>
                  <Button variant="outline" onClick={handleSendEmail} className="flex-col h-auto py-3">
                    <Mail className="w-5 h-5 mb-1" />
                    <span className="text-xs">Email</span>
                  </Button>
                  <Button variant="outline" onClick={handleShare} className="flex-col h-auto py-3">
                    <Share2 className="w-5 h-5 mb-1" />
                    <span className="text-xs">Share</span>
                  </Button>
                </div>

                {/* Generate New */}
                <Button 
                  variant="ghost" 
                  onClick={handleGenerateInvite}
                  disabled={creating}
                  className="w-full"
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
                  Generate New Invite
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5" />
              Your Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No referrals yet</p>
                <p className="text-sm">Share your invite to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <ReferralItem 
                    key={referral.id} 
                    referral={referral}
                    getStatusLabel={getStatusLabel}
                    getStatusColor={getStatusColor}
                    getCycleProgress={getCycleProgress}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface ReferralItemProps {
  referral: Referral;
  getStatusLabel: (status: Referral['status']) => string;
  getStatusColor: (status: Referral['status']) => string;
  getCycleProgress: (status: Referral['status']) => number;
}

const ReferralItem = ({ referral, getStatusLabel, getStatusColor, getCycleProgress }: ReferralItemProps) => {
  const progress = getCycleProgress(referral.status);
  const isCompleted = referral.status === 'reward_earned' || referral.status === 'reward_applied';

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-sm">{referral.invite_code}</div>
          {referral.referred_email && (
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
              {referral.referred_email}
            </div>
          )}
        </div>
        <Badge className={getStatusColor(referral.status)}>
          {getStatusLabel(referral.status)}
        </Badge>
      </div>
      
      {referral.status !== 'invited' && referral.status !== 'invalid' && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center gap-1 text-xs text-green-500">
          <DollarSign className="w-3 h-3" />
          <span>Reward: ${(referral.reward_amount_cents / 100).toFixed(2)}</span>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Created {new Date(referral.created_at).toLocaleDateString()}
      </div>
    </div>
  );
};

export default ReferralsScreen;
