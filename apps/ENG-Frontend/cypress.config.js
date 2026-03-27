const { defineConfig } = require('cypress');

module.exports = defineConfig({
    e2e: {
        baseUrl: 'http://plbmp129:3000',
        viewportWidth: 1280,
        viewportHeight: 800,
        defaultCommandTimeout: 10000,
        video: false,
        screenshotOnRunFailure: true,
        setupNodeEvents(on, config) {
            // implement node event listeners here
        },
    },
});
