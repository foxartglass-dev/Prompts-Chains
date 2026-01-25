import React, { useState, useEffect } from 'react';

interface AISettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId?: number;
}

// Default system prompts - these are the hardcoded values that can now be customized
const DEFAULT_PROMPTS = {
  assistantSystemPrompt: `You are an expert AI Image Prompt Assistant specializing in crafting effective prompts for AI image generation models (DALL-E 3, GPT Image, FLUX, Ideogram, Seedream, etc.).

Your role is to help users:
1. Understand how different image generation models interpret prompts
2. Refine guardrails and instructions for consistent image generation
3. Suggest specific prompt techniques and wording
4. Analyze reference images and help incorporate their style
5. Troubleshoot common issues (logo visibility, pose consistency, style drift)
6. Read and analyze articles to create comprehensive image generation plans
7. Create batch image strategies based on article content

When users share their current settings or reference images, analyze them and provide actionable advice.

DIRECT FIELD EDITING:
You can DIRECTLY UPDATE fields in the Image section by using special code blocks. When you use these, the fields will be automatically updated.

GUARDRAILS FIELDS:
\`\`\`instructions
Main guardrails/instructions text (replaces instructions field)
\`\`\`

\`\`\`uniform
Worker appearance description (replaces uniform/appearance field)
\`\`\`

\`\`\`subject
Default subject description (replaces default subject field)
\`\`\`

\`\`\`avoid
Things to avoid, comma-separated (replaces avoid field)
\`\`\`

\`\`\`stylepreferences
Visual style preferences (replaces style preferences field)
\`\`\`

PROMPT TEMPLATES:
\`\`\`mainprompt
Avatar's main prompt template - use {placeholders} for dynamic content
\`\`\`

\`\`\`smartprompt
Smart prompt guidance text for GPT-guided generation
\`\`\`

MATCHING RULES (for Smart Content Matching):
\`\`\`matchingrule1
Primary keywords matching rule
\`\`\`

\`\`\`matchingrule2
Secondary keywords fallback rule
\`\`\`

\`\`\`matchingrule3
No duplicate primaries rule
\`\`\`

\`\`\`matchingrule4
Different primaries for secondary matches rule
\`\`\`

\`\`\`placementrule
Image placement algorithm rule
\`\`\`

\`\`\`smartmatchingrule
Smart matching algorithm rule
\`\`\`

TESTING:
\`\`\`testprompt
A test prompt to try (updates Testing Mode)
\`\`\`

Use these blocks when you and the user agree on changes. You can update multiple fields in one response.

SUGGESTING WITHOUT APPLYING:
If you want to suggest something for the user to review before applying, use:
\`\`\`guardrail
Suggested text here (user must click "Add to Guardrails" to apply)
\`\`\`

ARTICLE ANALYSIS:
When you receive article content in the context, analyze it to understand:
- The main topics and services discussed
- Visual scenarios that would complement the content
- Consistent themes across multiple articles
- Opportunities for hero images, inline images, and supporting visuals

When creating image plans, consider:
- Reading ALL articles first to understand the full scope
- Creating a cohesive visual strategy across articles
- Identifying recurring themes that need consistent imagery
- Suggesting specific prompts for each article section

Be concise but thorough. Focus on practical, actionable advice based on how modern image AI actually works.`,

  guidedGenerationPrompt: `You are an expert at writing prompts for AI image generation models. Your task is to create or refine image generation prompts that achieve specific goals.

IMPORTANT RULES:
1. Write ONLY the image prompt - no explanations, no markdown, no extra text
2. Be specific and detailed
3. Include style cues (photorealistic, professional, etc.)
4. Specify camera angle, lighting, setting
5. Avoid ambiguous terms
6. If refining, address the specific issues mentioned

Output format: Just the prompt text, nothing else.`,

  imageEvaluationPrompt: `You are an expert at evaluating AI-generated images against specific criteria.

Your task is to:
1. Carefully examine the provided image
2. Compare it against each point in the goal/criteria
3. Be strict but fair in your assessment
4. Identify specific issues if the goal is not met

Return your evaluation as JSON:
{
  "meetsGoal": true/false,
  "evaluation": "Your detailed assessment of how well the image meets each criterion",
  "refinementNotes": "If meetsGoal is false, specific suggestions for improving the prompt"
}

Be specific about what works and what doesn't. Reference exact details in the image.`,

  reverseImagePrompt: `You are an expert at analyzing images and generating detailed prompts for AI image generation (specifically GPT Image 1.5).

When analyzing a reference image, output your analysis in these 8 sections:
1. **Lighting**: Describe light sources, direction, intensity, color temperature
2. **Subject/Worker**: Describe the person - clothing, posture, activity, expression
3. **Eyes/Face**: Eye contact direction, facial expression, natural vs posed
4. **Logo/Branding**: Any visible branding, placement, size, clarity
5. **Environment/Setting**: Background, location, props, atmosphere
6. **Composition/Framing**: Camera angle, shot type, focus, depth of field
7. **Style/Mood**: Overall aesthetic, color palette, professional vs casual
8. **Technical Details**: Image quality cues, editing style, any effects

Focus on specific, measurable details that can be replicated. Use professional photography terminology. For people, emphasize natural expressions and body language.`,

  ideasChatPrompt: `You are a helpful assistant for capturing and formulating feature ideas for PromptFlow, an SEO content generation system.

Your role is to:
1. Listen to the user's ideas, even if they're vague or incomplete
2. Ask clarifying questions to better understand the intent
3. Help refine ideas into something actionable
4. Extract structured ideas when the conversation reveals them

When you identify a clear idea, output it in a JSON block:
\`\`\`idea
{
  "title": "Short descriptive title",
  "description": "Detailed description of the feature",
  "priority": 1-5 (1=critical, 2=high, 3=medium, 4=low, 5=nice-to-have),
  "category": "ui|backend|integration|workflow|other"
}
\`\`\`

Be conversational and helpful. Don't force structure too early - let ideas develop naturally.`,

  styleDnaPrompt: `You are an expert at analyzing visual styles for AI image generation (specifically FLUX 1.1 Pro).

Analyze the reference image and extract reusable style elements:
- Color Palette: Dominant colors, accent colors, overall tone
- Lighting: Type, direction, intensity, mood
- Composition: Framing, perspective, visual balance
- Artistic Style: Photorealistic, illustrated, graphic, etc.
- Mood/Atmosphere: Professional, casual, energetic, calm, etc.
- Recurring Elements: Common props, settings, visual motifs

Create a template prompt that captures this style with an {ACTION} placeholder for variable content.

Return JSON:
{
  "styleTemplate": "Your reusable prompt template with {ACTION} placeholder",
  "attributes": {
    "colorPalette": "description",
    "lighting": "description",
    "composition": "description",
    "style": "description",
    "mood": "description",
    "quality": "description"
  },
  "negativePrompt": "Things to avoid for this style"
}`,

  guidedPromptEngineerPrompt: `You are an expert image prompt engineer for FLUX, DALL-E, and GPT Image models.

Your task is to create detailed, photorealistic image prompts based on:
1. The provided guardrails/instructions (RESPECT THESE ABSOLUTELY)
2. The content context (article section, keywords, mood)
3. Best practices for AI image generation

Create prompts that are:
- LITERAL and SPECIFIC (avoid abstract concepts)
- Focused on ACTIONS being performed
- Include specific details about people, objects, settings, lighting
- Match the content's context and mood

Output ONLY the image prompt - no explanations, no markdown, no extra text.`
};

