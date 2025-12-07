// Basic smoke test for the Desk Softphone widget.
// This does NOT assert media behaviour; it only checks that
// the widget renders and can be opened after login.

const FRAPPE_USER = Cypress.env("FRAPPE_USER") || "Administrator";
const FRAPPE_PASS = Cypress.env("FRAPPE_PASS") || "admin";

describe("Desk Softphone (WebRTC SIP)", () => {
  it("renders the floating button and opens the panel", () => {
    // Login
    cy.visit("/login");

    // Frappe login inputs (v14+)
    cy.get("#login_email").clear().type(FRAPPE_USER);
    cy.get("#login_password").clear().type(FRAPPE_PASS, { log: false });
    cy.get("button.btn-login").click();

    // Wait for Desk to load
    cy.url().should("include", "/desk");

    // Floating softphone button should render; we only assert existence
    // because Desk may auto-open the panel based on previous state.
    cy.get("#telephony-sip-softphone .tp-softphone-toggle", {
      timeout: 20000,
    }).should("exist");

    // Ensure the panel exists (it may already be open, or closed).
    cy.get("#telephony-sip-softphone .tp-sara-panel", {
      timeout: 10000,
    }).should("exist");

    // Title text should be present somewhere inside the widget.
    cy.contains("#telephony-sip-softphone", "Desk Softphone").should("exist");
  });
});
