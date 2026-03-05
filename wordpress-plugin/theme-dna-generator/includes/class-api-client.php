<?php
namespace Theme_DNA;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * API Client - communicates with the Theme DNA SaaS backend
 * All heavy processing (screenshot, AI analysis, theme generation) happens server-side
 */
class API_Client {

    /**
     * Generate Elementor theme from a URL
     *
     * @param string $url       The website URL to clone the design from
     * @param string $site_name The site name for generated content
     * @return array|WP_Error   Generated theme data or error
     */
    public static function generate_from_url( $url, $site_name = '' ) {
        $license_key = get_option( 'theme_dna_license_key', '' );

        $response = wp_remote_post( THEME_DNA_API_URL . '/api/theme-generator/elementor/from-url', array(
            'timeout' => 120, // Allow time for screenshot + AI processing
            'headers' => array(
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $license_key,
            ),
            'body' => wp_json_encode( array(
                'url'      => $url,
                'siteName' => $site_name ? $site_name : get_bloginfo( 'name' ),
                'tagline'  => get_bloginfo( 'description' ),
            ) ),
        ) );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $code !== 200 || empty( $body['success'] ) ) {
            $error_msg = isset( $body['error'] ) ? $body['error'] : __( 'Unknown API error', 'theme-dna-generator' );
            return new \WP_Error( 'api_error', $error_msg );
        }

        return $body;
    }

    /**
     * Check license/subscription status
     *
     * @return array License info (tier, generations remaining, etc.)
     */
    public static function check_license() {
        $license_key = get_option( 'theme_dna_license_key', '' );

        if ( empty( $license_key ) ) {
            return array(
                'valid'      => false,
                'tier'       => 'free',
                'remaining'  => 1,
                'message'    => __( 'Free tier: 1 page generation. Upgrade for full site.', 'theme-dna-generator' ),
            );
        }

        $response = wp_remote_get( THEME_DNA_API_URL . '/api/license/check', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $license_key,
            ),
        ) );

        if ( is_wp_error( $response ) ) {
            return array(
                'valid'     => false,
                'tier'      => 'free',
                'remaining' => 1,
                'message'   => __( 'Could not verify license. Using free tier.', 'theme-dna-generator' ),
            );
        }

        return json_decode( wp_remote_retrieve_body( $response ), true );
    }
}
