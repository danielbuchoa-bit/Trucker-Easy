import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import truckerEasyLogo from '@/assets/trucker-easy-logo-gold.png';
import screenMap from '@/assets/promo/screen-map.png';
import screenStops from '@/assets/promo/screen-stops.png';
import screenNavigation from '@/assets/promo/screen-navigation.png';
import screenCommunity from '@/assets/promo/screen-community.png';
import { PRO_PLAN, formatPrice, calculateAnnualSavings } from '@/lib/subscriptionTiers';
import {
  Navigation, MapPin, Shield, Users, Star, Fuel,
  CloudSun, Gauge, Check, ArrowRight, Smartphone,
  ChevronDown, Truck, Route, Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Website = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleStartTrial = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth?redirect=checkout');
        return;
      }

      const priceId = billingCycle === 'annual' 
        ? 'price_1SyR2d2MEO38NbGnIOso9kgl' 
        : 'price_1SyR2S2MEO38NbGnf4yYBL5b';

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Error starting checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  }, [billingCycle, navigate]);

  const features = [
    { icon: Navigation, title: 'Truck-Aware GPS', description: 'Routes optimized for height, weight, and length restrictions. Never worry about low bridges again.' },
    { icon: MapPin, title: 'Truck-Only POIs', description: 'Find truck stops, rest areas, weigh stations, and truck-friendly gas stations instantly.' },
    { icon: Shield, title: 'Safe Routes', description: 'AI-powered route planning that avoids restricted roads, hazards, and truck-prohibited zones.' },
    { icon: Users, title: 'Driver Community', description: 'Real-time reports from fellow truckers on road conditions, parking availability, and hazards.' },
    { icon: Fuel, title: 'Smart Fuel Stops', description: 'Find the cheapest diesel along your route and track your fuel expenses effortlessly.' },
    { icon: CloudSun, title: 'Weather & Traffic', description: 'Real-time weather alerts and traffic updates so you can plan ahead and stay safe.' },
    { icon: Star, title: 'Ratings & Reviews', description: 'Rate and review truck stops, facilities, and shippers. Help the community make better decisions.' },
    { icon: Gauge, title: 'DOT HOS Tracker', description: 'Monitor your hours of service in real-time with smart alerts before you hit your limits.' },
  ];

  const screenshots = [
    { src: screenMap, alt: 'Navigation map view', label: 'Smart Navigation' },
    { src: screenStops, alt: 'Truck stops finder', label: 'Find Stops' },
    { src: screenNavigation, alt: 'Turn-by-turn navigation', label: 'Turn-by-Turn' },
    { src: screenCommunity, alt: 'Driver community', label: 'Community' },
  ];

  const price = billingCycle === 'monthly' ? PRO_PLAN.monthly.amount : PRO_PLAN.annual.amount;
  const monthlyEquiv = billingCycle === 'annual' ? Math.round(PRO_PLAN.annual.amount / 12) : PRO_PLAN.monthly.amount;
  const savings = calculateAnnualSavings();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src={truckerEasyLogo} alt="TruckerEasy" className="w-10 h-10 object-contain" />
            <span className="font-bold text-lg tracking-wide text-primary">TruckerEasy</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#screenshots" className="hover:text-primary transition-colors">App</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </div>
          <Button onClick={handleStartTrial} disabled={checkoutLoading} className="metallic-gradient text-primary-foreground font-semibold border-0">
            Get Started <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 circuit-pattern opacity-40" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary rounded-full blur-[250px] opacity-8" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent rounded-full blur-[200px] opacity-5" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-medium mb-6">
                <Truck className="w-4 h-4" />
                Built by truckers, for truckers
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
                Your Road
                <span className="block text-primary drop-shadow-[0_0_20px_hsl(42_78%_50%/0.3)]">Companion</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-8">
                Professional trucking technology with truck-aware GPS, community-powered insights, and everything you need on the road.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="lg"
                  onClick={handleStartTrial}
                  disabled={checkoutLoading}
                  className="metallic-gradient text-primary-foreground text-lg px-8 py-6 border-0 font-semibold glow-steel hover:glow-steel-strong"
                >
                  Start {PRO_PLAN.trial_days}-Day Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-lg px-8 py-6 border-primary/30 text-primary hover:bg-primary/10"
                >
                  Learn More
                  <ChevronDown className="w-5 h-5 ml-2" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">No credit card required • Cancel anytime</p>
            </div>

            {/* Hero phone mockup */}
            <div className="relative flex justify-center">
              <div className="relative w-[280px] sm:w-[300px]">
                <div className="absolute inset-0 bg-primary/15 rounded-[2.5rem] blur-xl scale-105" />
                <div className="relative bg-card rounded-[2.5rem] border-2 border-primary/20 overflow-hidden shadow-2xl shadow-primary/10">
                  <div className="h-6 bg-card flex items-center justify-center">
                    <div className="w-20 h-1.5 bg-border rounded-full" />
                  </div>
                  <img src={screenMap} alt="TruckerEasy Navigation" className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-primary/10 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: '50K+', label: 'Active Drivers' },
            { value: '100K+', label: 'Truck Stops Rated' },
            { value: '4.8★', label: 'App Rating' },
            { value: '24/7', label: 'Community Reports' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need on the Road</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Professional tools designed specifically for truck drivers, all in one app.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-card/60 border-primary/10 hover:border-primary/30 transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* App Screenshots */}
      <section id="screenshots" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">See It in Action</h2>
            <p className="text-lg text-muted-foreground">A glimpse of the TruckerEasy experience</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {screenshots.map((screen) => (
              <div key={screen.label} className="text-center group">
                <div className="relative rounded-2xl overflow-hidden border border-primary/10 shadow-lg group-hover:shadow-primary/20 transition-shadow duration-300 mb-3">
                  <img src={screen.src} alt={screen.alt} className="w-full" loading="lazy" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{screen.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground mb-8">One plan, everything included. Start with a free trial.</p>

            {/* Billing toggle */}
            <div className="inline-flex items-center bg-card border border-primary/15 rounded-full p-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingCycle === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Annual
                <span className="ml-1.5 text-xs opacity-80">Save {formatPrice(savings)}</span>
              </button>
            </div>
          </div>

          {/* Pricing Card */}
          <Card className="relative overflow-hidden border-primary/20 bg-card">
            <div className="absolute top-0 left-0 right-0 h-1 metallic-gradient" />
            <CardContent className="p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    PRO Plan
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {PRO_PLAN.trial_days}-day free trial
                    </span>
                  </h3>
                  <p className="text-muted-foreground mt-1">Full access to all features</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-primary">{formatPrice(monthlyEquiv)}<span className="text-lg text-muted-foreground font-normal">/mo</span></p>
                  {billingCycle === 'annual' && (
                    <p className="text-sm text-muted-foreground">Billed {formatPrice(price)}/year</p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {PRO_PLAN.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                onClick={handleStartTrial}
                disabled={checkoutLoading}
                className="w-full metallic-gradient text-primary-foreground text-lg py-6 border-0 font-semibold glow-steel hover:glow-steel-strong"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-3">No credit card required • Cancel anytime</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 circuit-pattern opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <Route className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Hit the Road Smarter?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of professional drivers who trust TruckerEasy for safer, more efficient routes.
          </p>
          <Button
            size="lg"
            onClick={handleStartTrial}
            disabled={checkoutLoading}
            className="metallic-gradient text-primary-foreground text-lg px-10 py-6 border-0 font-semibold glow-steel hover:glow-steel-strong"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-card/30 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={truckerEasyLogo} alt="TruckerEasy" className="w-8 h-8 object-contain" />
              <span className="font-bold text-primary">TruckerEasy Technologies</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate('/privacy')} className="hover:text-primary transition-colors">
                Privacy Policy
              </button>
              <a href="mailto:support@truckereasy.com" className="hover:text-primary transition-colors">
                Contact
              </a>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TruckerEasy Technologies</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Website;
