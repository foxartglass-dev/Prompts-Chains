<?php
namespace Theme_DNA;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Handles AJAX requests from the admin UI
 */
class Ajax_Handler {

    private static $instance = null;

    public static function instance() {
        if ( is_null( self::$instance ) ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'wp_ajax_theme_dna_generate', array( $this, 'handle_generate' ) );
        add_action( 'wp_ajax_theme_dna_import_page', array( $this, 'handle_import_page' ) );
        add_action( 'wp_ajax_theme_dna_import_all', array( $this, 'handle_import_all' ) );
        add_action( 'wp_ajax_theme_dna_save_license', array( $this, 'handle_save_license' ) );
    }

    /**
     * Generate theme from URL
     */
    public function handle_generate() {
        check_ajax_referer( 'theme_dna_nonce', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'theme-dna-generator' ) );
        }

        $url = isset( $_POST['url'] ) ? esc_url_raw( wp_unslash( $_POST['url'] ) ) : '';
        if ( empty( $url ) ) {
            wp_send_json_error( __( 'Please enter a valid URL.', 'theme-dna-generator' ) );
        }

        $result = API_Client::generate_from_url( $url );

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( $result->get_error_message() );
        }

        // Store the result in a transient so we can import pages later
        set_transient( 'theme_dna_last_result', $result, HOUR_IN_SECONDS );

        wp_send_json_success( $result );
    }

    /**
     * Import a single generated page into WordPress as an Elementor page
     */
    public function handle_import_page() {
        check_ajax_referer( 'theme_dna_nonce', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'theme-dna-generator' ) );
        }

        $page_name = isset( $_POST['pageName'] ) ? sanitize_text_field( wp_unslash( $_POST['pageName'] ) ) : '';
        $result = get_transient( 'theme_dna_last_result' );

        if ( empty( $result ) || empty( $result['pages'][ $page_name ] ) ) {
            wp_send_json_error( __( 'Page data not found. Please regenerate.', 'theme-dna-generator' ) );
        }

        $page_data = $result['pages'][ $page_name ];
        $post_id = $this->create_elementor_page( $page_data['title'], $page_data['elementorData'] );

        if ( is_wp_error( $post_id ) ) {
            wp_send_json_error( $post_id->get_error_message() );
        }

        wp_send_json_success( array(
            'postId'  => $post_id,
            'editUrl' => admin_url( 'post.php?post=' . $post_id . '&action=elementor' ),
            'viewUrl' => get_permalink( $post_id ),
        ) );
    }

    /**
     * Import all generated pages
     */
    public function handle_import_all() {
        check_ajax_referer( 'theme_dna_nonce', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'theme-dna-generator' ) );
        }

        $result = get_transient( 'theme_dna_last_result' );

        if ( empty( $result ) || empty( $result['pages'] ) ) {
            wp_send_json_error( __( 'No generated pages found. Please generate first.', 'theme-dna-generator' ) );
        }

        $imported = array();
        foreach ( $result['pages'] as $name => $page_data ) {
            $post_id = $this->create_elementor_page( $page_data['title'], $page_data['elementorData'] );
            if ( ! is_wp_error( $post_id ) ) {
                $imported[ $name ] = array(
                    'postId'  => $post_id,
                    'editUrl' => admin_url( 'post.php?post=' . $post_id . '&action=elementor' ),
                    'viewUrl' => get_permalink( $post_id ),
                );
            }
        }

        wp_send_json_success( array(
            'imported' => $imported,
            'count'    => count( $imported ),
        ) );
    }

    /**
     * Save license key
     */
    public function handle_save_license() {
        check_ajax_referer( 'theme_dna_nonce', 'nonce' );

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( __( 'Permission denied.', 'theme-dna-generator' ) );
        }

        $license_key = isset( $_POST['licenseKey'] ) ? sanitize_text_field( wp_unslash( $_POST['licenseKey'] ) ) : '';
        update_option( 'theme_dna_license_key', $license_key );

        $status = API_Client::check_license();
        wp_send_json_success( $status );
    }

    /**
     * Create a WordPress page with Elementor data
     *
     * @param string $title         Page title
     * @param string $elementor_json Elementor JSON data string
     * @return int|WP_Error         Post ID or error
     */
    private function create_elementor_page( $title, $elementor_json ) {
        $post_id = wp_insert_post( array(
            'post_title'  => $title,
            'post_status' => 'draft',
            'post_type'   => 'page',
            'meta_input'  => array(
                '_elementor_edit_mode' => 'builder',
                '_elementor_version'   => ELEMENTOR_VERSION,
                '_elementor_data'      => $elementor_json,
                '_elementor_template_type' => 'wp-page',
            ),
        ) );

        return $post_id;
    }
}
