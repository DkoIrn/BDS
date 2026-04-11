-- Procrastinate job queue schema for PostgreSQL
-- Generated via: procrastinate schema --sql
-- Regenerate if upgrading procrastinate version (currently targeting 3.7.x)
--
-- This creates the internal tables, enums, functions, and triggers
-- that procrastinate uses to manage job lifecycle.

-- Enums
CREATE TYPE procrastinate_job_status AS ENUM (
    'todo',
    'doing',
    'succeeded',
    'failed',
    'cancelled',
    'aborting',
    'aborted'
);

CREATE TYPE procrastinate_job_event_type AS ENUM (
    'deferred',
    'started',
    'deferred_for_retry',
    'failed',
    'succeeded',
    'cancelled',
    'abort_requested',
    'aborted',
    'scheduled'
);

-- Main jobs table
CREATE TABLE procrastinate_jobs (
    id bigserial PRIMARY KEY,
    queue_name character varying(128) NOT NULL,
    task_name character varying(128) NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    lock text,
    queueing_lock text,
    args jsonb DEFAULT '{}'::jsonb NOT NULL,
    status procrastinate_job_status DEFAULT 'todo'::procrastinate_job_status NOT NULL,
    scheduled_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    abort_requested boolean DEFAULT false NOT NULL
);

CREATE INDEX procrastinate_jobs_queue_name_idx ON procrastinate_jobs(queue_name);
CREATE INDEX procrastinate_jobs_id_fetch_idx ON procrastinate_jobs (id)
    WHERE status = 'todo';
CREATE UNIQUE INDEX procrastinate_jobs_queueing_lock_idx ON procrastinate_jobs (queueing_lock)
    WHERE status = 'todo';

-- Events table (audit trail for job lifecycle)
CREATE TABLE procrastinate_events (
    id bigserial PRIMARY KEY,
    job_id bigint NOT NULL REFERENCES procrastinate_jobs(id),
    type procrastinate_job_event_type NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX procrastinate_events_job_id_idx ON procrastinate_events(job_id);

-- Periodic defers table (for scheduled/periodic tasks)
CREATE TABLE procrastinate_periodic_defers (
    id bigserial PRIMARY KEY,
    task_name character varying(128) NOT NULL,
    defer_timestamp timestamp with time zone,
    job_id bigint REFERENCES procrastinate_jobs(id),
    queue_name character varying(128),
    periodic_id character varying(128) DEFAULT '' NOT NULL,
    UNIQUE (task_name, periodic_id, queue_name)
);

-- Function: defer a job
CREATE OR REPLACE FUNCTION procrastinate_defer_job(
    queue_name character varying,
    task_name character varying,
    priority integer,
    lock text,
    queueing_lock text,
    args jsonb,
    scheduled_at timestamp with time zone
) RETURNS bigint AS $$
DECLARE
    job_id bigint;
BEGIN
    INSERT INTO procrastinate_jobs (queue_name, task_name, priority, lock, queueing_lock, args, status, scheduled_at)
    VALUES (queue_name, task_name, priority, lock, queueing_lock, args,
            CASE WHEN scheduled_at IS NOT NULL AND scheduled_at > now()
                 THEN 'todo'::procrastinate_job_status
                 ELSE 'todo'::procrastinate_job_status
            END,
            scheduled_at)
    RETURNING id INTO job_id;

    INSERT INTO procrastinate_events (job_id, type)
    VALUES (job_id,
            CASE WHEN scheduled_at IS NOT NULL AND scheduled_at > now()
                 THEN 'scheduled'::procrastinate_job_event_type
                 ELSE 'deferred'::procrastinate_job_event_type
            END);

    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Function: fetch a job for processing
CREATE OR REPLACE FUNCTION procrastinate_fetch_job(
    target_queue_names character varying[]
) RETURNS procrastinate_jobs AS $$
DECLARE
    found_job procrastinate_jobs;
BEGIN
    SELECT * INTO found_job
    FROM procrastinate_jobs
    WHERE status = 'todo'
      AND (target_queue_names IS NULL OR queue_name = ANY(target_queue_names))
      AND (scheduled_at IS NULL OR scheduled_at <= now())
    ORDER BY priority DESC, id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF found_job.id IS NOT NULL THEN
        UPDATE procrastinate_jobs
        SET status = 'doing', attempts = attempts + 1
        WHERE id = found_job.id;

        INSERT INTO procrastinate_events (job_id, type)
        VALUES (found_job.id, 'started'::procrastinate_job_event_type);

        found_job.status := 'doing';
    END IF;

    RETURN found_job;
END;
$$ LANGUAGE plpgsql;

-- Function: finish a job (succeed or fail)
CREATE OR REPLACE FUNCTION procrastinate_finish_job(
    job_id bigint,
    end_status procrastinate_job_status,
    delete_job boolean
) RETURNS void AS $$
BEGIN
    IF delete_job THEN
        DELETE FROM procrastinate_jobs WHERE id = job_id;
    ELSE
        UPDATE procrastinate_jobs
        SET status = end_status
        WHERE id = job_id;
    END IF;

    INSERT INTO procrastinate_events (job_id, type)
    VALUES (job_id, end_status::text::procrastinate_job_event_type);
END;
$$ LANGUAGE plpgsql;

-- Function: retry a job
CREATE OR REPLACE FUNCTION procrastinate_retry_job(
    job_id bigint,
    retry_at timestamp with time zone
) RETURNS void AS $$
BEGIN
    UPDATE procrastinate_jobs
    SET status = 'todo', scheduled_at = retry_at
    WHERE id = job_id;

    INSERT INTO procrastinate_events (job_id, type)
    VALUES (job_id, 'deferred_for_retry'::procrastinate_job_event_type);
END;
$$ LANGUAGE plpgsql;

-- Function: cancel a job
CREATE OR REPLACE FUNCTION procrastinate_cancel_job(
    job_id bigint,
    abort boolean DEFAULT false
) RETURNS boolean AS $$
DECLARE
    _status procrastinate_job_status;
BEGIN
    SELECT status INTO _status FROM procrastinate_jobs WHERE id = job_id FOR UPDATE;

    IF _status = 'todo' THEN
        UPDATE procrastinate_jobs SET status = 'cancelled' WHERE id = job_id;
        INSERT INTO procrastinate_events (job_id, type) VALUES (job_id, 'cancelled');
        RETURN true;
    ELSIF _status = 'doing' AND abort THEN
        UPDATE procrastinate_jobs SET abort_requested = true, status = 'aborting' WHERE id = job_id;
        INSERT INTO procrastinate_events (job_id, type) VALUES (job_id, 'abort_requested');
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Notify trigger for instant job pickup via LISTEN/NOTIFY
CREATE OR REPLACE FUNCTION procrastinate_notify_queue() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('procrastinate_queue#' || NEW.queue_name, NEW.task_name);
    PERFORM pg_notify('procrastinate_any_queue', NEW.task_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER procrastinate_jobs_notify_queue
    AFTER INSERT ON procrastinate_jobs
    FOR EACH ROW
    WHEN (NEW.status = 'todo')
    EXECUTE FUNCTION procrastinate_notify_queue();

CREATE TRIGGER procrastinate_jobs_notify_queue_on_update
    AFTER UPDATE OF status ON procrastinate_jobs
    FOR EACH ROW
    WHEN (NEW.status = 'todo')
    EXECUTE FUNCTION procrastinate_notify_queue();
