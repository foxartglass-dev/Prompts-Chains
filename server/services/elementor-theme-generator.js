/**
 * Elementor Theme Generator
 *
 * Takes design DNA (extracted from a screenshot/URL) and generates
 * complete Elementor page templates for a full website:
 *   - Home Page
 *   - About Us
 *   - Services (+ individual service page)
 *   - Contact Us
 *   - Blog / Articles listing
 *
 * Uses the same Elementor JSON container/widget structure as elementor-builder.js
 * so pages can be imported directly into WordPress via the Elementor REST API.
 */

let idCounter = 0;

function generateElementId() {
  idCounter++;
  return `theme${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).substring(2, 6)}`;
}

// Reset ID counter between generations
function resetIds() {
  idCounter = 0;
}

// ============================================
// PRIMITIVE BUILDERS (mirror elementor-builder.js structure)
// ============================================

function buildContainer(elements, options = {}) {
  const {
    direction = 'column',
    isInner = false,
    padding = { top: '0', right: '0', bottom: '0', left: '0' },
    gap = '20',
    contentWidth = 'boxed',
    boxedWidth = 1140,
    alignItems = 'flex-start',
    justifyContent = 'flex-start',
    width = null,
    backgroundColor = null,
    backgroundImage = null,
    backgroundOverlay = null,
    borderRadius = null,
    cssClasses = ''
  } = options;

  const settings = {
    flex_direction: direction,
    content_width: contentWidth,
    boxed_width: { unit: 'px', size: boxedWidth },
    flex_gap: { column: gap, row: gap, unit: 'px' },
    padding: { unit: 'px', ...padding, isLinked: false }
  };

  if (direction === 'row') {
    settings.flex_align_items = alignItems;
  }
  if (justifyContent !== 'flex-start') {
    settings.flex_justify_content = justifyContent;
  }
  if (width) {
    settings._flex_size = 'custom';
    settings._flex_size_custom = { unit: '%', size: parseInt(width) };
  }
  if (backgroundColor) {
    settings.background_background = 'classic';
    settings.background_color = backgroundColor;
  }
  if (backgroundImage) {
    settings.background_background = 'classic';
    settings.background_image = { url: backgroundImage };
    if (backgroundOverlay) {
      settings.background_overlay_background = 'classic';
      settings.background_overlay_color = backgroundOverlay;
      settings.background_overlay_opacity = { unit: 'px', size: 0.7 };
    }
  }
  if (borderRadius) {
    settings.border_radius = { unit: 'px', top: borderRadius, right: borderRadius, bottom: borderRadius, left: borderRadius, isLinked: true };
  }
  if (cssClasses) {
    settings.css_classes = cssClasses;
  }

  return {
    id: generateElementId(),
    elType: 'container',
    isInner,
    settings,
    elements
  };
}

function buildHeading(text, tag = 'h2', options = {}) {
  const { align = 'left', color = null, fontSize = null, fontFamily = null, fontWeight = null } = options;
  const settings = {
    title: text,
    header_size: tag,
    align
  };
  if (color) settings.title_color = color;
  if (fontSize || fontFamily || fontWeight) {
    settings.typography_typography = 'custom';
    if (fontSize) settings.typography_font_size = { unit: 'px', size: parseInt(fontSize) };
    if (fontFamily) settings.typography_font_family = fontFamily;
    if (fontWeight) settings.typography_font_weight = fontWeight;
  }
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'heading',
    isInner: false,
    settings,
    elements: []
  };
}

function buildText(html, options = {}) {
  const { color = null, fontSize = null, fontFamily = null } = options;
  const settings = { editor: html };
  if (color) settings.text_color = color;
  if (fontSize || fontFamily) {
    settings.typography_typography = 'custom';
    if (fontSize) settings.typography_font_size = { unit: 'px', size: parseInt(fontSize) };
    if (fontFamily) settings.typography_font_family = fontFamily;
  }
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'text-editor',
    isInner: false,
    settings,
    elements: []
  };
}

function buildButton(text, url = '#', options = {}) {
  const { backgroundColor = null, textColor = null, borderRadius = null, size = 'md', align = 'left', fullWidth = false } = options;
  const settings = {
    text,
    link: { url, is_external: false, nofollow: false },
    align,
    size
  };
  if (backgroundColor) settings.button_background_color = backgroundColor;
  if (textColor) settings.button_text_color = textColor;
  if (borderRadius) settings.border_radius = { unit: 'px', top: borderRadius, right: borderRadius, bottom: borderRadius, left: borderRadius, isLinked: true };
  if (fullWidth) settings.button_css_class = 'elementor-button-full-width';
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'button',
    isInner: false,
    settings,
    elements: []
  };
}

