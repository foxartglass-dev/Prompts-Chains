-- Add module_name column to component_library for Slider Revolution widgets
-- The module_name is the actual SR module title (e.g., "Residential")
-- This is different from the alias (e.g., "home-1") used in the shortcode
-- and different from the display name (user's friendly label)

ALTER TABLE component_library
ADD COLUMN IF NOT EXISTS module_name VARCHAR(200);

-- Add comment for clarity
COMMENT ON COLUMN component_library.module_name IS 'Slider Revolution module name (revslidertitle). Only used for slider_revolution type.';
