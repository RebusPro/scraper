--
-- Database Schema for Email Scraper Project
-- Exported from Supabase backup on 2025-07-24
--

-- ============================================
-- TABLE: scraping_results
-- ============================================
-- Stores the results of web scraping jobs organized by batch

CREATE TABLE IF NOT EXISTS public.scraping_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    batch_id uuid NOT NULL,
    url text NOT NULL,
    status text NOT NULL,
    contacts jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT scraping_results_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text])))
);

-- Index for faster batch queries
CREATE INDEX IF NOT EXISTS idx_scraping_results_batch_id ON public.scraping_results(batch_id);

-- Index for faster date range queries
CREATE INDEX IF NOT EXISTS idx_scraping_results_created_at ON public.scraping_results(created_at DESC);

-- ============================================
-- FUNCTION: get_batch_summaries
-- ============================================
-- Returns paginated batch summaries with optional date filtering
-- Parameters:
--   - page_num: Current page number (1-based)
--   - page_size: Number of records per page
--   - start_date_text: Optional start date filter (format: YYYY-MM-DD)
--   - end_date_text: Optional end date filter (format: YYYY-MM-DD)

CREATE OR REPLACE FUNCTION public.get_batch_summaries(
    page_num integer,
    page_size integer,
    start_date_text text DEFAULT NULL::text,
    end_date_text text DEFAULT NULL::text
)
RETURNS TABLE(
    batch_id text,
    start_time timestamp with time zone,
    processed_count bigint,
    total_batches bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    total_count bigint;
    offset_val int;
    start_timestamp timestamptz DEFAULT NULL;
    end_timestamp timestamptz DEFAULT NULL;
BEGIN
    -- Attempt to convert text dates to timestamps
    BEGIN
        IF start_date_text IS NOT NULL AND start_date_text <> '' THEN
            start_timestamp := start_date_text::date;
        END IF;
        IF end_date_text IS NOT NULL AND end_date_text <> '' THEN
            -- Add 1 day to make the end date inclusive
            end_timestamp := (end_date_text::date + interval '1 day');
        END IF;
    EXCEPTION WHEN others THEN
        -- Handle potential conversion errors if needed, or let it pass
        RAISE NOTICE 'Invalid date format provided: % or %', start_date_text, end_date_text;
        start_timestamp := NULL;
        end_timestamp := NULL;
    END;

    -- Calculate offset
    offset_val := (page_num - 1) * page_size;

    -- Calculate total count respecting date filters
    WITH FilteredBatchStarts AS (
        SELECT sr.batch_id, MIN(sr.created_at) as min_created_at
        FROM scraping_results sr
        GROUP BY sr.batch_id
        HAVING
            (start_timestamp IS NULL OR MIN(sr.created_at) >= start_timestamp) AND
            (end_timestamp IS NULL OR MIN(sr.created_at) < end_timestamp)
    )
    SELECT count(*) INTO total_count FROM FilteredBatchStarts;

    -- Return the paginated summary with date filters applied
    RETURN QUERY
    WITH BatchData AS (
        SELECT
            sr.batch_id,
            min(sr.created_at) as min_created_at,
            count(*) as num_processed
        FROM
            scraping_results sr
        GROUP BY
            sr.batch_id
        HAVING
            (start_timestamp IS NULL OR MIN(sr.created_at) >= start_timestamp) AND
            (end_timestamp IS NULL OR MIN(sr.created_at) < end_timestamp)
    )
    SELECT
        bd.batch_id::text,
        bd.min_created_at::timestamptz,
        bd.num_processed::bigint,
        total_count::bigint
    FROM
        BatchData bd
    ORDER BY
        bd.min_created_at DESC -- Newest first
    LIMIT page_size
    OFFSET offset_val;

END;
$$;

-- ============================================
-- Row Level Security (RLS) - Optional
-- ============================================
-- Uncomment if you want to enable RLS for security

-- ALTER TABLE public.scraping_results ENABLE ROW LEVEL SECURITY;

-- Example policy: Allow all operations for authenticated users
-- CREATE POLICY "Allow all for authenticated users"
--   ON public.scraping_results
--   FOR ALL
--   USING (auth.role() = 'authenticated');

-- ============================================
-- Permissions
-- ============================================

ALTER TABLE public.scraping_results OWNER TO postgres;
ALTER FUNCTION public.get_batch_summaries(integer, integer, text, text) OWNER TO postgres;

-- Grant permissions to service_role (for backend operations)
GRANT ALL ON public.scraping_results TO service_role;
GRANT EXECUTE ON FUNCTION public.get_batch_summaries(integer, integer, text, text) TO service_role;

-- Grant permissions to authenticated users
GRANT ALL ON public.scraping_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_summaries(integer, integer, text, text) TO authenticated;
