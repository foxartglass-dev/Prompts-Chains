-- Migration 020: Add chat files and conversations columns for organized chat sessions
-- Run this SQL in your Neon database console

-- Chat Files: Folders to organize chats (like Claude Projects)
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS consultant_chat_files JSONB DEFAULT '[]'::jsonb;

-- Chat Conversations: All conversations (filed or unfiled)
ALTER TABLE image_creation_settings ADD COLUMN IF NOT EXISTS consultant_chat_conversations JSONB DEFAULT '[]'::jsonb;