function buildImage(url, alt = '', options = {}) {
  const { width = null, borderRadius = null, align = 'center' } = options;
  const settings = {
    image: { url, alt },
    align
  };
  if (width) settings.image_size_width = { unit: 'px', size: parseInt(width) };
  if (borderRadius) settings.image_border_radius = { unit: 'px', top: borderRadius, right: borderRadius, bottom: borderRadius, left: borderRadius, isLinked: true };
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'image',
    isInner: false,
    settings,
    elements: []
  };
}

function buildSpacer(size = 40) {
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'spacer',
    isInner: false,
    settings: { space: { unit: 'px', size } },
    elements: []
  };
}

function buildDivider(options = {}) {
  const { color = '#e0e0e0', weight = 1, width = 100 } = options;
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'divider',
    isInner: false,
    settings: {
      color,
      weight: { unit: 'px', size: weight },
      width: { unit: '%', size: width }
    },
    elements: []
  };
}

function buildIconBox(icon, title, description, options = {}) {
  const { color = null, titleColor = null, descColor = null } = options;
  const settings = {
    selected_icon: { value: icon, library: 'fa-solid' },
    title_text: title,
    description_text: description,
    position: 'top',
    title_size: 'h3'
  };
  if (color) settings.primary_color = color;
  if (titleColor) settings.title_color = titleColor;
  if (descColor) settings.description_color = descColor;
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'icon-box',
    isInner: false,
    settings,
    elements: []
  };
}

function buildForm(fields, options = {}) {
  const { buttonText = 'Send Message', buttonBg = null, buttonColor = null } = options;
  const formFields = fields.map((f, i) => ({
    custom_id: f.id || `field_${i}`,
    field_type: f.type || 'text',
    field_label: f.label,
    placeholder: f.placeholder || f.label,
    required: f.required ? 'true' : '',
    width: f.width || '100',
    _id: generateElementId()
  }));
  const settings = {
    form_name: 'Contact Form',
    form_fields: formFields,
    button_text: buttonText,
    email_to: '{{admin_email}}'
  };
  if (buttonBg) settings.button_background_color = buttonBg;
  if (buttonColor) settings.button_color = buttonColor;
  return {
    id: generateElementId(),
    elType: 'widget',
    widgetType: 'form',
    isInner: false,
    settings,
    elements: []
  };
}

// ============================================
// SECTION BUILDERS (reusable page sections)
// ============================================

function buildHeroSection(dna, options = {}) {
  const { title, subtitle, ctaText, ctaUrl = '#', layout = 'split' } = options;
  const brand = dna.colors?.brandDefault || '#2563eb';
  const textPrimary = dna.colors?.textPrimary || '#111827';
  const textSecondary = dna.colors?.textSecondary || '#6b7280';
  const surfaceCanvas = dna.colors?.surfaceCanvas || '#ffffff';
  const fontFamily = dna.typography?.fontFamily || 'Inter';
  const btnRadius = dna.components?.buttons?.radius?.replace('px', '') || '8';

  const textElements = [
    buildHeading(title, 'h1', {
      color: textPrimary,
      fontFamily,
      fontWeight: dna.typography?.h1?.weight || '700',
      fontSize: dna.typography?.h1?.size?.replace('px', '') || '48'
    }),
    buildText(`<p>${subtitle}</p>`, {
      color: textSecondary,
      fontSize: dna.typography?.body?.size?.replace('px', '') || '18',
      fontFamily
    })
  ];

  if (ctaText) {
    textElements.push(buildButton(ctaText, ctaUrl, {
      backgroundColor: brand,
      textColor: dna.components?.buttons?.textColor || '#ffffff',
      borderRadius: btnRadius,
      size: 'lg'
    }));
  }

  const textCol = buildContainer(textElements, {
    isInner: true,
    direction: 'column',
    gap: '20',
    contentWidth: 'full',
    width: layout === 'split' ? '50' : '100',
    justifyContent: 'center'
  });

  if (layout === 'split') {
    const imageCol = buildContainer([
      buildImage('', 'Hero image', { borderRadius: dna.components?.cards?.radius?.replace('px', '') || '12' })
    ], {
      isInner: true,
      direction: 'column',
      contentWidth: 'full',
      width: '50',
      justifyContent: 'center'
    });

    return buildContainer([textCol, imageCol], {
      direction: 'row',
      padding: { top: '80', right: '20', bottom: '80', left: '20' },
      gap: '40',
      contentWidth: 'boxed',
      backgroundColor: surfaceCanvas,
      alignItems: 'center'
    });
  }

  // Centered layout
  return buildContainer([textCol], {
    padding: { top: '100', right: '20', bottom: '100', left: '20' },
    gap: '20',
    contentWidth: 'boxed',
    backgroundColor: surfaceCanvas
  });
}

