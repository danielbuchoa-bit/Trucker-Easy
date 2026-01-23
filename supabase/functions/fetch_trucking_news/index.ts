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

// Hash function for deterministic but varied content
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Generate varied diesel prices based on date
function generateDieselPrice(dateStr: string): { price: number; change: number; direction: string } {
  const hash = hashCode(dateStr + 'diesel');
  const basePrice = 3.50;
  const variation = (hash % 80) / 100; // 0 to 0.79
  const price = basePrice + variation;
  const changeHash = hashCode(dateStr + 'change');
  const change = (changeHash % 15) + 1; // 1-15 cents
  const direction = changeHash % 2 === 0 ? 'increase' : 'decrease';
  return { price: Math.round(price * 100) / 100, change, direction };
}

// Comprehensive news pools for maximum variety
const DIESEL_NEWS_TEMPLATES = [
  { title: 'Weekly Diesel Price Update: {direction} of {change}¢', urgency: 'normal' as const },
  { title: 'EIA Reports Diesel at ${price}/gal - {direction_text}', urgency: 'normal' as const },
  { title: 'Regional Diesel Prices Shift: {region} Sees {direction}', urgency: 'today' as const },
  { title: 'Fuel Costs {direction_text} Heading Into {season}', urgency: 'normal' as const },
  { title: 'Diesel Market Analysis: What Drivers Need to Know', urgency: 'normal' as const },
  { title: 'West Coast Diesel Prices Hit ${price}/gal Average', urgency: 'today' as const },
  { title: 'Midwest Fuel Savings: Diesel Under ${price}/gal', urgency: 'normal' as const },
  { title: 'Gulf Coast Refineries Impact National Diesel Supply', urgency: 'alert' as const },
];

const REGULATION_NEWS = [
  { title: 'FMCSA Proposes New Hours of Service Flexibility', summary: 'Federal regulators considering expanded split-sleeper options for long-haul drivers, responding to industry feedback on fatigue management.', urgency: 'today' as const },
  { title: 'DOT Increases Maximum Civil Penalties for Violations', summary: 'Annual inflation adjustments raise maximum fines for serious safety violations. Carriers urged to review compliance protocols.', urgency: 'alert' as const },
  { title: 'ELD Enforcement Intensifies at Weigh Stations', summary: 'FMCSA reports increase in out-of-service orders for non-compliant electronic logging devices. Check your system compatibility.', urgency: 'alert' as const },
  { title: 'Drug Testing Panel Expanded to Include Fentanyl', summary: 'New DOT rule requires testing for synthetic opioids. All carriers must update testing protocols by compliance deadline.', urgency: 'urgent' as const },
  { title: 'ELDT Requirements Update for New CDL Applicants', summary: 'Entry-Level Driver Training regulations now require enhanced behind-the-wheel hours. Training providers must be registered.', urgency: 'normal' as const },
  { title: 'CSA Score Algorithm Changes Take Effect', summary: 'FMCSA implements new weighting for inspection violations. Check your carrier score for potential changes.', urgency: 'today' as const },
  { title: 'Medical Examiner Registry Updates Announced', summary: 'Reminder: DOT physicals must be performed by certified examiners listed in the National Registry. Verify your examiner status.', urgency: 'normal' as const },
  { title: 'Speed Limiter Mandate Discussion Reopened', summary: 'FMCSA considers requiring speed limiters on heavy trucks. Industry groups weigh in on safety vs. efficiency debate.', urgency: 'today' as const },
  { title: 'Hair Follicle Drug Testing Gains Federal Support', summary: 'FMCSA may recognize hair testing as alternative to urine screening. Longer detection window raises industry questions.', urgency: 'normal' as const },
  { title: 'New Brake Inspection Standards Proposed', summary: 'FMCSA considering stricter brake adjustment standards following safety reviews. Enhanced inspection protocols likely.', urgency: 'alert' as const },
  { title: 'Autonomous Truck Testing Regulations Under Review', summary: 'DOT developing comprehensive framework for self-driving commercial vehicles. Human driver requirements debated.', urgency: 'normal' as const },
  { title: 'California AB5 Enforcement Update for Trucking', summary: 'State agencies clarify independent contractor classification rules. Owner-operators should review compliance status.', urgency: 'alert' as const },
  { title: 'Cross-Border Trucking Requirements Clarified', summary: 'FMCSA updates documentation requirements for Mexico and Canada crossings. Enhanced security protocols in effect.', urgency: 'normal' as const },
  { title: 'Cargo Securement Rules Reminder Issued', summary: 'Increased inspections for load securement violations planned. Review proper tie-down and blocking procedures.', urgency: 'today' as const },
];

