<?php
/**
 * Plugin Name: Theme DNA Generator
 * Plugin URI: https://themedna.com
 * Description: Paste any website URL and instantly generate a matching Elementor theme for your WordPress site. Extracts colors, fonts, spacing, and style — then builds complete page templates.
 * Version: 1.0.0
 * Author: Theme DNA
 * Author URI: https://themedna.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: theme-dna-generator
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Elementor tested up to: 3.20
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'THEME_DNA_VERSION', '1.0.0' );
define( 'THEME_DNA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'THEME_DNA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'THEME_DNA_API_URL', 'https://api.themedna.com' ); // Your SaaS API endpoint

/**
 * Check plugin requirements on activation
 */
function theme_dna_activate() {
    if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die(
            esc_html__( 'Theme DNA Generator requires PHP 7.4 or higher.', 'theme-dna-generator' ),
            'Plugin Activation Error',
            array( 'back_link' => true )
        );
    }
}
register_activation_hook( __FILE__, 'theme_dna_activate' );

/**
 * Initialize the plugin after all plugins are loaded
 */
function theme_dna_init() {
    // Check if Elementor is active
    if ( ! did_action( 'elementor/loaded' ) ) {
        add_action( 'admin_notices', 'theme_dna_missing_elementor_notice' );
        return;
    }

    // Check Elementor version
    if ( ! version_compare( ELEMENTOR_VERSION, '3.5.0', '>=' ) ) {
        add_action( 'admin_notices', 'theme_dna_outdated_elementor_notice' );
        return;
    }

    // Load plugin files
    require_once THEME_DNA_PLUGIN_DIR . 'includes/class-plugin.php';
    require_once THEME_DNA_PLUGIN_DIR . 'includes/class-api-client.php';
    require_once THEME_DNA_PLUGIN_DIR . 'includes/class-admin-page.php';
    require_once THEME_DNA_PLUGIN_DIR . 'includes/class-ajax-handler.php';

    Theme_DNA\Plugin::instance();
}
add_action( 'plugins_loaded', 'theme_dna_init' );

/**
 * Admin notice: Elementor not installed
 */
function theme_dna_missing_elementor_notice() {
    $message = sprintf(
        /* translators: 1: Plugin name 2: Elementor */
        esc_html__( '"%1$s" requires "%2$s" to be installed and activated.', 'theme-dna-generator' ),
        '<strong>' . esc_html__( 'Theme DNA Generator', 'theme-dna-generator' ) . '</strong>',
        '<strong>' . esc_html__( 'Elementor', 'theme-dna-generator' ) . '</strong>'
    );
    printf( '<div class="notice notice-warning is-dismissible"><p>%s</p></div>', $message );
}

/**
 * Admin notice: Elementor version too old
 */
function theme_dna_outdated_elementor_notice() {
    $message = sprintf(
        /* translators: 1: Plugin name 2: Elementor 3: Minimum version */
        esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'theme-dna-generator' ),
        '<strong>' . esc_html__( 'Theme DNA Generator', 'theme-dna-generator' ) . '</strong>',
        '<strong>' . esc_html__( 'Elementor', 'theme-dna-generator' ) . '</strong>',
        '3.5.0'
    );
    printf( '<div class="notice notice-warning is-dismissible"><p>%s</p></div>', $message );
}
