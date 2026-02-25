-- LLM usage tracking table for Gemini API free-tier protection
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tokens_prompt INTEGER NOT NULL DEFAULT 0,
  tokens_completion INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  status TEXT NOT NULL DEFAULT 'success',  -- 'success', 'error', 'rate_limited'
  error_message TEXT
);

-- Indexes for efficient time-range queries used by safety layers
CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at DESC);
CREATE INDEX idx_llm_usage_user_created ON llm_usage(user_id, created_at DESC);

-- Enable RLS: users can only read their own usage rows
-- The serverless function writes via service_role key (bypasses RLS)
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON llm_usage FOR SELECT
  USING (auth.uid() = user_id);