const WEATHER_ALERTS = [
  { state: 'WY', route: 'I-80', condition: 'Heavy snow and ice', region: 'Rocky Mountains' },
  { state: 'TX', route: 'I-10', condition: 'High wind advisory', region: 'West Texas' },
  { state: 'CA', route: 'I-5', condition: 'Dense fog warning', region: 'Central Valley' },
  { state: 'CO', route: 'I-70', condition: 'Black ice reported', region: 'Mountain passes' },
  { state: 'MT', route: 'I-90', condition: 'Blowing snow', region: 'Northern Plains' },
  { state: 'AZ', route: 'I-40', condition: 'Dust storm warning', region: 'Desert Southwest' },
  { state: 'NE', route: 'I-80', condition: 'Winter storm warning', region: 'Great Plains' },
  { state: 'WA', route: 'I-90', condition: 'Heavy rain and flooding', region: 'Pacific Northwest' },
  { state: 'UT', route: 'I-15', condition: 'Snow squalls possible', region: 'Wasatch Front' },
  { state: 'MN', route: 'I-94', condition: 'Extreme cold warning', region: 'Upper Midwest' },
  { state: 'PA', route: 'I-80', condition: 'Freezing rain advisory', region: 'Northeast Corridor' },
  { state: 'OR', route: 'I-84', condition: 'Chain requirements', region: 'Columbia Gorge' },
  { state: 'NM', route: 'I-25', condition: 'High wind gusts', region: 'Southwest' },
  { state: 'ID', route: 'I-84', condition: 'Snow and reduced visibility', region: 'Snake River Plain' },
  { state: 'KS', route: 'I-70', condition: 'Severe thunderstorm watch', region: 'Central Plains' },
  { state: 'OK', route: 'I-40', condition: 'Tornado watch issued', region: 'Tornado Alley' },
  { state: 'ND', route: 'I-29', condition: 'Ground blizzard conditions', region: 'Northern Plains' },
  { state: 'MI', route: 'I-94', condition: 'Lake effect snow', region: 'Great Lakes' },
  { state: 'NY', route: 'I-90', condition: 'Heavy lake effect snow', region: 'Western New York' },
  { state: 'FL', route: 'I-10', condition: 'Tropical storm warning', region: 'Gulf Coast' },
];

const INDUSTRY_NEWS = [
  { title: 'Truck Parking Crisis: 98% of Stops at Capacity', summary: 'FHWA study confirms drivers spend over an hour searching for parking during peak hours. Industry pushes for solutions.' },
  { title: 'Freight Rates Stabilizing After Volatile Quarter', summary: 'Spot market rates show signs of equilibrium as supply and demand rebalance. Contract rates remain steady.' },
  { title: 'Electric Trucks Gain Traction in Regional Markets', summary: 'Major carriers deploying electric trucks on routes under 300 miles. Charging infrastructure expanding rapidly.' },
  { title: 'Driver Shortage Reaches 80,000 Nationwide', summary: 'ATA reports persistent driver deficit impacting freight capacity. Recruiting efforts and wages increasing.' },
  { title: 'Autonomous Trucking Tests Expand to New Corridors', summary: 'Self-driving truck companies announce new highway routes. Safety drivers remain on board during testing phase.' },
  { title: 'Fuel Efficiency Standards May Tighten for Heavy Trucks', summary: 'EPA considering stricter emissions rules for Class 8 vehicles. Manufacturers prepare for potential changes.' },
  { title: 'Port Congestion Eases But Delays Persist', summary: 'West Coast ports report improved throughput. Drayage drivers still facing multi-hour waits at some terminals.' },
  { title: 'Insurance Costs Continue Climbing for Carriers', summary: 'Liability premiums up 15% year-over-year. Safety technology adoption may help offset increases.' },
  { title: 'Truck Stop Chains Expanding Amenities for Drivers', summary: 'Major brands investing in fitness centers, lounges, and healthier food options. Driver wellness focus grows.' },
  { title: 'Intermodal Volume Increases on Key Corridors', summary: 'Rail-truck combinations gaining market share on long-haul routes. Cost and emissions benefits drive adoption.' },
  { title: 'Broker Transparency Rules Under Consideration', summary: 'FMCSA reviewing requirements for freight brokers to disclose rate information. Industry groups divided on approach.' },
  { title: 'Truck Manufacturers Report Record Backlogs', summary: 'New truck orders exceed production capacity. Used truck prices remain elevated amid supply constraints.' },
  { title: 'Hydrogen Fuel Cell Trucks Enter Pilot Programs', summary: 'Several carriers testing hydrogen-powered trucks for long-haul routes. Fueling infrastructure remains limited.' },
  { title: 'Driver Training Programs Expand Nationwide', summary: 'Community colleges and private schools report increased CDL enrollment. Federal funding supports workforce development.' },
  { title: 'Freight Tech Startups Attract Major Investment', summary: 'Digital freight matching platforms receive billions in funding. Traditional brokers adapt to changing landscape.' },
  { title: 'Supply Chain Resilience Becomes Top Priority', summary: 'Shippers diversifying carrier relationships and routes. Trucking flexibility valued in uncertain market.' },
];

