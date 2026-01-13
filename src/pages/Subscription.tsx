import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, ArrowLeft, Settings } from "lucide-react";
import { toast } from "sonner";

const PREMIUM_PRODUCT_ID = "prod_TmYpjOgu87jYO9";

export default function Subscription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast.success("Assinatura ativada com sucesso!");
      window.history.replaceState({}, "", "/subscription");
    } else if (canceled === "true") {
      toast.info("Assinatura cancelada");
      window.history.replaceState({}, "", "/subscription");
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        await checkSubscription();
      } else {
        setCheckingSubscription(false);
      }
    };
    checkAuth();
  }, []);

  const checkSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      
      setSubscribed(data.subscribed);
      setSubscriptionEnd(data.subscription_end);
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast.error("Faça login para assinar");
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao iniciar checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Erro ao abrir portal de gerenciamento");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "Navegação GPS otimizada para caminhões",
    "Alertas de estações de pesagem em tempo real",
    "Relatórios de trânsito colaborativos",
    "Avaliações de paradas e restaurantes",
    "Chat entre motoristas ilimitado",
    "Assistente de voz IA",
    "Suporte prioritário 24/7",
    "Sem anúncios",
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <Crown className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">TruckNav Premium</h1>
          <p className="text-muted-foreground">
            Desbloqueie todos os recursos para uma experiência completa na estrada
          </p>
        </div>

        <Card className={`relative overflow-hidden ${subscribed ? 'border-green-500 border-2' : 'border-primary'}`}>
          {subscribed && (
            <Badge className="absolute top-4 right-4 bg-green-500">
              Seu Plano
            </Badge>
          )}
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Premium Mensal</CardTitle>
            <CardDescription>
              <span className="text-4xl font-bold text-foreground">$7.99</span>
              <span className="text-muted-foreground">/mês</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {checkingSubscription ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : subscribed ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 text-green-700 dark:text-green-400 p-4 rounded-lg text-center">
                  <p className="font-medium">✓ Assinatura ativa</p>
                  {subscriptionEnd && (
                    <p className="text-sm mt-1">
                      Renova em: {new Date(subscriptionEnd).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <Button 
                  onClick={handleManageSubscription}
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="mr-2 h-4 w-4" />
                  )}
                  Gerenciar Assinatura
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleSubscribe}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                Assinar Premium
              </Button>
            )}

            <Button 
              variant="ghost" 
              onClick={checkSubscription}
              className="w-full text-sm"
              disabled={checkingSubscription}
            >
              {checkingSubscription ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Atualizar status da assinatura
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Cancele a qualquer momento. Sem compromisso.
        </p>
      </div>
    </div>
  );
}
