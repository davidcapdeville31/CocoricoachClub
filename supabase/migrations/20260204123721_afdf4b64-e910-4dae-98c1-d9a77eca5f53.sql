-- Table pour les prospects de recrutement
CREATE TABLE public.recruitment_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  position TEXT,
  current_club TEXT,
  birth_date DATE,
  phone TEXT,
  email TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'identified',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  source TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table pour les documents administratifs
CREATE TABLE public.admin_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'valid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table pour les infrastructures
CREATE TABLE public.facilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'field',
  capacity INTEGER,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table pour les réservations d'infrastructures
CREATE TABLE public.facility_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table pour l'inventaire matériel
CREATE TABLE public.equipment_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'good',
  location TEXT,
  notes TEXT,
  last_maintenance DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table pour les déplacements
CREATE TABLE public.team_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  departure_time TIME,
  return_date DATE,
  return_time TIME,
  transport_type TEXT NOT NULL DEFAULT 'bus',
  transport_details TEXT,
  accommodation TEXT,
  meal_plan TEXT,
  meeting_point TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recruitment_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_trips ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Using existing can_access_category function
CREATE POLICY "Users can view prospects in their categories" ON public.recruitment_prospects
  FOR SELECT USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can insert prospects in their categories" ON public.recruitment_prospects
  FOR INSERT WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can update prospects in their categories" ON public.recruitment_prospects
  FOR UPDATE USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can delete prospects in their categories" ON public.recruitment_prospects
  FOR DELETE USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can view documents in their categories" ON public.admin_documents
  FOR SELECT USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can insert documents in their categories" ON public.admin_documents
  FOR INSERT WITH CHECK (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can update documents in their categories" ON public.admin_documents
  FOR UPDATE USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can delete documents in their categories" ON public.admin_documents
  FOR DELETE USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can view facilities in their categories" ON public.facilities
  FOR SELECT USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage facilities in their categories" ON public.facilities
  FOR ALL USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can view bookings in their categories" ON public.facility_bookings
  FOR SELECT USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage bookings in their categories" ON public.facility_bookings
  FOR ALL USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can view equipment in their categories" ON public.equipment_inventory
  FOR SELECT USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage equipment in their categories" ON public.equipment_inventory
  FOR ALL USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can view trips in their categories" ON public.team_trips
  FOR SELECT USING (public.can_access_category(auth.uid(), category_id));

CREATE POLICY "Users can manage trips in their categories" ON public.team_trips
  FOR ALL USING (public.can_access_category(auth.uid(), category_id));

-- Indexes for better performance
CREATE INDEX idx_recruitment_prospects_category ON public.recruitment_prospects(category_id);
CREATE INDEX idx_admin_documents_category ON public.admin_documents(category_id);
CREATE INDEX idx_admin_documents_player ON public.admin_documents(player_id);
CREATE INDEX idx_facilities_category ON public.facilities(category_id);
CREATE INDEX idx_facility_bookings_category ON public.facility_bookings(category_id);
CREATE INDEX idx_facility_bookings_date ON public.facility_bookings(date);
CREATE INDEX idx_equipment_inventory_category ON public.equipment_inventory(category_id);
CREATE INDEX idx_team_trips_category ON public.team_trips(category_id);
CREATE INDEX idx_team_trips_date ON public.team_trips(departure_date);