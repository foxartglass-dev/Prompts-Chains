<?php
namespace Theme_DNA;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Main plugin class - singleton pattern
 */
class Plugin {

    private static $instance = null;

    public static function instance() {
        if ( is_null( self::$instance ) ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init_hooks();
    }

    private function init_hooks() {
        add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );

        // Initialize AJAX handler
        Ajax_Handler::instance();
    }

    /**
     * Register the admin menu page under Elementor
     */
    public function register_admin_menu() {
        add_submenu_page(
            'elementor',
            __( 'Theme DNA Generator', 'theme-dna-generator' ),
            __( 'Theme DNA', 'theme-dna-generator' ),
            'manage_options',
            'theme-dna-generator',
            array( 'Theme_DNA\Admin_Page', 'render' )
        );
    }

    /**
     * Enqueue admin CSS and JS only on our page
     */
    public function enqueue_admin_assets( $hook ) {
        if ( 'elementor_page_theme-dna-generator' !== $hook ) {
            return;
        }

        wp_enqueue_style(
            'theme-dna-admin',
            THEME_DNA_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            THEME_DNA_VERSION
        );

        wp_enqueue_script(
            'theme-dna-admin',
            THEME_DNA_PLUGIN_URL . 'assets/js/admin.js',
            array( 'jquery' ),
            THEME_DNA_VERSION,
            true
        );

        wp_localize_script( 'theme-dna-admin', 'themeDNA', array(
            'ajaxUrl'  => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'theme_dna_nonce' ),
            'apiUrl'   => THEME_DNA_API_URL,
            'siteUrl'  => get_site_url(),
            'siteName' => get_bloginfo( 'name' ),
        ) );
    }
}
