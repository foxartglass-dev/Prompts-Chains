-- Phase 2: Prompt-to-Page Assignment System
-- Add columns to site_plan_nodes for per-page prompt assignment

-- Bank First toggle - check bank before generating
ALTER TABLE site_plan_nodes
ADD COLUMN IF NOT EXISTS bank_first BOOLEAN DEFAULT false;

-- Assigned mode - which prompt source to use (main_prompt, guided_gpt, smart_prompt)
ALTER TABLE site_plan_nodes
ADD COLUMN IF NOT EXISTS assigned_mode VARCHAR(20);

-- Assigned prompt ID - specific prompt within the mode (H1, H2, J1, etc.)
ALTER TABLE site_plan_nodes
ADD COLUMN IF NOT EXISTS assigned_prompt_id VARCHAR(10);

-- Article status reference - tracks if an article has been generated for this page
-- (This helps show status in the Site Planning UI)
-- Note: assigned_article_id already exists, this is for quick status checks

-- Add index for filtering pages by assignment
CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_assigned_mode ON site_plan_nodes(assigned_mode);
CREATE INDEX IF NOT EXISTS idx_site_plan_nodes_bank_first ON site_plan_nodes(bank_first);

COMMENT ON COLUMN site_plan_nodes.bank_first IS 'If true, check image bank first before generating';
COMMENT ON COLUMN site_plan_nodes.assigned_mode IS 'Prompt source: main_prompt, guided_gpt, or smart_prompt';
COMMENT ON COLUMN site_plan_nodes.assigned_prompt_id IS 'Specific prompt ID within mode: H1, H2, J1, Global1, etc.';
