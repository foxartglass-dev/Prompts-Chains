<?php
namespace Theme_DNA;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Renders the admin page UI
 */
class Admin_Page {

    public static function render() {
        $license = API_Client::check_license();
        ?>
        <div class="wrap theme-dna-wrap">
            <div class="theme-dna-header">
                <h1><?php esc_html_e( 'Theme DNA Generator', 'theme-dna-generator' ); ?></h1>
                <p class="theme-dna-tagline"><?php esc_html_e( 'Paste any website URL. Get a matching Elementor theme.', 'theme-dna-generator' ); ?></p>
            </div>

            <!-- License Section -->
            <div class="theme-dna-card theme-dna-license-card">
                <div class="theme-dna-license-status">
                    <span class="tier-badge tier-<?php echo esc_attr( $license['tier'] ?? 'free' ); ?>">
                        <?php echo esc_html( ucfirst( $license['tier'] ?? 'free' ) ); ?>
                    </span>
                    <span class="tier-info"><?php echo esc_html( $license['message'] ?? '' ); ?></span>
                </div>
                <div class="theme-dna-license-input">
                    <input type="text" id="theme-dna-license-key" placeholder="<?php esc_attr_e( 'Enter license key...', 'theme-dna-generator' ); ?>" value="<?php echo esc_attr( get_option( 'theme_dna_license_key', '' ) ); ?>" />
                    <button id="theme-dna-save-license" class="button"><?php esc_html_e( 'Activate', 'theme-dna-generator' ); ?></button>
                    <a href="https://themedna.com/pricing" target="_blank" class="button button-primary"><?php esc_html_e( 'Get License', 'theme-dna-generator' ); ?></a>
                </div>
            </div>

            <!-- Generator Section -->
            <div class="theme-dna-card theme-dna-generator-card">
                <h2><?php esc_html_e( 'Generate Theme', 'theme-dna-generator' ); ?></h2>
                <div class="theme-dna-url-input">
                    <input type="url" id="theme-dna-url" placeholder="<?php esc_attr_e( 'https://example.com', 'theme-dna-generator' ); ?>" />
                    <button id="theme-dna-generate" class="button button-primary button-hero">
                        <?php esc_html_e( 'Generate Theme', 'theme-dna-generator' ); ?>
                    </button>
                </div>

                <!-- Progress Section (hidden by default) -->
                <div id="theme-dna-progress" class="theme-dna-progress" style="display:none;">
                    <div class="progress-bar-wrap">
                        <div class="progress-bar" id="theme-dna-progress-bar"></div>
                    </div>
                    <p class="progress-status" id="theme-dna-progress-status"></p>
                    <p class="progress-timer" id="theme-dna-progress-timer"></p>
                </div>
            </div>

            <!-- Results Section (hidden by default) -->
            <div id="theme-dna-results" class="theme-dna-card" style="display:none;">
                <div class="theme-dna-results-header">
                    <h2><?php esc_html_e( 'Your Generated Theme', 'theme-dna-generator' ); ?></h2>
                    <button id="theme-dna-import-all" class="button button-primary">
                        <?php esc_html_e( 'Import All Pages', 'theme-dna-generator' ); ?>
                    </button>
                </div>

                <!-- Design DNA Preview -->
                <div id="theme-dna-preview" class="theme-dna-preview"></div>

                <!-- Generated Pages Grid -->
                <div id="theme-dna-pages" class="theme-dna-pages-grid"></div>
            </div>
        </div>
        <?php
    }
}
