/**
 * TechOps prototype configuration.
 *
 * This prototype uses its OWN Google Sheet ("TechOps Prototype - Dummy Backend").
 * It is NOT the Logistics sheet and nothing in the Logistics site reads or writes it.
 */
window.TECHOPS_CONFIG = {
  /* Spreadsheet that acts as the TechOps backend (dummy data for now). */
  SHEET_ID: "1W_tfJnBPlaeqshRK_09IjRKlAe-3mE61yK9iV8AbBxM",

  /* Tab names inside that spreadsheet. */
  TABS: {
    rooms: "Rooms",
    wifi: "WiFi",
    team: "Team",
    inventory: "Inventory",
    reports: "Reports",
    meetups: "Meetups"
  },

  /*
   * Write endpoint (Google Apps Script web app) used by the report form, the meetup
   * requests, and the status / inventory updates. Paste the "Web app" URL here after
   * deploying apps-script/Code.gs (steps are in techops/README.md).
   * While this is empty the prototype stays in DEMO mode: submissions are stored in this
   * browser only and are NOT written to the Google Sheet.
   */
  APPS_SCRIPT_URL: "",

  /* How often the dashboard re-reads the sheet (milliseconds). */
  POLL_MS: 12000,

  /* Public address of this folder. Used when generating the room QR codes. */
  PUBLIC_BASE_URL: "https://norhan-yasser.github.io/Nasa_space_apps_Volunteers_website/techops/"
};
