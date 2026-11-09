/**
 * TechOps portal configuration.
 *
 * The backend is Firebase (Auth + Firestore): see js/firebase-config.js and firebase/firestore.rules.
 */
window.TECHOPS_CONFIG = {
  /* Public address of this folder. Used when generating the Universal QR code. */
  PUBLIC_BASE_URL: "https://logistics.spaceappscairo.com/techops/",
  /* Public address of the request/ folder: the ONE participant QR code points to <this>form.html */
  REQUEST_BASE_URL: "https://logistics.spaceappscairo.com/request/",
  /* Competition Team hand-out suggestions (dispatchers can also type any name). Replace with the real members. */
  DISPATCH_MEMBERS: {
    TechOps: ["Mohamed Khairy", "Omar", "Lojine", "Karim", "Tasbeeh", "Nour", "Youssef", "Hana"],
    Logistics: ["Norhan Yasser", "Logistics Lead", "Logistics Volunteer"],
    Competition: ["Competition Lead", "Competition Volunteer"]
  },
  /* How long (ms) a volunteer may be away from the site before the code is asked again */
  SESSION_GRACE_MS: 24 * 60 * 60 * 1000,
  /* Public address of the logistics/ folder: the Logistics help QR code points to <this>help.html */
  LOGISTICS_BASE_URL: "https://logistics.spaceappscairo.com/logistics/"
};