function buildNavSection(dna, options = {}) {
  const { siteName = 'Brand', links = ['Home', 'About', 'Services', 'Contact'] } = options;
  const surfaceBase = dna.colors?.surfaceBase || '#ffffff';
  const textPrimary = dna.colors?.textPrimary || '#111827';
  const fontFamily = dna.typography?.fontFamily || 'Inter';

  const logoEl = buildHeading(siteName, 'h3', { color: textPrimary, fontFamily, fontWeight: '700' });
  const navHtml = links.map(l => `<a href="#" style="color:${textPrimary}; text-decoration:none; margin:0 16px; font-family:${fontFamily};">${l}</a>`).join('');
  const navEl = buildText(navHtml, { fontFamily });

  const logoCol = buildContainer([logoEl], { isInner: true, contentWidth: 'full', width: '30' });
  const navCol = buildContainer([navEl], { isInner: true, contentWidth: 'full', width: '70', justifyContent: 'flex-end' });

  return buildContainer([logoCol, navCol], {
    direction: 'row',
    padding: { top: '15', right: '30', bottom: '15', left: '30' },
    contentWidth: 'boxed',
    backgroundColor: surfaceBase,
    alignItems: 'center'
  });
}

function buildFooterSection(dna, options = {}) {
  const { siteName = 'Brand', year = new Date().getFullYear() } = options;
  const surfaceMuted = dna.colors?.surfaceMuted || '#1f2937';
  const textTertiary = dna.colors?.textTertiary || '#9ca3af';
  const fontFamily = dna.typography?.fontFamily || 'Inter';

  return buildContainer([
    buildText(`<p style="text-align:center; color:${textTertiary};">&copy; ${year} ${siteName}. All rights reserved.</p>`, { fontFamily })
  ], {
    padding: { top: '40', right: '20', bottom: '40', left: '20' },
    contentWidth: 'boxed',
    backgroundColor: surfaceMuted
  });
}

function buildCardGrid(dna, cards, options = {}) {
  const { columns = 3 } = options;
  const brand = dna.colors?.brandDefault || '#2563eb';
  const surfaceBase = dna.colors?.surfaceBase || '#ffffff';
  const textPrimary = dna.colors?.textPrimary || '#111827';
  const textSecondary = dna.colors?.textSecondary || '#6b7280';
  const fontFamily = dna.typography?.fontFamily || 'Inter';
  const cardRadius = dna.components?.cards?.radius?.replace('px', '') || '12';
  const cardShadow = dna.components?.cards?.shadow || '0 1px 3px rgba(0,0,0,0.1)';
  const cardBorder = dna.components?.cards?.border || 'none';
  const colWidth = Math.floor(100 / columns).toString();

  const cardElements = cards.map(card => {
    const els = [];
    if (card.icon) els.push(buildIconBox(card.icon, card.title, card.description, { color: brand, titleColor: textPrimary, descColor: textSecondary }));
    else {
      els.push(buildHeading(card.title, 'h3', { color: textPrimary, fontFamily, fontWeight: '600' }));
      els.push(buildText(`<p>${card.description}</p>`, { color: textSecondary, fontFamily }));
    }
    if (card.ctaText) els.push(buildButton(card.ctaText, card.ctaUrl || '#', { backgroundColor: brand, textColor: '#ffffff', borderRadius: dna.components?.buttons?.radius?.replace('px', '') || '8' }));

    return buildContainer(els, {
      isInner: true,
      direction: 'column',
      padding: { top: '30', right: '25', bottom: '30', left: '25' },
      gap: '15',
      contentWidth: 'full',
      width: colWidth,
      backgroundColor: surfaceBase,
      borderRadius: cardRadius
    });
  });

  return buildContainer(cardElements, {
    direction: 'row',
    gap: dna.spacing?.cardGaps?.replace('px', '') || '24',
    contentWidth: 'boxed',
    padding: { top: '60', right: '20', bottom: '60', left: '20' },
    alignItems: 'stretch'
  });
}

