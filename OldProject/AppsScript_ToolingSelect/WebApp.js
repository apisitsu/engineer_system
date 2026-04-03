/**
 * @OnlyCurrentDoc
 * Main function to serve the web page
 */

// Serve the HTML page
function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Tooling Selection')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Global Constants & Configurations
 */
const TOP_N_PER_MACHINE = 2;
const MAX_JAW_DEPTH = 10.0;