import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, FileText, Star, Heart, TrendingUp, Search, 
  ChevronRight, Shield, Loader2, AlertCircle, RefreshCw, 
  CreditCard, Crown, Gem, Apple, Smartphone, Filter, History,
  Fuel, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface UserSummary {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  subscription: {
    status: string;
    plan_tier: string;
    provider: string;
    current_period_end: string | null;
  } | null;
  total_reports: number;
  total_facility_ratings: number;
  total_stop_ratings: number;
  total_poi_feedback: number;
  total_checkins: number;
  total_messages: number;
  total_activity: number;
}

interface PlatformStats {
  total_users: number;
  total_reports: number;
  total_ratings: number;
  total_checkins: number;
  subscriptions: {
    total_active: number;
    by_tier: { silver: number; gold: number; diamond: number };
    by_provider: { stripe: number; apple: number; google: number };
  };
}

interface Subscription {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  plan_tier: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
  profiles: { email: string; full_name: string | null };
}

interface AuditLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin: { email: string; full_name: string | null };
}

interface GasStationRating {
  id: string;
  type: 'gas_station';
  poi_name: string;
  poi_type: string;
  brand: string;
  avg_rating: number;
  friendliness: number;
  cleanliness: number;
  recommendation: number;
  structure: number | null;
  would_return: boolean | null;
  driver_name: string;
  driver_id: string;
  created_at: string;
}

interface FacilityRating {
  id: string;
  type: 'facility';
  facility_name: string;
  facility_type: string;
  facility_address: string | null;
  overall_rating: number;
  treatment: number | null;
  speed: number | null;
  staff_help: number | null;
  parking: number | null;
  exit_ease: number | null;
  visit_type: string;
  time_spent: string | null;
  tips: string | null;
  driver_name: string;
  driver_id: string;
  created_at: string;
}

interface BrandAverage {
  brand: string;
  avg_rating: number;
  total_reviews: number;
}