function buildSectionWithHeading(dna, title, subtitle, innerElements, options = {}) {
  const { backgroundColor = null } = options;
  const textPrimary = dna.colors?.textPrimary || '#111827';
  const textSecondary = dna.colors?.textSecondary || '#6b7280';
  const fontFamily = dna.typography?.fontFamily || 'Inter';

  const elements = [
    buildHeading(title, 'h2', { align: 'center', color: textPrimary, fontFamily, fontWeight: dna.typography?.h2?.weight || '600', fontSize: dna.typography?.h2?.size?.replace('px', '') || '36' }),
    buildText(`<p style="text-align:center;">${subtitle}</p>`, { color: textSecondary, fontFamily }),
    buildSpacer(20),
    ...innerElements
  ];

  return buildContainer(elements, {
    padding: { top: '60', right: '20', bottom: '60', left: '20' },
    gap: '20',
    contentWidth: 'boxed',
    backgroundColor
  });
}

// ============================================
// PAGE GENERATORS
// ============================================

function buildHomePage(dna, options = {}) {
  const { siteName = 'Brand', tagline = 'Welcome to our website', ctaText = 'Get Started', ctaUrl = '#' } = options;
  resetIds();

  const sections = [
    buildNavSection(dna, { siteName }),

    // Hero
    buildHeroSection(dna, {
      title: tagline,
      subtitle: 'We deliver exceptional results through innovative solutions tailored to your needs.',
      ctaText,
      ctaUrl,
      layout: 'split'
    }),

    // Services preview
    buildSectionWithHeading(dna, 'What We Do', 'Our core services designed to help you succeed.', [
      buildCardGrid(dna, [
        { icon: 'fas fa-rocket', title: 'Strategy', description: 'Data-driven strategies that deliver measurable results and sustainable growth.' },
        { icon: 'fas fa-palette', title: 'Design', description: 'Beautiful, functional designs that capture your brand essence and engage users.' },
        { icon: 'fas fa-code', title: 'Development', description: 'Robust, scalable solutions built with modern technology and best practices.' }
      ])
    ]),

    // About preview
    buildSectionWithHeading(dna, 'Why Choose Us', 'Trusted by businesses worldwide.', [
      buildCardGrid(dna, [
        { icon: 'fas fa-award', title: '10+ Years Experience', description: 'A decade of delivering excellence across industries.' },
        { icon: 'fas fa-users', title: '500+ Happy Clients', description: 'Building lasting relationships through outstanding results.' },
        { icon: 'fas fa-chart-line', title: 'Proven Results', description: 'Measurable outcomes that drive real business growth.' }
      ])
    ], { backgroundColor: dna.colors?.surfaceMuted || '#f9fafb' }),

    // CTA
    buildContainer([
      buildHeading('Ready to Get Started?', 'h2', { align: 'center', color: '#ffffff', fontFamily: dna.typography?.fontFamily || 'Inter', fontWeight: '700', fontSize: '36' }),
      buildText('<p style="text-align:center; color:rgba(255,255,255,0.9);">Let\'s discuss how we can help you achieve your goals.</p>'),
      buildButton('Contact Us', '#', { backgroundColor: '#ffffff', textColor: dna.colors?.brandDefault || '#2563eb', borderRadius: dna.components?.buttons?.radius?.replace('px', '') || '8', size: 'lg' })
    ], {
      padding: { top: '80', right: '20', bottom: '80', left: '20' },
      gap: '20',
      contentWidth: 'boxed',
      backgroundColor: dna.colors?.brandDefault || '#2563eb'
    }),

    buildFooterSection(dna, { siteName })
  ];

  return wrapPage(sections, 'Home');
}