const WEIGH_STATION_NEWS = [
  { state: 'CA', route: 'I-5', action: 'extends hours to 24/7 operations' },
  { state: 'TX', route: 'I-35', action: 'increases inspection frequency' },
  { state: 'FL', route: 'I-95', action: 'adds new PrePass bypass lanes' },
  { state: 'OH', route: 'I-70', action: 'closes temporarily for upgrades' },
  { state: 'GA', route: 'I-75', action: 'enhances weight enforcement' },
  { state: 'AZ', route: 'I-10', action: 'installs new weigh-in-motion sensors' },
  { state: 'PA', route: 'I-81', action: 'reopens after renovation' },
  { state: 'TN', route: 'I-40', action: 'adds mobile inspection unit' },
  { state: 'IN', route: 'I-65', action: 'updates bypass technology' },
  { state: 'MO', route: 'I-44', action: 'increases staff for peak hours' },
  { state: 'NV', route: 'I-80', action: 'expands parking capacity' },
  { state: 'WA', route: 'I-5', action: 'implements new screening protocols' },
  { state: 'IL', route: 'I-55', action: 'conducts targeted safety blitz' },
  { state: 'NC', route: 'I-85', action: 'adds hazmat inspection capability' },
  { state: 'NJ', route: 'I-95', action: 'upgrades scale equipment' },
];

const RECALL_NEWS = [
  { make: 'Peterbilt', models: '579 and 389', year: '2023-2024', issue: 'steering column mounting bolts' },
  { make: 'Kenworth', models: 'T680 and W990', year: '2023-2025', issue: 'brake system pressure sensors' },
  { make: 'Freightliner', models: 'Cascadia', year: '2022-2024', issue: 'fuel system connection fittings' },
  { make: 'Volvo', models: 'VNL Series', year: '2023-2024', issue: 'air brake chamber brackets' },
  { make: 'International', models: 'LT Series', year: '2023-2025', issue: 'exhaust aftertreatment system' },
  { make: 'Mack', models: 'Anthem and Pinnacle', year: '2022-2024', issue: 'hood latch mechanism' },
  { make: 'Western Star', models: '49X and 57X', year: '2023-2024', issue: 'electrical wiring harness' },
  { make: 'Navistar', models: 'Multiple Models', year: '2023-2025', issue: 'power steering pump' },
];

const SAFETY_NEWS = [
  { title: 'Fatal Crash Involving CMV Closes Major Interstate', summary: 'Authorities investigating multi-vehicle accident. Drivers urged to use alternate routes and exercise caution.' },
  { title: 'NTSB Releases Report on Runaway Truck Incident', summary: 'Investigation highlights importance of brake inspection and mountain driving training for commercial drivers.' },
  { title: 'Work Zone Safety Campaign Launches Nationally', summary: 'DOT initiative reminds drivers of speed reduction requirements in construction areas. Fines doubled.' },
  { title: 'Distracted Driving Enforcement Increases', summary: 'Law enforcement targeting handheld device use by commercial drivers. Penalties include CSA points and fines.' },
  { title: 'Truck Fire Prevention Tips Released by FMCSA', summary: 'Agency issues guidance on electrical system maintenance and wheel end inspection. Prevention is key.' },
  { title: 'Fatigue-Related Crashes Under Increased Scrutiny', summary: 'Regulators reviewing correlation between HOS violations and accidents. Enhanced enforcement planned.' },
];

