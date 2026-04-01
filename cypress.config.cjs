// Basic Cypress configuration for the Telephony app.
// This project is intended to be run either via the dev stack's
// `ui-tester` service (cypress/included image) or locally with `npx cypress open`.

const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://development.localhost:8000",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: false,
    defaultCommandTimeout: 10000,
  },
});