function buildAboutPage(dna, options = {}) {
  const { siteName = 'Brand' } = options;
  resetIds();

  const sections = [
    buildNavSection(dna, { siteName }),

    buildHeroSection(dna, {
      title: `About ${siteName}`,
      subtitle: 'Learn about our story, our mission, and the team behind our success.',
      layout: 'centered'
    }),

    // Our Story
    buildSectionWithHeading(dna, 'Our Story', 'How it all began.', [
      buildText(`<p>Founded with a passion for excellence, ${siteName} has grown from a small startup into a trusted partner for businesses of all sizes. Our journey has been defined by innovation, dedication, and an unwavering commitment to delivering value to our clients.</p><p>We believe that every business deserves access to world-class solutions, and we work tirelessly to make that a reality.</p>`, {
        color: dna.colors?.textSecondary || '#6b7280',
        fontFamily: dna.typography?.fontFamily || 'Inter'
      })
    ]),

    // Values
    buildSectionWithHeading(dna, 'Our Values', 'The principles that guide everything we do.', [
      buildCardGrid(dna, [
        { icon: 'fas fa-heart', title: 'Passion', description: 'We love what we do, and it shows in every project we deliver.' },
        { icon: 'fas fa-handshake', title: 'Integrity', description: 'Honest, transparent relationships are the foundation of our business.' },
        { icon: 'fas fa-lightbulb', title: 'Innovation', description: 'We constantly push boundaries to find better solutions.' },
        { icon: 'fas fa-bullseye', title: 'Excellence', description: 'We settle for nothing less than the highest quality in everything.' }
      ], { columns: 4 })
    ], { backgroundColor: dna.colors?.surfaceMuted || '#f9fafb' }),

    // Team
    buildSectionWithHeading(dna, 'Meet the Team', 'The people making it happen.', [
      buildCardGrid(dna, [
        { title: 'Jane Smith', description: 'Founder & CEO' },
        { title: 'John Davis', description: 'Creative Director' },
        { title: 'Sarah Johnson', description: 'Head of Development' }
      ])
    ]),

    buildFooterSection(dna, { siteName })
  ];

  return wrapPage(sections, 'About Us');
}

function buildServicesPage(dna, options = {}) {
  const { siteName = 'Brand', services = null } = options;
  resetIds();

  const defaultServices = [
    { icon: 'fas fa-search', title: 'SEO Optimization', description: 'Improve your search rankings and drive organic traffic with our proven SEO strategies.', ctaText: 'Learn More', ctaUrl: '#' },
    { icon: 'fas fa-paint-brush', title: 'Web Design', description: 'Custom website designs that reflect your brand and convert visitors into customers.', ctaText: 'Learn More', ctaUrl: '#' },
    { icon: 'fas fa-bullhorn', title: 'Digital Marketing', description: 'Comprehensive marketing campaigns across all channels to maximize your reach.', ctaText: 'Learn More', ctaUrl: '#' },
    { icon: 'fas fa-mobile-alt', title: 'App Development', description: 'Native and cross-platform mobile applications built for performance.', ctaText: 'Learn More', ctaUrl: '#' },
    { icon: 'fas fa-cloud', title: 'Cloud Solutions', description: 'Scalable cloud infrastructure and migration services for modern businesses.', ctaText: 'Learn More', ctaUrl: '#' },
    { icon: 'fas fa-shield-alt', title: 'Cybersecurity', description: 'Protect your business with enterprise-grade security solutions and monitoring.', ctaText: 'Learn More', ctaUrl: '#' }
  ];

  const svcList = services || defaultServices;

  const sections = [
    buildNavSection(dna, { siteName }),

    buildHeroSection(dna, {
      title: 'Our Services',
      subtitle: 'Comprehensive solutions tailored to your business needs.',
      layout: 'centered'
    }),

    buildSectionWithHeading(dna, 'What We Offer', 'Explore our full range of professional services.', [
      buildCardGrid(dna, svcList.slice(0, 3)),
      buildSpacer(10),
      buildCardGrid(dna, svcList.slice(3, 6))
    ]),

    // Process section
    buildSectionWithHeading(dna, 'Our Process', 'A simple, effective approach to delivering results.', [
      buildCardGrid(dna, [
        { icon: 'fas fa-comments', title: '1. Discover', description: 'We listen to understand your goals, challenges, and vision.' },
        { icon: 'fas fa-drafting-compass', title: '2. Plan', description: 'We create a detailed roadmap tailored to your objectives.' },
        { icon: 'fas fa-hammer', title: '3. Build', description: 'Our team executes with precision, keeping you informed at every step.' },
        { icon: 'fas fa-rocket', title: '4. Launch', description: 'We deliver, optimize, and support your success long-term.' }
      ], { columns: 4 })
    ], { backgroundColor: dna.colors?.surfaceMuted || '#f9fafb' }),

    buildFooterSection(dna, { siteName })
  ];

  return wrapPage(sections, 'Services');
}

