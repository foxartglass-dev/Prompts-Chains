/**
 * Theme DNA Generator - Admin JavaScript
 * Handles URL submission, progress theater, and page import
 */
(function($) {
    'use strict';

    // Progress steps with theatrical timing
    const PROGRESS_STEPS = [
        { pct: 5,   text: 'Connecting to website...', duration: 2000 },
        { pct: 12,  text: 'Capturing screenshot...', duration: 3000 },
        { pct: 20,  text: 'Analyzing brand identity...', duration: 4000 },
        { pct: 28,  text: 'Extracting color palette...', duration: 3000 },
        { pct: 35,  text: 'Mapping typography system...', duration: 2500 },
        { pct: 42,  text: 'Identifying component styles...', duration: 3000 },
        { pct: 50,  text: 'Detecting layout patterns...', duration: 2500 },
        { pct: 55,  text: 'Building design DNA profile...', duration: 3000 },
        { pct: 62,  text: 'Generating Home page...', duration: 4000 },
        { pct: 68,  text: 'Generating About page...', duration: 3000 },
        { pct: 74,  text: 'Generating Services page...', duration: 3000 },
        { pct: 80,  text: 'Generating Contact page...', duration: 3000 },
        { pct: 85,  text: 'Generating Blog page...', duration: 2500 },
        { pct: 90,  text: 'Generating Landing page...', duration: 2500 },
        { pct: 95,  text: 'Assembling theme package...', duration: 3000 },
        { pct: 98,  text: 'Final quality check...', duration: 2000 },
    ];

    let progressTimer = null;
    let countdownTimer = null;
    let generatedData = null;

    // Page icons
    const PAGE_ICONS = {
        home: '&#127968;',
        about: '&#128100;',
        services: '&#9881;&#65039;',
        contact: '&#9993;&#65039;',
        blog: '&#128221;',
        landing: '&#127937;'
    };

    // ---- Generate Button ----
    $('#theme-dna-generate').on('click', function() {
        var url = $('#theme-dna-url').val().trim();
        if (!url) {
            alert('Please enter a website URL.');
            return;
        }

        // Ensure URL has protocol
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
            $('#theme-dna-url').val(url);
        }

        startGeneration(url);
    });

    // Enter key triggers generate
    $('#theme-dna-url').on('keypress', function(e) {
        if (e.which === 13) {
            $('#theme-dna-generate').trigger('click');
        }
    });

    function startGeneration(url) {
        // Show progress, hide results
        $('.theme-dna-generator-card').addClass('theme-dna-generating');
        $('#theme-dna-progress').show();
        $('#theme-dna-results').hide();

        // Start progress theater
        runProgressTheater();

        // Start countdown from 10:00
        startCountdown(10 * 60);

        // Fire the actual API call
        $.ajax({
            url: themeDNA.ajaxUrl,
            type: 'POST',
            data: {
                action: 'theme_dna_generate',
                nonce: themeDNA.nonce,
                url: url
            },
            success: function(response) {
                if (response.success) {
                    generatedData = response.data;
                    // Jump to 100% and show results
                    finishProgress();
                } else {
                    showError(response.data || 'Generation failed.');
                }
            },
            error: function() {
                showError('Network error. Please try again.');
            }
        });
    }

    function runProgressTheater() {
        var stepIndex = 0;

        function nextStep() {
            if (stepIndex >= PROGRESS_STEPS.length) return;

            var step = PROGRESS_STEPS[stepIndex];
            $('#theme-dna-progress-bar').css('width', step.pct + '%');
            $('#theme-dna-progress-status').text(step.text);

            stepIndex++;
            progressTimer = setTimeout(nextStep, step.duration);
        }

        nextStep();
    }

    function startCountdown(totalSeconds) {
        var remaining = totalSeconds;

        function tick() {
            var mins = Math.floor(remaining / 60);
            var secs = remaining % 60;
            $('#theme-dna-progress-timer').text(
                mins + ':' + (secs < 10 ? '0' : '') + secs
            );
            remaining--;
            if (remaining >= 0) {
                countdownTimer = setTimeout(tick, 1000);
            }
        }

        tick();
    }

    function finishProgress() {
        // Clear timers
        clearTimeout(progressTimer);
        clearTimeout(countdownTimer);

        // Animate to 100%
        $('#theme-dna-progress-bar').css('width', '100%');
        $('#theme-dna-progress-status').text('Complete!');
        $('#theme-dna-progress-timer').text('0:00');

        setTimeout(function() {
            $('.theme-dna-generator-card').removeClass('theme-dna-generating');
            $('#theme-dna-progress').hide();
            showResults();
        }, 1500);
    }

    function showError(message) {
        clearTimeout(progressTimer);
        clearTimeout(countdownTimer);
        $('.theme-dna-generator-card').removeClass('theme-dna-generating');
        $('#theme-dna-progress').hide();
        alert('Error: ' + message);
    }

    function showResults() {
        if (!generatedData) return;

        var $results = $('#theme-dna-results');
        var $preview = $('#theme-dna-preview');
        var $pages = $('#theme-dna-pages');

        // Build color swatches
        var dna = generatedData.designDNA;
        var previewHtml = '';

        if (dna && dna.colors) {
            var colors = dna.colors;
            var colorNames = {
                brandDefault: 'Brand',
                brandLight: 'Brand Light',
                brandDark: 'Brand Dark',
                surfaceCanvas: 'Background',
                surfaceBase: 'Surface',
                textPrimary: 'Text',
                textSecondary: 'Text 2nd'
            };

            for (var key in colorNames) {
                if (colors[key]) {
                    previewHtml += '<div class="dna-color-swatch" style="background:' + colors[key] + ';" data-label="' + colorNames[key] + '"></div>';
                }
            }
        }

        if (dna && dna.typography && dna.typography.fontFamily) {
            previewHtml += '<div class="dna-font-preview">';
            previewHtml += '<div class="dna-font-label">Font</div>';
            previewHtml += '<div class="dna-font-name" style="font-family:\'' + dna.typography.fontFamily + '\',sans-serif;">' + dna.typography.fontFamily + '</div>';
            previewHtml += '</div>';
        }

        $preview.html(previewHtml);

        // Build pages grid
        var pagesHtml = '';
        var pages = generatedData.pages || {};

        for (var name in pages) {
            var page = pages[name];
            var icon = PAGE_ICONS[name] || '&#128196;';

            pagesHtml += '<div class="theme-dna-page-card" data-page="' + name + '">';
            pagesHtml += '<span class="page-icon">' + icon + '</span>';
            pagesHtml += '<h3>' + page.title + '</h3>';
            pagesHtml += '<button class="button theme-dna-import-page" data-page="' + name + '">Import Page</button>';
            pagesHtml += '</div>';
        }

        $pages.html(pagesHtml);
        $results.show();
    }

    // ---- Import Single Page ----
    $(document).on('click', '.theme-dna-import-page', function() {
        var $btn = $(this);
        var pageName = $btn.data('page');
        $btn.prop('disabled', true).text('Importing...');

        $.ajax({
            url: themeDNA.ajaxUrl,
            type: 'POST',
            data: {
                action: 'theme_dna_import_page',
                nonce: themeDNA.nonce,
                pageName: pageName
            },
            success: function(response) {
                if (response.success) {
                    $btn.text('Imported!').addClass('button-primary');
                    // Add edit link
                    $btn.after(' <a href="' + response.data.editUrl + '" target="_blank" class="button">Edit in Elementor</a>');
                } else {
                    $btn.prop('disabled', false).text('Import Page');
                    alert('Import failed: ' + (response.data || 'Unknown error'));
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Import Page');
                alert('Network error.');
            }
        });
    });

    // ---- Import All Pages ----
    $('#theme-dna-import-all').on('click', function() {
        var $btn = $(this);
        $btn.prop('disabled', true).text('Importing all pages...');

        $.ajax({
            url: themeDNA.ajaxUrl,
            type: 'POST',
            data: {
                action: 'theme_dna_import_all',
                nonce: themeDNA.nonce
            },
            success: function(response) {
                if (response.success) {
                    $btn.text(response.data.count + ' pages imported!');
                    // Disable individual import buttons
                    $('.theme-dna-import-page').prop('disabled', true).text('Imported!').addClass('button-primary');

                    // Add edit links
                    var imported = response.data.imported;
                    for (var name in imported) {
                        var $card = $('.theme-dna-page-card[data-page="' + name + '"]');
                        $card.find('.theme-dna-import-page').after(' <a href="' + imported[name].editUrl + '" target="_blank" class="button">Edit</a>');
                    }
                } else {
                    $btn.prop('disabled', false).text('Import All Pages');
                    alert('Import failed: ' + (response.data || 'Unknown error'));
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Import All Pages');
                alert('Network error.');
            }
        });
    });

    // ---- Save License ----
    $('#theme-dna-save-license').on('click', function() {
        var key = $('#theme-dna-license-key').val().trim();
        var $btn = $(this);
        $btn.prop('disabled', true).text('Checking...');

        $.ajax({
            url: themeDNA.ajaxUrl,
            type: 'POST',
            data: {
                action: 'theme_dna_save_license',
                nonce: themeDNA.nonce,
                licenseKey: key
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Activate');
                if (response.success) {
                    var d = response.data;
                    $('.tier-badge').attr('class', 'tier-badge tier-' + (d.tier || 'free')).text(d.tier || 'free');
                    $('.tier-info').text(d.message || '');
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Activate');
                alert('Could not verify license.');
            }
        });
    });

})(jQuery);
