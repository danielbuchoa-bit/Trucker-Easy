-- Tabela weigh_stations
CREATE TABLE public.weigh_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer DEFAULT 1200,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela bypass_events
CREATE TABLE public.bypass_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NULL,
  weigh_station_id uuid NOT NULL REFERENCES public.weigh_stations(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  result text NOT NULL CHECK (result IN ('bypass', 'pull_in', 'unknown')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  source text NOT NULL DEFAULT 'driver_report',
  confidence_score integer NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_bypass_events_user_occurred ON public.bypass_events(user_id, occurred_at DESC);
CREATE INDEX idx_bypass_events_station_occurred ON public.bypass_events(weigh_station_id, occurred_at DESC);

-- Enable RLS
ALTER TABLE public.weigh_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bypass_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for weigh_stations (leitura pública para usuários logados)
CREATE POLICY "Authenticated users can read weigh stations"
ON public.weigh_stations
FOR SELECT
TO authenticated
USING (true);

-- RLS policies for bypass_events (usuário só pode ver/inserir os próprios)
CREATE POLICY "Users can view their own bypass events"
ON public.bypass_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bypass events"
ON public.bypass_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Função para verificar anti-duplicata (30 min)
CREATE OR REPLACE FUNCTION public.can_insert_bypass_event(
  p_user_id uuid,
  p_weigh_station_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.bypass_events
    WHERE user_id = p_user_id
      AND weigh_station_id = p_weigh_station_id
      AND occurred_at > (now() - interval '30 minutes')
  )
$$;

-- Seed inicial com algumas weigh stations para testes
INSERT INTO public.weigh_stations (name, state, lat, lng, radius_m) VALUES
('I-10 Weigh Station', 'TX', 29.7604, -95.3698, 1200),
('I-40 Weigh Station', 'AZ', 35.1983, -111.6513, 1200),
('I-5 Weigh Station', 'CA', 34.0522, -118.2437, 1200),
('I-80 Weigh Station', 'NV', 39.5296, -119.8138, 1200),
('I-95 Weigh Station', 'FL', 25.7617, -80.1918, 1200),
('I-70 Weigh Station', 'CO', 39.7392, -104.9903, 1200),
('I-90 Weigh Station', 'WA', 47.6062, -122.3321, 1200),
('I-75 Weigh Station', 'GA', 33.7490, -84.3880, 1200),
('I-65 Weigh Station', 'IN', 39.7684, -86.1581, 1200),
('I-35 Weigh Station', 'OK', 35.4676, -97.5164, 1200);