function buildContactPage(dna, options = {}) {
  const { siteName = 'Brand' } = options;
  resetIds();
  const brand = dna.colors?.brandDefault || '#2563eb';
  const fontFamily = dna.typography?.fontFamily || 'Inter';
  const textSecondary = dna.colors?.textSecondary || '#6b7280';

  const formWidget = buildForm([
    { id: 'name', label: 'Your Name', type: 'text', required: true, width: '50' },
    { id: 'email', label: 'Email Address', type: 'email', required: true, width: '50' },
    { id: 'phone', label: 'Phone Number', type: 'tel', width: '50' },
    { id: 'subject', label: 'Subject', type: 'text', width: '50' },
    { id: 'message', label: 'Message', type: 'textarea', required: true, width: '100' }
  ], {
    buttonText: 'Send Message',
    buttonBg: brand,
    buttonColor: '#ffffff'
  });

  const contactInfo = buildContainer([
    buildHeading('Get in Touch', 'h3', { color: dna.colors?.textPrimary || '#111827', fontFamily }),
    buildText(`<p>We'd love to hear from you. Reach out using the form or contact us directly.</p>`, { color: textSecondary, fontFamily }),
    buildSpacer(20),
    buildIconBox('fas fa-map-marker-alt', 'Address', '123 Business St, Suite 100, City, State 12345', { color: brand }),
    buildIconBox('fas fa-phone', 'Phone', '(555) 123-4567', { color: brand }),
    buildIconBox('fas fa-envelope', 'Email', 'hello@example.com', { color: brand })
  ], {
    isInner: true,
    direction: 'column',
    gap: '15',
    contentWidth: 'full',
    width: '40'
  });

  const formCol = buildContainer([formWidget], {
    isInner: true,
    direction: 'column',
    contentWidth: 'full',
    width: '60',
    padding: { top: '30', right: '30', bottom: '30', left: '30' },
    backgroundColor: dna.colors?.surfaceBase || '#ffffff',
    borderRadius: dna.components?.cards?.radius?.replace('px', '') || '12'
  });

  const sections = [
    buildNavSection(dna, { siteName }),

    buildHeroSection(dna, {
      title: 'Contact Us',
      subtitle: 'Have a question or ready to start a project? We\'re here to help.',
      layout: 'centered'
    }),

    buildContainer([contactInfo, formCol], {
      direction: 'row',
      padding: { top: '60', right: '20', bottom: '60', left: '20' },
      gap: '40',
      contentWidth: 'boxed',
      alignItems: 'flex-start'
    }),

    // Map placeholder
    buildContainer([
      buildText('<p style="text-align:center; padding:60px 0; color:#9ca3af;">[ Google Map Embed ]</p>')
    ], {
      padding: { top: '0', right: '0', bottom: '0', left: '0' },
      contentWidth: 'full',
      backgroundColor: dna.colors?.surfaceMuted || '#f3f4f6'
    }),

    buildFooterSection(dna, { siteName })
  ];

  return wrapPage(sections, 'Contact Us');
}

function buildBlogPage(dna, options = {}) {
  const { siteName = 'Brand' } = options;
  resetIds();

  const placeholderPosts = [
    { title: 'Getting Started with Modern Web Design', description: 'Explore the latest trends and best practices for creating stunning websites in 2025.' },
    { title: '5 SEO Strategies That Actually Work', description: 'Cut through the noise and focus on proven techniques that drive real organic traffic.' },
    { title: 'The Future of Digital Marketing', description: 'How AI, automation, and personalization are reshaping how businesses connect with customers.' },
    { title: 'Building a Brand That Stands Out', description: 'Practical steps to develop a memorable brand identity that resonates with your audience.' },
    { title: 'Why Page Speed Matters More Than Ever', description: 'The direct impact of site performance on user experience, conversions, and search rankings.' },
    { title: 'Client Success Story: 300% Traffic Growth', description: 'How we helped a local business triple their website traffic in just six months.' }
  ];

  const sections = [
    buildNavSection(dna, { siteName }),

    buildHeroSection(dna, {
      title: 'Blog & Insights',
      subtitle: 'Expert tips, industry trends, and company news.',
      layout: 'centered'
    }),

    buildSectionWithHeading(dna, 'Latest Articles', 'Stay up to date with our newest posts.', [
      buildCardGrid(dna, placeholderPosts.slice(0, 3).map(p => ({ ...p, ctaText: 'Read More', ctaUrl: '#' }))),
      buildSpacer(10),
      buildCardGrid(dna, placeholderPosts.slice(3, 6).map(p => ({ ...p, ctaText: 'Read More', ctaUrl: '#' })))
    ]),

    buildFooterSection(dna, { siteName })
  ];

  return wrapPage(sections, 'Blog');
}

