-- context_zones: zone definitions with threshold modifiers for context-aware QC
CREATE TABLE public.context_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.validation_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    zone_type TEXT NOT NULL CHECK (zone_type IN ('kp_range', 'event_match')),
    kp_start FLOAT,
    kp_end FLOAT,
    event_value TEXT,
    threshold_modifiers JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    is_preset BOOLEAN DEFAULT false,
    preset_id TEXT,  -- e.g., 'shore-approach', null for custom zones
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_kp_range CHECK (
        zone_type != 'kp_range' OR (kp_start IS NOT NULL AND kp_end IS NOT NULL AND kp_start <= kp_end)
    ),
    CONSTRAINT valid_event CHECK (
        zone_type != 'event_match' OR event_value IS NOT NULL
    )
);

CREATE INDEX idx_context_zones_profile_id ON public.context_zones(profile_id);
CREATE INDEX idx_context_zones_org_id ON public.context_zones(org_id);

ALTER TABLE public.context_zones ENABLE ROW LEVEL SECURITY;

-- RLS policies mirror custom_rules exactly
CREATE POLICY "Org members can view context zones"
ON public.context_zones FOR SELECT
USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

CREATE POLICY "Reviewers and admins can create context zones"
ON public.context_zones FOR INSERT
WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'reviewer')
));

CREATE POLICY "Owner can update context zones"
ON public.context_zones FOR UPDATE
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner or admin can delete context zones"
ON public.context_zones FOR DELETE
USING (user_id = auth.uid() OR org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE TRIGGER handle_context_zones_updated_at
    BEFORE UPDATE ON public.context_zones
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