// Generate news for a specific date with high variety
function generateDailyNews(dateStr: string): NewsItem[] {
  const hash = hashCode(dateStr);
  const dayOfYear = Math.floor(hash / 1000) % 365;
  const news: NewsItem[] = [];
  
  // 1. Diesel price news (always included, highly varied)
  const diesel = generateDieselPrice(dateStr);
  const dieselTemplateIndex = hash % DIESEL_NEWS_TEMPLATES.length;
  const dieselTemplate = DIESEL_NEWS_TEMPLATES[dieselTemplateIndex];
  const seasons = ['winter', 'spring', 'summer', 'fall'];
  const regions = ['West Coast', 'Midwest', 'Southeast', 'Northeast', 'Gulf Coast'];
  
  let dieselTitle = dieselTemplate.title
    .replace('{price}', diesel.price.toFixed(2))
    .replace('{change}', diesel.change.toString())
    .replace('{direction}', diesel.direction)
    .replace('{direction_text}', diesel.direction === 'increase' ? 'Rising' : 'Falling')
    .replace('{season}', seasons[hash % 4])
    .replace('{region}', regions[hash % regions.length]);
    
  news.push({
    title: dieselTitle,
    summary: `National diesel average at $${diesel.price.toFixed(2)}/gallon, ${diesel.direction === 'increase' ? 'up' : 'down'} ${diesel.change}¢ from last week. ${regions[(hash + 1) % regions.length]} shows ${diesel.direction === 'increase' ? 'highest' : 'lowest'} regional prices. Plan fuel stops accordingly.`,
    image_url: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=400&h=200&fit=crop',
    source_url: 'https://www.eia.gov/petroleum/gasdiesel/',
    source: 'EIA',
    category: 'Diesel Prices',
    urgency: dieselTemplate.urgency,
    published_at: dateStr,
  });

  // 2. Regulation news (rotated daily)
  const regIndex = (hash + dayOfYear) % REGULATION_NEWS.length;
  const regNews = REGULATION_NEWS[regIndex];
  news.push({
    title: regNews.title,
    summary: regNews.summary,
    image_url: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=200&fit=crop',
    source_url: 'https://www.fmcsa.dot.gov/newsroom',
    source: 'FMCSA',
    category: 'Regulations',
    urgency: regNews.urgency,
    published_at: dateStr,
  });

  // 3. Weather alert (rotated, with urgency based on severity)
  const weatherIndex = (hash + dayOfYear * 2) % WEATHER_ALERTS.length;
  const weather = WEATHER_ALERTS[weatherIndex];
  const weatherUrgency = weather.condition.includes('warning') || weather.condition.includes('storm') 
    ? 'urgent' as const 
    : weather.condition.includes('advisory') 
      ? 'alert' as const 
      : 'today' as const;
      
  news.push({
    title: `${weather.condition} for ${weather.route} in ${weather.state}`,
    summary: `${weather.region}: ${weather.condition}. Commercial vehicle restrictions may be in effect. Check current conditions before travel and plan alternate routes if needed.`,
    image_url: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=400&h=200&fit=crop',
    source_url: 'https://www.weather.gov/',
    source: 'NWS',
    category: 'Weather',
    state: weather.state,
    urgency: weatherUrgency,
    published_at: dateStr,
  });

  // 4. Industry news (2 items, rotated)
  const industryIndex1 = (hash + dayOfYear * 3) % INDUSTRY_NEWS.length;
  const industryIndex2 = (hash + dayOfYear * 5 + 7) % INDUSTRY_NEWS.length;
  
  [industryIndex1, industryIndex2].forEach((idx, i) => {
    const industry = INDUSTRY_NEWS[idx];
    news.push({
      title: industry.title,
      summary: industry.summary,
      image_url: i === 0 
        ? 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=200&fit=crop'
        : 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop',
      source_url: 'https://ops.fhwa.dot.gov/freight/',
      source: 'FHWA',
      category: 'Industry',
      urgency: 'normal',
      published_at: dateStr,
    });
  });

  // 5. Weigh station news
  const wsIndex = (hash + dayOfYear * 4) % WEIGH_STATION_NEWS.length;
  const ws = WEIGH_STATION_NEWS[wsIndex];
  news.push({
    title: `${ws.state} Weigh Station on ${ws.route} ${ws.action}`,
    summary: `Important notice for drivers on ${ws.route}: ${ws.state} weigh station ${ws.action}. Plan your route and stops accordingly.`,
    image_url: 'https://images.unsplash.com/photo-1586191582066-d39d6baad6be?w=400&h=200&fit=crop',
    source_url: 'https://www.fmcsa.dot.gov/',
    source: 'DOT',
    category: 'Weigh Station',
    state: ws.state,
    urgency: 'today',
    published_at: dateStr,
  });

  // 6. Recall notice (every 3rd day)
  if (dayOfYear % 3 === 0) {
    const recallIndex = Math.floor(dayOfYear / 3) % RECALL_NEWS.length;
    const recall = RECALL_NEWS[recallIndex];
    news.push({
      title: `${recall.make} Recalls ${recall.year} ${recall.models}`,
      summary: `Voluntary safety recall affects ${recall.issue}. Affected owners should contact authorized dealers for free inspection and repair.`,
      image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop',
      source_url: 'https://www.nhtsa.gov/recalls',
      source: 'NHTSA',
      category: 'Recall',
      urgency: 'alert',
      published_at: dateStr,
    });
  }

  // 7. Safety news (every 4th day)
  if (dayOfYear % 4 === 0) {
    const safetyIndex = Math.floor(dayOfYear / 4) % SAFETY_NEWS.length;
    const safety = SAFETY_NEWS[safetyIndex];
    news.push({
      title: safety.title,
      summary: safety.summary,
      image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=400&h=200&fit=crop',
      source_url: 'https://www.nhtsa.gov/',
      source: 'NHTSA',
      category: 'Safety',
      urgency: 'alert',
      published_at: dateStr,
    });
  }

  // 8. Second weather alert for variety (different region)
  const weatherIndex2 = (weatherIndex + 5) % WEATHER_ALERTS.length;
  const weather2 = WEATHER_ALERTS[weatherIndex2];
  if (weather2.state !== weather.state) {
    news.push({
      title: `${weather2.condition} Expected on ${weather2.route}`,
      summary: `${weather2.region} drivers: ${weather2.condition} reported. Check DOT road conditions for ${weather2.state} before departure.`,
      image_url: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=400&h=200&fit=crop',
      source_url: 'https://www.weather.gov/',
      source: 'NWS',
      category: 'Weather',
      state: weather2.state,
      urgency: 'today',
      published_at: dateStr,
    });
  }

  return news;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    
    // Parse request parameters
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force') === 'true';

    // Check last fetch
    const { data: latestNews } = await supabase
      .from('trucking_news')
      .select('fetched_at, published_at')
      .order('fetched_at', { ascending: false })
      .limit(1);

    const lastFetchDate = latestNews?.[0]?.fetched_at?.split('T')[0];
    const lastPublishDate = latestNews?.[0]?.published_at?.split('T')[0];

    console.log('[News] Today:', today, 'Last fetch:', lastFetchDate, 'Last publish:', lastPublishDate, 'Force:', forceRefresh);

    // Return cached if already fetched today (unless forced)
    if (lastFetchDate === today && lastPublishDate === today && !forceRefresh) {
      console.log('[News] Returning cached news from today');
      const { data: existingNews, error } = await supabase
        .from('trucking_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          ok: true, 
          news: existingNews, 
          cached: true,
          lastUpdate: lastFetchDate,
          itemCount: existingNews?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[News] Generating fresh news for:', today);

    // Generate fresh news for today
    const freshNews = generateDailyNews(today);

    console.log('[News] Generated', freshNews.length, 'news items');
    console.log('[News] Headlines:', freshNews.map(n => n.title.substring(0, 50)));

    // Clean up: delete news older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { error: deleteOldError } = await supabase
      .from('trucking_news')
      .delete()
      .lt('published_at', sevenDaysAgo.toISOString().split('T')[0]);
    
    if (deleteOldError) {
      console.error('[News] Error deleting old news:', deleteOldError);
    }

    // Delete today's news to avoid duplicates
    const { error: deleteTodayError } = await supabase
      .from('trucking_news')
      .delete()
      .gte('published_at', today);

    if (deleteTodayError) {
      console.error('[News] Error deleting today news:', deleteTodayError);
    }

    // Insert fresh news
    const { data: insertedNews, error: insertError } = await supabase
      .from('trucking_news')
      .insert(freshNews)
      .select();

    if (insertError) {
      console.error('[News] Insert error:', insertError);
      throw insertError;
    }

    console.log('[News] Successfully inserted', insertedNews?.length, 'news items');
    console.log('[News] IDs:', insertedNews?.map(n => n.id));

    return new Response(
      JSON.stringify({ 
        ok: true, 
        news: insertedNews, 
        cached: false,
        generatedAt: new Date().toISOString(),
        itemCount: insertedNews?.length || 0,
        fallbackUsed: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[News] Fatal error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
