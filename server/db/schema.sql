-- PromptFlow Database Schema
-- Run this in Neon SQL Editor to create tables

-- Clients table (e.g., different businesses/websites you manage)
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table (linked to clients)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster client lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- Example: Insert a default client
-- INSERT INTO clients (name, description) VALUES ('My Business', 'Default client');
