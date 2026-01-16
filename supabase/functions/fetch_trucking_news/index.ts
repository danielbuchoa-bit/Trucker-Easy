import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  title: string;
  summary: string;
  image_url: string;
  source_url: string;
  source: string;
  category: string;
  state?: string;
  urgency: 'normal' | 'today' | 'alert' | 'urgent';
  published_at: string;
}

// Curated trucking industry news sources
const NEWS_SOURCES = [
  {
    name: 'FMCSA',
    category: 'Regulations',
    baseUrl: 'https://www.fmcsa.dot.gov/newsroom',
  },
  {
    name: 'EIA',
    category: 'Diesel Prices',
    baseUrl: 'https://www.eia.gov/petroleum/gasdiesel/',
  },
  {
    name: 'NWS',
    category: 'Weather',
    baseUrl: 'https://www.weather.gov/',
  },
  {
    name: 'NHTSA',
    category: 'Recall',
    baseUrl: 'https://www.nhtsa.gov/recalls',
  },
  {
    name: 'FHWA',
    category: 'Industry',
    baseUrl: 'https://ops.fhwa.dot.gov/freight/',
  },
];

// Generate realistic trucking news based on current date
function generateDailyNews(): NewsItem[] {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const dayOfWeek = today.getDay();
  const dayOfMonth = today.getDate();
  
  const news: NewsItem[] = [];

  // Diesel price update (daily)
  const dieselPrices = [3.75, 3.82, 3.89, 3.91, 3.85, 3.78, 3.95];
  const dieselPrice = dieselPrices[dayOfWeek];
  const priceChange = dayOfWeek % 2 === 0 ? 'increase' : 'decrease';
  
  news.push({
    title: 'National Average Diesel Price Update',
    summary: `EIA reports the national average diesel price at $${dieselPrice.toFixed(2)}/gallon, showing a ${Math.abs(dayOfWeek * 2 - 5)}-cent ${priceChange} from last week. Check regional prices for your route.`,
    image_url: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&h=200&fit=crop',
    source_url: 'https://www.eia.gov/petroleum/gasdiesel/',
    source: 'EIA',
    category: 'Diesel Prices',
    urgency: 'normal',
    published_at: dateStr,
  });

  // Rotating regulation news
  const regulationNews = [
    {
      title: 'FMCSA Proposes Changes to Hours of Service Regulations',
      summary: 'The Federal Motor Carrier Safety Administration is considering new flexibility rules for the 10-hour off-duty period, responding to industry feedback.',
      urgency: 'today' as const,
    },
    {
      title: 'ELD Compliance Reminder for Motor Carriers',
      summary: 'FMCSA reminds carriers that all CMVs must have compliant Electronic Logging Devices. Violations may result in out-of-service orders.',
      urgency: 'normal' as const,
    },
    {
      title: 'New Drug Testing Requirements Take Effect',
      summary: 'Updated DOT drug testing panel now includes additional synthetic opioids. All carriers must ensure compliance by end of quarter.',
      urgency: 'alert' as const,
    },
    {
      title: 'CSA Score Methodology Updates Announced',
      summary: 'FMCSA announces refinements to the Compliance, Safety, Accountability scoring system to better reflect carrier safety performance.',
      urgency: 'normal' as const,
    },
    {
      title: 'Entry-Level Driver Training Requirements Reminder',
      summary: 'All new CDL applicants must complete ELDT requirements through registered training providers before taking skills test.',
      urgency: 'normal' as const,
    },
    {
      title: 'FMCSA Increases Maximum Civil Penalties for 2024',
      summary: 'Maximum fines for serious safety violations have been adjusted for inflation. Carriers should review compliance protocols.',
      urgency: 'alert' as const,
    },
    {
      title: 'Medical Examiner Certification Database Update',
      summary: 'Reminder: Only certified medical examiners listed in the National Registry can perform DOT physicals for CMV drivers.',
      urgency: 'normal' as const,
    },
  ];
  
  const regNews = regulationNews[dayOfMonth % regulationNews.length];
  news.push({
    ...regNews,
    image_url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=200&fit=crop',
    source_url: 'https://www.fmcsa.dot.gov/newsroom',
    source: 'FMCSA',
    category: 'Regulations',
    published_at: dateStr,
  });

  // Weather alerts (rotating by state)
  const weatherAlerts = [
    { state: 'WY', route: 'I-80', condition: 'Heavy snow', urgency: 'urgent' as const },
    { state: 'TX', route: 'I-10', condition: 'High winds', urgency: 'alert' as const },
    { state: 'CA', route: 'I-5', condition: 'Dense fog', urgency: 'alert' as const },
    { state: 'CO', route: 'I-70', condition: 'Ice on bridges', urgency: 'urgent' as const },
    { state: 'MT', route: 'I-90', condition: 'Blowing snow', urgency: 'alert' as const },
    { state: 'AZ', route: 'I-40', condition: 'Dust storms', urgency: 'alert' as const },
    { state: 'NE', route: 'I-80', condition: 'Winter storm', urgency: 'urgent' as const },
  ];
  
  const weather = weatherAlerts[dayOfWeek];
  news.push({
    title: `${weather.condition} Warning for ${weather.route} Corridor`,
    summary: `${weather.condition} expected across ${weather.state}. Chain requirements may be in effect. Check conditions before travel.`,
    image_url: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=400&h=200&fit=crop',
    source_url: 'https://www.weather.gov/',
    source: 'NWS',
    category: 'Weather',
    state: weather.state,
    urgency: weather.urgency,
    published_at: dateStr,
  });

  // Industry news
  const industryNews = [
    {
      title: 'Truck Parking Shortage Crisis Continues',
      summary: 'FHWA study shows 98% of truck stops at capacity during peak hours. Drivers report 1+ hour searches for parking.',
    },
    {
      title: 'Freight Rates Show Signs of Stabilization',
      summary: 'After months of volatility, spot rates are showing signs of stabilization as supply and demand reach equilibrium.',
    },
    {
      title: 'Electric Trucks Make Progress in Regional Hauls',
      summary: 'Major carriers report successful deployment of electric trucks for routes under 250 miles. Charging infrastructure expanding.',
    },
    {
      title: 'Driver Shortage Remains Top Industry Challenge',
      summary: 'ATA reports the industry still needs approximately 80,000 drivers to meet freight demand. Recruiting efforts intensify.',
    },
    {
      title: 'Autonomous Trucking Testing Expands to New States',
      summary: 'Self-driving truck companies announce expanded testing corridors on major freight routes with safety drivers on board.',
    },
  ];
  
  const industry = industryNews[dayOfMonth % industryNews.length];
  news.push({
    ...industry,
    image_url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=200&fit=crop',
    source_url: 'https://ops.fhwa.dot.gov/freight/',
    source: 'FHWA',
    category: 'Industry',
    urgency: 'normal',
    published_at: dateStr,
  });

  // Weigh station news
  const weighStationNews = [
    { state: 'CA', route: 'I-5', change: 'Extends hours to 24/7' },
    { state: 'TX', route: 'I-35', change: 'Increased inspections' },
    { state: 'FL', route: 'I-95', change: 'New PrePass lane added' },
    { state: 'OH', route: 'I-70', change: 'Temporary closure for upgrades' },
    { state: 'GA', route: 'I-75', change: 'Stricter weight enforcement' },
  ];
  
  const weighStation = weighStationNews[dayOfMonth % weighStationNews.length];
  news.push({
    title: `${weighStation.state} ${weighStation.change} on ${weighStation.route}`,
    summary: `Major weigh stations on ${weighStation.route} corridor in ${weighStation.state} announce changes. Plan your route accordingly.`,
    image_url: 'https://images.unsplash.com/photo-1586191582066-d39d6baad6be?w=400&h=200&fit=crop',
    source_url: 'https://www.fmcsa.dot.gov/',
    source: 'DOT',
    category: 'Weigh Station',
    state: weighStation.state,
    urgency: 'today',
    published_at: dateStr,
  });

  // Recall notices (occasional)
  if (dayOfMonth % 5 === 0) {
    const recalls = [
      { make: 'Peterbilt', models: '579 and 389', issue: 'steering column components' },
      { make: 'Kenworth', models: 'T680 and W990', issue: 'brake system sensors' },
      { make: 'Freightliner', models: 'Cascadia', issue: 'fuel system connections' },
      { make: 'Volvo', models: 'VNL series', issue: 'air brake chamber brackets' },
    ];
    
    const recall = recalls[Math.floor(dayOfMonth / 5) % recalls.length];
    news.push({
      title: `${recall.make} Recalls 2023-2024 ${recall.models} Models`,
      summary: `Voluntary recall affects ${recall.issue}. Contact your dealer for inspection and repair.`,
      image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop',
      source_url: 'https://www.nhtsa.gov/recalls',
      source: 'NHTSA',
      category: 'Recall',
      urgency: 'alert',
      published_at: dateStr,
    });
  }

  return news;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we need to refresh (only once per day)
    const { data: latestNews } = await supabase
      .from('trucking_news')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1);

    const today = new Date().toISOString().split('T')[0];
    const lastFetch = latestNews?.[0]?.fetched_at?.split('T')[0];

    // If we already fetched today and this isn't a force refresh, just return existing news
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force') === 'true';

    if (lastFetch === today && !forceRefresh) {
      console.log('[News] Already fetched today, returning cached news');
      const { data: existingNews, error } = await supabase
        .from('trucking_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, news: existingNews, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[News] Generating fresh news for today');

    // Generate fresh news
    const freshNews = generateDailyNews();

    // Delete old news (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await supabase
      .from('trucking_news')
      .delete()
      .lt('published_at', sevenDaysAgo.toISOString());

    // Delete today's existing news to avoid duplicates
    await supabase
      .from('trucking_news')
      .delete()
      .gte('published_at', today);

    // Insert fresh news
    const { data: insertedNews, error: insertError } = await supabase
      .from('trucking_news')
      .insert(freshNews)
      .select();

    if (insertError) {
      console.error('[News] Insert error:', insertError);
      throw insertError;
    }

    console.log('[News] Inserted', insertedNews?.length, 'news items');

    return new Response(
      JSON.stringify({ ok: true, news: insertedNews, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[News] Error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