function buildLandingPage(dna, options = {}) {
  const { siteName = 'Brand', headline = 'Transform Your Business Today', offer = 'Get your free consultation now.' } = options;
  resetIds();
  const brand = dna.colors?.brandDefault || '#2563eb';

  const sections = [
    // Hero with strong CTA
    buildHeroSection(dna, {
      title: headline,
      subtitle: offer,
      ctaText: 'Claim Your Free Consultation',
      ctaUrl: '#',
      layout: 'split'
    }),

    // Social proof
    buildSectionWithHeading(dna, 'Trusted by Industry Leaders', 'Join hundreds of businesses that have transformed their results.', [
      buildCardGrid(dna, [
        { icon: 'fas fa-star', title: '4.9/5 Rating', description: 'Based on 200+ verified reviews from happy clients.' },
        { icon: 'fas fa-trophy', title: 'Award Winning', description: 'Recognized for excellence in design and digital marketing.' },
        { icon: 'fas fa-clock', title: '24/7 Support', description: 'Our team is always available to help when you need us.' }
      ])
    ]),

    // Features
    buildSectionWithHeading(dna, 'What You Get', 'Everything included in our comprehensive package.', [
      buildCardGrid(dna, [
        { icon: 'fas fa-check-circle', title: 'Custom Strategy', description: 'A personalized plan designed specifically for your business goals.' },
        { icon: 'fas fa-check-circle', title: 'Expert Execution', description: 'Our team of specialists handles every detail from start to finish.' },
        { icon: 'fas fa-check-circle', title: 'Ongoing Optimization', description: 'Continuous improvements based on real data and performance metrics.' }
      ])
    ], { backgroundColor: dna.colors?.surfaceMuted || '#f9fafb' }),

    // Final CTA
    buildContainer([
      buildHeading('Don\'t Wait — Start Growing Today', 'h2', { align: 'center', color: '#ffffff', fontFamily: dna.typography?.fontFamily || 'Inter', fontWeight: '700', fontSize: '36' }),
      buildText('<p style="text-align:center; color:rgba(255,255,255,0.9);">Limited spots available. Book your free consultation before they\'re gone.</p>'),
      buildButton('Get Started Now', '#', { backgroundColor: '#ffffff', textColor: brand, borderRadius: '8', size: 'lg' })
    ], {
      padding: { top: '80', right: '20', bottom: '80', left: '20' },
      gap: '20',
      contentWidth: 'boxed',
      backgroundColor: brand
    })
  ];

  return wrapPage(sections, 'Landing Page');
}

// ============================================
// WRAPPER + EXPORTS
// ============================================

function wrapPage(sections, title) {
  const rootContainer = buildContainer(sections, {
    direction: 'column',
    padding: { top: '0', right: '0', bottom: '0', left: '0' },
    contentWidth: 'full'
  });

  return {
    content: [rootContainer],
    page_settings: [],
    version: '0.4',
    title,
    type: 'page'
  };
}

/**
 * Generate all Elementor page templates from design DNA
 * @param {object} designDNA - The extracted design DNA
 * @param {object} options - { siteName, tagline, ctaText, ctaUrl }
 * @returns {object} Map of page name → Elementor JSON
 */
export function generateElementorTheme(designDNA, options = {}) {
  const { siteName = 'Brand', tagline, ctaText, ctaUrl } = options;
  const shared = { siteName, tagline, ctaText, ctaUrl };

  return {
    home: buildHomePage(designDNA, shared),
    about: buildAboutPage(designDNA, shared),
    services: buildServicesPage(designDNA, shared),
    contact: buildContactPage(designDNA, shared),
    blog: buildBlogPage(designDNA, shared),
    landing: buildLandingPage(designDNA, { ...shared, headline: tagline })
  };
}

/**
 * Convert an Elementor page to the JSON string WordPress expects for _elementor_data
 */
export function toElementorData(page) {
  return JSON.stringify(page.content);
}

export default { generateElementorTheme, toElementorData };
