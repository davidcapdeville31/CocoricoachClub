-- Table pour les templates de séances
CREATE TABLE public.session_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL DEFAULT 'training',
  duration_minutes INTEGER,
  intensity TEXT,
  objectives TEXT,
  warmup_description TEXT,
  main_content TEXT,
  cooldown_description TEXT,
  equipment_needed TEXT[],
  notes TEXT,
  is_shared BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour les exercices dans un template
CREATE TABLE public.template_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.session_templates(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_id UUID REFERENCES public.exercise_library(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  sets INTEGER,
  reps TEXT,
  duration_seconds INTEGER,
  rest_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour la planification hebdomadaire
CREATE TABLE public.weekly_planning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time_slot TIME,
  template_id UUID REFERENCES public.session_templates(id) ON DELETE SET NULL,
  custom_title TEXT,
  custom_description TEXT,
  location TEXT,
  assigned_players UUID[],
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table pour la messagerie
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT,
  conversation_type TEXT NOT NULL DEFAULT 'direct',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Participants aux conversations
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  is_admin BOOLEAN DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_announcement BOOLEAN DEFAULT false,
  is_urgent BOOLEAN DEFAULT false,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_templates
CREATE POLICY "Users can view templates for their categories"
ON public.session_templates FOR SELECT
USING (
  category_id IN (
    SELECT category_id FROM public.category_members WHERE user_id = auth.uid()
  )
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.club_members cm ON c.club_id = cm.club_id
    WHERE cm.user_id = auth.uid()
  )
  OR is_shared = true
);

CREATE POLICY "Users can create templates for their categories"
ON public.session_templates FOR INSERT
WITH CHECK (
  category_id IN (
    SELECT category_id FROM public.category_members WHERE user_id = auth.uid()
  )
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.club_members cm ON c.club_id = cm.club_id
    WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their templates"
ON public.session_templates FOR UPDATE
USING (created_by = auth.uid() OR category_id IN (
  SELECT category_id FROM public.category_members WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Users can delete their templates"
ON public.session_templates FOR DELETE
USING (created_by = auth.uid() OR category_id IN (
  SELECT category_id FROM public.category_members WHERE user_id = auth.uid() AND role = 'admin'
));

-- RLS Policies for template_exercises
CREATE POLICY "Users can view template exercises"
ON public.template_exercises FOR SELECT
USING (
  template_id IN (SELECT id FROM public.session_templates)
);

CREATE POLICY "Users can manage template exercises"
ON public.template_exercises FOR ALL
USING (
  template_id IN (
    SELECT id FROM public.session_templates WHERE created_by = auth.uid()
  )
);

-- RLS Policies for weekly_planning
CREATE POLICY "Users can view planning for their categories"
ON public.weekly_planning FOR SELECT
USING (
  category_id IN (
    SELECT category_id FROM public.category_members WHERE user_id = auth.uid()
  )
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.club_members cm ON c.club_id = cm.club_id
    WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage planning for their categories"
ON public.weekly_planning FOR ALL
USING (
  category_id IN (
    SELECT category_id FROM public.category_members WHERE user_id = auth.uid()
  )
  OR category_id IN (
    SELECT c.id FROM public.categories c
    JOIN public.club_members cm ON c.club_id = cm.club_id
    WHERE cm.user_id = auth.uid()
  )
);

-- RLS Policies for conversations
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
USING (
  id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  OR category_id IN (
    SELECT category_id FROM public.category_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update conversations"
ON public.conversations FOR UPDATE
USING (
  id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid() AND is_admin = true)
);

-- RLS Policies for conversation_participants
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants FOR SELECT
USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage participants"
ON public.conversation_participants FOR ALL
USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid() AND is_admin = true)
  OR user_id = auth.uid()
);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
USING (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their messages"
ON public.messages FOR UPDATE
USING (sender_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Triggers for updated_at
CREATE TRIGGER update_session_templates_updated_at
BEFORE UPDATE ON public.session_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_planning_updated_at
BEFORE UPDATE ON public.weekly_planning
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();