interface AISettings {
  assistant_system_prompt?: string;
  guided_generation_prompt?: string;
  image_evaluation_prompt?: string;
  reverse_image_prompt?: string;
  ideas_chat_prompt?: string;
  style_dna_prompt?: string;
  guided_prompt_engineer_prompt?: string;
}

const AISettingsPage: React.FC<AISettingsPageProps> = ({ isOpen, onClose, workflowId }) => {
  const [settings, setSettings] = useState<AISettings>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings when opened
  useEffect(() => {
    if (isOpen && workflowId) {
      loadSettings();
    }
  }, [isOpen, workflowId]);

  const loadSettings = async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/ai-settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
      }
    } catch (err) {
      console.error('Failed to load AI settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!workflowId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/ai-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setHasChanges(false);
      }
    } catch (err) {
      console.error('Failed to save AI settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof AISettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefault = (key: keyof AISettings) => {
    const defaultKey = key.replace(/_/g, '') as keyof typeof DEFAULT_PROMPTS;
    // Map the settings key to the DEFAULT_PROMPTS key
    const keyMap: Record<string, keyof typeof DEFAULT_PROMPTS> = {
      'assistant_system_prompt': 'assistantSystemPrompt',
      'guided_generation_prompt': 'guidedGenerationPrompt',
      'image_evaluation_prompt': 'imageEvaluationPrompt',
      'reverse_image_prompt': 'reverseImagePrompt',
      'ideas_chat_prompt': 'ideasChatPrompt',
      'style_dna_prompt': 'styleDnaPrompt',
      'guided_prompt_engineer_prompt': 'guidedPromptEngineerPrompt'
    };
    const mappedKey = keyMap[key];
    if (mappedKey && DEFAULT_PROMPTS[mappedKey]) {
      updateSetting(key, DEFAULT_PROMPTS[mappedKey]);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const renderPromptEditor = (
    key: keyof AISettings,
    title: string,
    description: string,
    defaultPromptKey: keyof typeof DEFAULT_PROMPTS
  ) => {
    const isExpanded = expandedSections.has(key);
    const currentValue = settings[key] || DEFAULT_PROMPTS[defaultPromptKey];
    const isCustom = settings[key] && settings[key] !== DEFAULT_PROMPTS[defaultPromptKey];

    return (
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(key)}
          className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition text-left"
        >
          <div className="flex items-center gap-3">
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{title}</span>
                {isCustom && (
                  <span className="px-1.5 py-0.5 bg-brand-gold/20 text-brand-gold text-[10px] rounded">
                    CUSTOMIZED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-500">
            {currentValue.length} chars
          </span>
        </button>

        {isExpanded && (
          <div className="p-3 bg-slate-900/50 space-y-3">
            <textarea
              value={currentValue}
              onChange={(e) => updateSetting(key, e.target.value)}
              className="w-full h-64 p-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs font-mono resize-y focus:ring-2 focus:ring-brand-cyan focus:border-transparent"
              placeholder="Enter system prompt..."
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resetToDefault(key)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition"
                >
                  Reset to Default
                </button>
                {isCustom && (
                  <span className="text-[10px] text-yellow-500">
                    You have customized this prompt
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">
                Default: {DEFAULT_PROMPTS[defaultPromptKey].length} chars
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-slate-900 rounded-xl border border-brand-cyan/50 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-brand-cyan flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              AI Behavior Settings
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Customize the system prompts that control AI assistant behavior across the app
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-yellow-500 animate-pulse">Unsaved changes</span>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Info Banner */}
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-300">
                    <p className="font-medium mb-1">About AI System Prompts</p>
                    <p className="text-blue-300/80">
                      These prompts control how AI assistants behave throughout the app. Customizing them
                      allows you to adjust the AI's personality, capabilities, and output format. Changes
                      take effect immediately for new conversations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Chat Assistants Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-brand-gold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat Assistants
                </h3>
                <div className="space-y-2">
                  {renderPromptEditor(
                    'assistant_system_prompt',
                    'Main AI Prompt Assistant',
                    'Controls the Guided GPT and Main Prompt AI assistants - what they can do, how they edit fields, how they analyze articles',
                    'assistantSystemPrompt'
                  )}
                  {renderPromptEditor(
                    'ideas_chat_prompt',
                    'Ideas Chat Assistant',
                    'Controls the Ideas Backlog chat assistant for capturing and formulating feature ideas',
                    'ideasChatPrompt'
                  )}
                </div>
              </div>

              {/* Image Generation Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-brand-gold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Image Generation
                </h3>
                <div className="space-y-2">
                  {renderPromptEditor(
                    'guided_generation_prompt',
                    'Guided Prompt Generation',
                    'Controls how the AI writes image generation prompts in Testing Mode and guided generation',
                    'guidedGenerationPrompt'
                  )}
                  {renderPromptEditor(
                    'guided_prompt_engineer_prompt',
                    'Guided Prompt Engineer',
                    'Controls the prompt engineering for FLUX, DALL-E, and GPT Image models',
                    'guidedPromptEngineerPrompt'
                  )}
                  {renderPromptEditor(
                    'image_evaluation_prompt',
                    'Image Evaluation',
                    'Controls how the AI evaluates generated images against criteria in Auto-Refine mode',
                    'imageEvaluationPrompt'
                  )}
                </div>
              </div>

              {/* Image Analysis Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-brand-gold mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Image Analysis
                </h3>
                <div className="space-y-2">
                  {renderPromptEditor(
                    'reverse_image_prompt',
                    'Reverse Image Analysis',
                    'Controls how the AI analyzes reference images and extracts style information',
                    'reverseImagePrompt'
                  )}
                  {renderPromptEditor(
                    'style_dna_prompt',
                    'Style DNA Extraction',
                    'Controls how the AI extracts reusable style templates from reference images',
                    'styleDnaPrompt'
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 shrink-0 bg-slate-800/50">
          <button
            onClick={() => {
              if (confirm('Reset ALL prompts to their default values? This cannot be undone.')) {
                setSettings({});
                setHasChanges(true);
              }
            }}
            className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 text-sm rounded-lg transition"
          >
            Reset All to Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-brand-cyan hover:bg-brand-cyan/80 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-medium text-sm rounded-lg transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettingsPage;
