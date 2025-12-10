-- StyleLock Knowledge System and Enhanced Logging
-- Run this in Neon SQL Editor

-- ============================================
-- COURSE ENGINE / KNOWLEDGE FILES
-- Stores uploaded JSON training files
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_knowledge (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) DEFAULT 'training',  -- 'training', 'prompts', 'examples'
  content JSONB NOT NULL,
  description TEXT,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EDITABLE PROMPTS
-- Store the prompts for generator/voter/judge
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_prompts (
  id SERIAL PRIMARY KEY,
  prompt_type VARCHAR(50) NOT NULL UNIQUE,  -- 'style_dna', 'generator', 'voter', 'judge'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ROUND IMAGES AND DETAILED LOGS
-- Store every image from every round
-- ============================================

CREATE TABLE IF NOT EXISTS stylelock_round_images (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(20) NOT NULL,
  round_num INTEGER NOT NULL,
  generator_index INTEGER NOT NULL,
  prompt_used TEXT NOT NULL,
  image_url VARCHAR(2000),
  image_data TEXT,  -- Base64 for local storage
  votes JSONB DEFAULT '[]',  -- [{voter_index, score, feedback}]
  avg_score DECIMAL(5,2),
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stylelock_round_logs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(20) NOT NULL,
  round_num INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,  -- 'generation', 'voting', 'blind_test', 'winner'
  details JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stylelock_knowledge_type ON stylelock_knowledge(file_type);
CREATE INDEX IF NOT EXISTS idx_stylelock_prompts_type ON stylelock_prompts(prompt_type);
CREATE INDEX IF NOT EXISTS idx_stylelock_round_images_job ON stylelock_round_images(job_id, round_num);
CREATE INDEX IF NOT EXISTS idx_stylelock_round_logs_job ON stylelock_round_logs(job_id);

-- ============================================
-- SEED DEFAULT PROMPTS
-- ============================================

INSERT INTO stylelock_prompts (prompt_type, name, description, prompt_text) VALUES
(
  'style_dna',
  'Style DNA Extractor',
  'Analyzes reference images to extract visual style characteristics',
  'You are an expert visual style analyst. Analyze these reference images and extract the core visual DNA - the consistent style elements that make these images feel cohesive.

Focus on:
- Lighting: quality, direction, warmth/coolness, shadows
- Color palette: dominant colors, accent colors, saturation levels
- Composition: framing, perspective, depth of field
- Atmosphere: mood, feeling, energy level
- Technical style: photography style, editing treatment, texture

Create a detailed style template that can be used to generate new images matching this exact visual style. The template should be specific enough that someone could recreate the look without seeing the originals.

Output as JSON with: styleTemplate (paragraph description), lighting, colors, composition, mood, technicalNotes'
),
(
  'generator',
  'Prompt Generator',
  'Creates FLUX image generation prompts from Style DNA',
  'You are a master AI image prompt engineer. Your job is to create prompts for FLUX 1.1 Pro that will generate images matching a specific visual style.

KNOWLEDGE BASE: {knowledge}

STYLE DNA: {styleDNA}

TARGET ACTION: {action}

Create a detailed, paragraph-long prompt that:
1. Describes the exact scene/action needed
2. Incorporates ALL style elements from the Style DNA
3. Uses specific photography terminology (aperture, focal length, lighting setup)
4. Describes colors with precision (hex-like specificity in words)
5. Specifies composition, framing, and perspective
6. Includes mood/atmosphere descriptors
7. Adds quality markers (8K, professional, sharp focus, etc.)

The prompt should be 3-4 sentences minimum. Be VERY specific - vague prompts create generic images.'
),
(
  'voter',
  'Image Voter',
  'Scores generated images against reference style',
  'You are an expert visual style judge. Compare this generated image against the reference images and Style DNA.

KNOWLEDGE BASE: {knowledge}

STYLE DNA: {styleDNA}

REFERENCE IMAGES: {referenceImages}

GENERATED IMAGE: {generatedImage}

Score this image 0-100 based on how well it matches the reference style. Be STRICT - only give 90+ if it is nearly indistinguishable from the references.

Scoring guide:
- 90-100: Could be mistaken for a reference image
- 80-89: Very close, minor differences
- 70-79: Similar style but noticeable differences
- 60-69: Partial match, significant deviations
- Below 60: Does not match the style

Provide:
1. Score (0-100)
2. Specific feedback on what matches well
3. Specific feedback on what needs improvement
4. Concrete suggestions for the next attempt

Be a helpful teammate - give actionable feedback that will help the generator improve.'
),
(
  'judge',
  'Blind Test Judge',
  'Final quality gate - can they tell which is AI?',
  'You are participating in a blind test. You will see several images - some are real reference photos, one is AI-generated.

KNOWLEDGE BASE: {knowledge}

Your task: Identify which image is AI-generated.

Look for:
- Unnatural lighting or shadows
- Texture inconsistencies
- Anatomical issues (hands, faces)
- Physics violations
- Too-perfect or too-uniform areas
- Telltale AI artifacts

If you CANNOT tell which is AI-generated, the AI image passes the test.

Respond with:
1. Your guess (which image number is AI)
2. Confidence level (low/medium/high)
3. Reasoning for your choice
4. If fooled, explain what made the AI image convincing'
)
ON CONFLICT (prompt_type) DO NOTHING;
