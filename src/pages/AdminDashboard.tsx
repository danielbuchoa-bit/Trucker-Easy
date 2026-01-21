import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, FileText, Star, Heart, MessageSquare, TrendingUp, Search, ChevronRight, Shield, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface UserSummary {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
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
}

interface UserDetails {
  profile: any;
  reports: any[];
  facility_ratings: any[];
  stop_ratings: any[];
  poi_feedback: any[];
  checkins: any[];
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user is admin
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
      // Load stats and users via edge function
      const [statsRes, usersRes] = await Promise.all([
        supabase.functions.invoke('admin_data', { body: {}, method: 'GET' }),
        supabase.functions.invoke('admin_data', { body: {}, method: 'GET' }),
      ]);

      // Use fetch directly for query params
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const [statsResponse, usersResponse] = await Promise.all([
        fetch(`${baseUrl}/functions/v1/admin_data?action=stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${baseUrl}/functions/v1/admin_data?action=summary`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const loadUserDetails = async (userId: string) => {
    setLoadingDetails(true);
    setSelectedUser(userId);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${baseUrl}/functions/v1/admin_data?action=user_details&userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
      }
    } catch (error) {
      console.error('Load user details error:', error);
      toast.error('Erro ao carregar detalhes');
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredUsers = users.filter(user => 
    (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground text-center mb-6">
          Você não tem permissão para acessar esta área.
        </p>
        <Button onClick={() => navigate('/home')}>Voltar ao Início</Button>
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
            <h1 className="text-lg font-semibold">Dashboard Admin</h1>
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
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total_users}</p>
                    <p className="text-xs text-muted-foreground">Usuários</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-info" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total_reports}</p>
                    <p className="text-xs text-muted-foreground">Reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 text-warning" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total_ratings}</p>
                    <p className="text-xs text-muted-foreground">Avaliações</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Heart className="w-8 h-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total_checkins}</p>
                    <p className="text-xs text-muted-foreground">Check-ins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Usuários ({filteredUsers.length})
          </h2>
          
          {filteredUsers.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((user) => (
              <Card 
                key={user.id} 
                className={`border-border cursor-pointer transition-colors hover:border-primary/50 ${
                  selectedUser === user.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => loadUserDetails(user.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {user.full_name || 'Sem nome'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email || 'Sem email'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Desde {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">
                          {user.total_activity} atividades
                        </Badge>
                        <div className="flex gap-1 text-xs text-muted-foreground">
                          <span title="Reports">📋{user.total_reports}</span>
                          <span title="Avaliações">⭐{user.total_facility_ratings + user.total_stop_ratings}</span>
                          <span title="Check-ins">💚{user.total_checkins}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* User Details Panel */}
        {selectedUser && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Detalhes do Usuário</h2>
            
            {loadingDetails ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : userDetails ? (
              <div className="space-y-4">
                {/* Reports */}
                {userDetails.reports.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Reports ({userDetails.reports.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto">
                      {userDetails.reports.slice(0, 10).map((report: any) => (
                        <div key={report.id} className="py-2 border-b border-border last:border-0 text-sm">
                          <p className="font-medium">{report.report_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(report.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Facility Ratings */}
                {userDetails.facility_ratings.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="w-4 h-4" />
                        Avaliações de Facilities ({userDetails.facility_ratings.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto">
                      {userDetails.facility_ratings.slice(0, 10).map((rating: any) => (
                        <div key={rating.id} className="py-2 border-b border-border last:border-0 text-sm">
                          <p className="font-medium">{rating.facility_name}</p>
                          <p className="text-xs">⭐ {rating.overall_rating}/5</p>
                          {rating.comment && <p className="text-xs text-muted-foreground mt-1">"{rating.comment}"</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Emotional Check-ins */}
                {userDetails.checkins.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4" />
                        Check-ins Emocionais ({userDetails.checkins.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto">
                      {userDetails.checkins.slice(0, 10).map((checkin: any) => (
                        <div key={checkin.id} className="py-2 border-b border-border last:border-0 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{checkin.checkin_type === 'morning' ? '☀️' : '🌙'}</span>
                            <span>Energia: {checkin.energy_level}/5</span>
                            <span>Estresse: {checkin.stress_level}/5</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(checkin.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                          {checkin.notes && <p className="text-xs text-muted-foreground mt-1">"{checkin.notes}"</p>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
