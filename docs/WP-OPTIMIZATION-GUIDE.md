# WordPress Image Optimization Guide

This guide helps you configure WordPress for optimal image handling with PromptFlow.

## Table of Contents
1. [WebP Format](#webp-format)
2. [Image Compression](#image-compression)
3. [Media Library Organization](#media-library-organization)
4. [Performance Monitoring](#performance-monitoring)
5. [Cleanup & Maintenance](#cleanup--maintenance)

---

## 1. WebP Format

WebP images are 30-50% smaller than JPEG/PNG while maintaining quality. Here's how to enable WebP in WordPress:

### Option A: Using a Plugin (Recommended)

**EWWW Image Optimizer** (Free)
1. Install: Plugins → Add New → Search "EWWW Image Optimizer"
2. Navigate to: **Settings → EWWW Image Optimizer**
3. Click **WebP** tab
4. Check: **"WebP Conversion"**
5. Select: **"Copy Original to WebP"** for best compatibility
6. Save Changes

**ShortPixel Image Optimizer** (Free tier available)
1. Install: Plugins → Add New → Search "ShortPixel"
2. Navigate to: **Settings → ShortPixel**
3. In **Advanced** tab, find "Create WebP versions"
4. Enable it and save

**Imagify** (Free tier: 20MB/month)
1. Install: Plugins → Add New → Search "Imagify"
2. Navigate to: **Settings → Imagify**
3. Find "WebP Format" and enable it

### Option B: Server-level (.htaccess)

If you have server access, add to `.htaccess`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTP_ACCEPT} image/webp
  RewriteCond %{REQUEST_FILENAME} (.*)\.(jpe?g|png)$
  RewriteCond %{REQUEST_FILENAME}.webp -f
  RewriteRule (.+)\.(jpe?g|png)$ $1.$2.webp [T=image/webp,E=accept:1]
</IfModule>
```

---

## 2. Image Compression

### Where to Configure

**Settings → Media** (WordPress Core)
- **Thumbnail size**: 150 x 150 (default)
- **Medium size**: 300 x 300 (good for blog images)
- **Large size**: 1024 x 1024 (set to 1200px max for web)
- **Max upload file size**: Set in php.ini

**EWWW Image Optimizer Settings**
- Navigate to: Settings → EWWW Image Optimizer
- **Basic** tab:
  - Optimization Level: **Pixel Perfect** (lossless) or **Premium** (lossy)
  - Remove Metadata: Yes (removes EXIF data, reduces size)
- **Resize** tab:
  - Max Width: 1920px (good for most displays)
  - Max Height: 1080px
  - Resize Existing Images: Yes

**Compression Quality Settings by Plugin**:

| Plugin | Setting Location | Recommended Level |
|--------|-----------------|-------------------|
| EWWW | Basic → Level | Pixel Perfect or Compress 40% |
| ShortPixel | Settings → Compression | Lossy (~60% reduction) |
| Imagify | Settings → Optimization Level | Aggressive (best size) |

### Manual Image Guidelines

Before uploading to PromptFlow:
- **Resolution**: Max 1920x1080 for web
- **File size**: Under 200KB for fast loading
- **Format**: JPEG for photos, PNG for graphics with transparency

---

## 3. Media Library Organization

### Folder Organization Plugins

**FileBird** (Free)
1. Install: Plugins → Add New → Search "FileBird"
2. Go to: Media → Library
3. Create folders like:
   - `/PromptFlow/Service-Pages`
   - `/PromptFlow/Hero-Images`
   - `/PromptFlow/Avatars`

**Media Library Folders** (Free)
- Similar functionality to FileBird

### Image Naming Conventions

Use descriptive, SEO-friendly names:
- ❌ `IMG_1234.jpg`
- ✅ `kitchen-sink-cleaning-service.jpg`

---

## 4. Performance Monitoring

### PromptFlow WP Health API

Use the built-in `/api/wp-health` endpoints:

```bash
# Check media stats
GET /api/wp-health/media-stats?wpUrl=https://yoursite.com&wpUser=username&wpPassword=app_password

# Returns:
{
  "stats": {
    "totalMedia": 450,
    "estimatedStorageMB": 90,
    "mediaByType": { "image": 420, "video": 10, ... }
  }
}
```

### WordPress Health Check

1. Go to: **Tools → Site Health**
2. Check **Status** tab for:
   - PHP memory limit
   - Max upload size
   - Image library availability

### Recommended Monitoring

| Metric | Warning Level | Action |
|--------|--------------|--------|
| Total Media | >1000 items | Consider cleanup |
| Est. Storage | >500MB | Archive old images |
| Unattached Media | >50 items | Run cleanup |

---

## 5. Cleanup & Maintenance

### Finding Unattached Media

**Via Plugin:**
1. Install "Media Cleaner" plugin
2. Go to: **Media → Cleaner**
3. Scan for: Unattached media
4. Review and delete unused images

**Via PromptFlow API:**
```bash
# Find unattached media (dry run)
POST /api/wp-health/cleanup-unused
{
  "wpUrl": "https://yoursite.com",
  "wpUser": "username",
  "wpPassword": "app_password",
  "dryRun": true,
  "limit": 50
}

# Actually delete (be careful!)
POST /api/wp-health/cleanup-unused
{
  ...
  "dryRun": false
}
```

### Regular Maintenance Schedule

**Weekly:**
- Check Site Health status
- Review new uploads for proper formatting

**Monthly:**
- Run media cleanup scan
- Check total storage usage
- Review WP Health stats in PromptFlow

**Quarterly:**
- Full media library audit
- Remove/archive unused images
- Regenerate thumbnails if needed

### Regenerating Thumbnails

After changing image size settings:

1. Install "Regenerate Thumbnails" plugin
2. Go to: **Tools → Regenerate Thumbnails**
3. Click "Regenerate Thumbnails For All Attachments"

---

## Quick Reference: Plugin Settings Locations

| Setting | Plugin | Path |
|---------|--------|------|
| WebP Enable | EWWW | Settings → EWWW → WebP |
| Compression | ShortPixel | Settings → ShortPixel → Compression |
| Max Upload Size | PHP | php.ini (upload_max_filesize) |
| Image Dimensions | WP Core | Settings → Media |
| Lazy Loading | WP Core | Enabled by default (WP 5.5+) |
| CDN | Jetpack/Cloudflare | Settings → Performance |

---

## Troubleshooting

### Images Not Converting to WebP
1. Check plugin is activated
2. Verify server supports WebP (libwebp)
3. Clear cache after enabling

### Large File Upload Errors
Edit `php.ini` or `.htaccess`:
```
upload_max_filesize = 64M
post_max_size = 64M
max_execution_time = 300
```

### Slow Media Library
1. Install "Media Library Assistant" for better performance
2. Disable media grid view (use list view)
3. Consider CDN for image delivery

---

*Last updated: January 2026*
