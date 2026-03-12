-- Enable Realtime postgres_changes on the datasets table
-- Required for Supabase Realtime subscriptions to receive UPDATE events
-- when dataset status changes (e.g., validating -> validated)
ALTER PUBLICATION supabase_realtime ADD TABLE datasets;