const TIER_COLORS: Record<string, string> = {
  silver: 'bg-slate-400',
  gold: 'bg-yellow-500',
  diamond: 'bg-cyan-500',
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="w-4 h-4" />,
  apple: <Apple className="w-4 h-4" />,
  google: <Smartphone className="w-4 h-4" />,
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: 'default',
  trialing: 'secondary',
  past_due: 'destructive',
  canceled: 'outline',
  expired: 'outline',
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [gasStationRatings, setGasStationRatings] = useState<GasStationRating[]>([]);
  const [facilityRatings, setFacilityRatings] = useState<FacilityRating[]>([]);
  const [brandAverages, setBrandAverages] = useState<BrandAverage[]>([]);
  const [ratingsDriverFilter, setRatingsDriverFilter] = useState<string>('all');
  const [ratingsSubTab, setRatingsSubTab] = useState<'gas_stations' | 'facilities' | 'brands'>('gas_stations');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('users');
  
  // Subscription filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const fetchAdminData = async (action: string, params?: Record<string, string>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    const queryParams = new URLSearchParams({ action, ...params });
    const response = await fetch(`${baseUrl}/functions/v1/admin_data?${queryParams}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch data');
    return response.json();
  };

  const checkAdminAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadData();
    } catch (error) {
      console.error('Admin check error:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [statsData, usersData] = await Promise.all([
        fetchAdminData('stats'),
        fetchAdminData('summary'),
      ]);

      setStats(statsData);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Error loading data');
    }
  };

  const loadSubscriptions = async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (providerFilter !== 'all') params.provider = providerFilter;
      if (tierFilter !== 'all') params.tier = tierFilter;
      
      const data = await fetchAdminData('subscriptions', params);
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error('Load subscriptions error:', error);
      toast.error('Error loading subscriptions');
    }
  };

  const loadAuditLogs = async () => {
    try {
      const data = await fetchAdminData('audit_log');
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error('Load audit logs error:', error);
      toast.error('Error loading audit logs');
    }
  };

  const loadRatings = async () => {
    try {
      const data = await fetchAdminData('ratings');
      setGasStationRatings(data.gas_station_ratings || []);
      setFacilityRatings(data.facility_ratings || []);
      setBrandAverages(data.brand_averages || []);
    } catch (error) {
      console.error('Load ratings error:', error);
      toast.error('Error loading ratings');
    }
  };

  useEffect(() => {
    if (isAdmin && selectedTab === 'subscriptions') {
      loadSubscriptions();
    }
  }, [isAdmin, selectedTab, statusFilter, providerFilter, tierFilter]);

  useEffect(() => {
    if (isAdmin && selectedTab === 'audit') {
      loadAuditLogs();
    }
    if (isAdmin && selectedTab === 'ratings') {
      loadRatings();
    }
  }, [isAdmin, selectedTab]);

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Shield className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-center mb-6">
          You don't have permission to access this area.
        </p>
        <Button onClick={() => navigate('/home')}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={loadData}>
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total_users}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Crown className="w-8 h-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.subscriptions?.total_active || 0}</p>
                    <p className="text-xs text-muted-foreground">Active Subs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total_reports}</p>
                    <p className="text-xs text-muted-foreground">Reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Heart className="w-8 h-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total_checkins}</p>
                    <p className="text-xs text-muted-foreground">Check-ins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Subscription Breakdown */}
        {stats?.subscriptions && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Subscription Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 justify-around">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Shield className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold">{stats.subscriptions.by_tier.silver}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Silver</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold">{stats.subscriptions.by_tier.gold}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Gold</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Gem className="w-4 h-4 text-cyan-500" />
                    <span className="font-semibold">{stats.subscriptions.by_tier.diamond}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Diamond</span>
                </div>
              </div>
              <div className="flex gap-4 justify-around mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span className="font-semibold">{stats.subscriptions.by_provider.stripe}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Stripe</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Apple className="w-4 h-4" />
                    <span className="font-semibold">{stats.subscriptions.by_provider.apple}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Apple</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Smartphone className="w-4 h-4" />
                    <span className="font-semibold">{stats.subscriptions.by_provider.google}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Google</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="ratings">Ratings</TabsTrigger>
            <TabsTrigger value="subscriptions">Subs</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No users found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredUsers.slice(0, 50).map((user) => (
                  <Card key={user.id} className="cursor-pointer hover:border-primary/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                          {user.subscription && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={`${TIER_COLORS[user.subscription.plan_tier]} text-white text-xs`}>
                                {user.subscription.plan_tier}
                              </Badge>
                              {PROVIDER_ICONS[user.subscription.provider]}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="mb-1">
                            {user.total_activity} activity
                          </Badge>
                          <div className="flex gap-1 text-xs text-muted-foreground">
                            <span>📋{user.total_reports}</span>
                            <span>⭐{user.total_facility_ratings + user.total_stop_ratings}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Ratings Tab */}
          <TabsContent value="ratings" className="space-y-4">
            {/* Sub-tabs */}
            <Tabs value={ratingsSubTab} onValueChange={(v) => setRatingsSubTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="gas_stations" className="text-xs">
                  <Fuel className="w-3 h-3 mr-1" />
                  Gas Stations
                </TabsTrigger>
                <TabsTrigger value="facilities" className="text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  Facilities
                </TabsTrigger>
                <TabsTrigger value="brands" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Brands
                </TabsTrigger>
              </TabsList>

              {/* Driver filter */}
              {ratingsSubTab !== 'brands' && (
                <div className="mt-3">
                  <Select value={ratingsDriverFilter} onValueChange={setRatingsDriverFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drivers</SelectItem>
                      {Array.from(new Set(
                        [...gasStationRatings, ...facilityRatings].map(r => r.driver_id)
                      )).map(driverId => {
                        const name = [...gasStationRatings, ...facilityRatings].find(r => r.driver_id === driverId)?.driver_name || driverId;
                        return (
                          <SelectItem key={driverId} value={driverId}>{name}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Gas Stations sub-tab */}
              <TabsContent value="gas_stations" className="space-y-3 mt-2">
                {gasStationRatings
                  .filter(r => ratingsDriverFilter === 'all' || r.driver_id === ratingsDriverFilter)
                  .length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Fuel className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No gas station ratings yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  gasStationRatings
                    .filter(r => ratingsDriverFilter === 'all' || r.driver_id === ratingsDriverFilter)
                    .map((r) => (
                      <Card key={r.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Fuel className="w-4 h-4 text-primary flex-shrink-0" />
                                <p className="font-medium truncate">{r.poi_name}</p>
                              </div>
                              <Badge variant="outline" className="text-xs mb-2">{r.brand}</Badge>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                                <span>Friendliness: <strong className="text-foreground">{r.friendliness}</strong>/5</span>
                                <span>Cleanliness: <strong className="text-foreground">{r.cleanliness}</strong>/5</span>
                                <span>Recommendation: <strong className="text-foreground">{r.recommendation}</strong>/5</span>
                                {r.structure !== null && <span>Structure: <strong className="text-foreground">{r.structure}</strong>/5</span>}
                              </div>
                              {r.would_return !== null && (
                                <p className="text-xs mt-1">
                                  Would return: <strong className={r.would_return ? 'text-green-500' : 'text-destructive'}>{r.would_return ? 'Yes' : 'No'}</strong>
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <div className="flex items-center gap-1 mb-1">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-bold">{r.avg_rating}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{r.driver_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(r.created_at), 'dd/MM/yy')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </TabsContent>

              {/* Facilities sub-tab */}
              <TabsContent value="facilities" className="space-y-3 mt-2">
                {facilityRatings
                  .filter(r => ratingsDriverFilter === 'all' || r.driver_id === ratingsDriverFilter)
                  .length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No facility ratings yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  facilityRatings
                    .filter(r => ratingsDriverFilter === 'all' || r.driver_id === ratingsDriverFilter)
                    .map((r) => (
                      <Card key={r.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                                <p className="font-medium truncate">{r.facility_name}</p>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">{r.facility_type}</Badge>
                                <Badge variant="secondary" className="text-xs">{r.visit_type}</Badge>
                              </div>
                              {r.facility_address && (
                                <p className="text-xs text-muted-foreground mb-2 truncate">{r.facility_address}</p>
                              )}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {r.treatment !== null && <span>Treatment: <strong className="text-foreground">{r.treatment}</strong>/5</span>}
                                {r.speed !== null && <span>Speed: <strong className="text-foreground">{r.speed}</strong>/5</span>}
                                {r.staff_help !== null && <span>Staff: <strong className="text-foreground">{r.staff_help}</strong>/5</span>}
                                {r.parking !== null && <span>Parking: <strong className="text-foreground">{r.parking}</strong>/5</span>}
                                {r.exit_ease !== null && <span>Exit ease: <strong className="text-foreground">{r.exit_ease}</strong>/5</span>}
                              </div>
                              {r.tips && (
                                <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">💡 {r.tips}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <div className="flex items-center gap-1 mb-1">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-bold">{r.overall_rating}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{r.driver_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(r.created_at), 'dd/MM/yy')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </TabsContent>

              {/* Brands sub-tab */}
              <TabsContent value="brands" className="space-y-3 mt-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Average Rating by Brand</h3>
                {brandAverages.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No brand data yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  brandAverages.map((b) => (
                    <Card key={b.brand}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Fuel className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{b.brand}</p>
                              <p className="text-xs text-muted-foreground">{b.total_reviews} review{b.total_reviews !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            <span className="text-xl font-bold">{b.avg_rating}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="apple">Apple</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {subscriptions.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No subscriptions found</p>
                  </CardContent>
                </Card>
              ) : (
                subscriptions.map((sub) => (
                  <Card key={sub.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{sub.profiles?.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{sub.profiles?.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`${TIER_COLORS[sub.plan_tier]} text-white`}>
                              {sub.plan_tier}
                            </Badge>
                            <Badge variant={STATUS_VARIANTS[sub.status]}>
                              {sub.status}
                            </Badge>
                            {PROVIDER_ICONS[sub.provider]}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {sub.current_period_end && (
                            <p>Ends: {format(new Date(sub.current_period_end), 'MMM d, yyyy')}</p>
                          )}
                          {sub.cancel_at_period_end && (
                            <Badge variant="destructive" className="mt-1">Canceling</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Audit Log
            </h2>
            
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No audit logs found</p>
                  </CardContent>
                </Card>
              ) : (
                auditLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.target_type}{log.target_id ? ` • ${log.target_id.slice(0, 8)}...` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            by {log.admin?.email || 'Unknown'}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
