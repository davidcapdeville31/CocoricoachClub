
-- Create category_members table for category-level access
CREATE TABLE public.category_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (category_id, user_id)
);

-- Create category_invitations table
CREATE TABLE public.category_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by uuid NOT NULL,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days')
);

-- Enable RLS
ALTER TABLE public.category_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_invitations ENABLE ROW LEVEL SECURITY;

-- Function to check if user can access a specific category
CREATE OR REPLACE FUNCTION public.can_access_category(_user_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Direct category member
    SELECT 1 FROM public.category_members
    WHERE user_id = _user_id AND category_id = _category_id
  ) OR EXISTS (
    -- Club member (has access to all categories)
    SELECT 1 FROM public.categories c
    JOIN public.club_members cm ON cm.club_id = c.club_id
    WHERE c.id = _category_id AND cm.user_id = _user_id
  ) OR EXISTS (
    -- Club owner
    SELECT 1 FROM public.categories c
    JOIN public.clubs cl ON cl.id = c.club_id
    WHERE c.id = _category_id AND cl.user_id = _user_id
  )
$$;

-- Function to accept category invitation
CREATE OR REPLACE FUNCTION public.accept_category_invitation(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation category_invitations%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM category_invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now()
    AND email = auth.email();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Add user to category_members
  INSERT INTO category_members (category_id, user_id, role, invited_by)
  VALUES (v_invitation.category_id, v_user_id, v_invitation.role, v_invitation.invited_by)
  ON CONFLICT (category_id, user_id) DO NOTHING;

  -- Update invitation status
  UPDATE category_invitations
  SET status = 'accepted'
  WHERE id = v_invitation.id;

  RETURN json_build_object('success', true, 'category_id', v_invitation.category_id);
END;
$$;

-- RLS Policies for category_members
CREATE POLICY "Category members viewable by club owners and admins"
ON public.category_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_members.category_id
    AND (cl.user_id = auth.uid() OR can_access_club(auth.uid(), cl.id))
  )
);

CREATE POLICY "Club owners can manage category members"
ON public.category_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_members.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
);

CREATE POLICY "Club owners can update category members"
ON public.category_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_members.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
);

CREATE POLICY "Club owners can delete category members"
ON public.category_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_members.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
);

-- RLS Policies for category_invitations
CREATE POLICY "Category invitations viewable by club owners and admins"
ON public.category_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_invitations.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
  OR auth.email() = email
);

CREATE POLICY "Club owners can create category invitations"
ON public.category_invitations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_invitations.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
);

CREATE POLICY "Club owners can update category invitations"
ON public.category_invitations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_invitations.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
  OR auth.email() = email
);

CREATE POLICY "Club owners can delete category invitations"
ON public.category_invitations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM categories c
    JOIN clubs cl ON cl.id = c.club_id
    WHERE c.id = category_invitations.category_id
    AND (cl.user_id = auth.uid() OR has_club_role(auth.uid(), cl.id, 'admin'))
  )
);
