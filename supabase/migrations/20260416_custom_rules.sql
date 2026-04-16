-- Custom validation rules: user-defined rules stored as JSON definitions

CREATE TABLE public.custom_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.validation_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
    rule_definition JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_custom_rules_profile_id ON public.custom_rules(profile_id);
CREATE INDEX idx_custom_rules_org_id ON public.custom_rules(org_id);

-- Enable RLS
ALTER TABLE public.custom_rules ENABLE ROW LEVEL SECURITY;

-- Org members can read rules
CREATE POLICY "Org members can view custom rules"
ON public.custom_rules FOR SELECT
USING (
    org_id IN (
        SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
);

-- Reviewers and admins can create rules
CREATE POLICY "Reviewers and admins can create custom rules"
ON public.custom_rules FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'reviewer')
    )
);

-- Rule owner can update their rules
CREATE POLICY "Owner can update custom rules"
ON public.custom_rules FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Owner or admin can delete rules
CREATE POLICY "Owner or admin can delete custom rules"
ON public.custom_rules FOR DELETE
USING (
    user_id = auth.uid()
    OR org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Auto-update updated_at timestamp
CREATE TRIGGER handle_custom_rules_updated_at
    BEFORE UPDATE ON public.custom_rules
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
