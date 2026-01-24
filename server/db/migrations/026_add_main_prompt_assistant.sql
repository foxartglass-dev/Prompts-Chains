-- Add Main Prompt AI Assistant chat storage
-- Mirrors the Guided GPT assistant (consultant_chat) structure

-- Main Prompt active chat history (unfiled messages)
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS main_prompt_chat_history JSONB DEFAULT '[]';

-- Main Prompt chat files (folders for organization)
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS main_prompt_chat_files JSONB DEFAULT '[]';

-- Main Prompt saved conversations
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS main_prompt_chat_conversations JSONB DEFAULT '[]';

-- Main Prompt chat model preference
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS main_prompt_chat_model VARCHAR(100) DEFAULT 'gpt-4o';

-- Cross-chat references (for ping system between assistants)
-- Stores references like: [{fromAssistant: 'guided_gpt', toAssistant: 'main_prompt', conversationId: '...', message: '...', timestamp: '...'}]
ALTER TABLE image_creation_settings
ADD COLUMN IF NOT EXISTS chat_cross_references JSONB DEFAULT '[]';

COMMENT ON COLUMN image_creation_settings.main_prompt_chat_history IS 'Active chat messages for Main Prompt AI assistant';
COMMENT ON COLUMN image_creation_settings.main_prompt_chat_files IS 'Folder structure for Main Prompt chat organization';
COMMENT ON COLUMN image_creation_settings.main_prompt_chat_conversations IS 'Saved conversations for Main Prompt assistant';
COMMENT ON COLUMN image_creation_settings.chat_cross_references IS 'Cross-references between Guided GPT and Main Prompt assistants';
