async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const settings = await res.json();

    // ▢ 1. Apply theme
    document.body.classList.remove("light", "dark");
    document.body.classList.add(settings.theme);

    // ▢ 2. Update organization name in navbar / sidebar
    const orgNameElem = document.querySelector(".org-name");
    if (orgNameElem) orgNameElem.textContent = settings.orgName;

    // ▢ 3. Update admin email in footer or wherever
    const adminEmailElem = document.querySelector(".admin-email");
    if (adminEmailElem) adminEmailElem.textContent = settings.adminEmail;

    // ▢ 4. Save values globally (if needed)
    window.APP_SETTINGS = settings;

    console.log("Settings loaded:", settings);

  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

window.addEventListener("DOMContentLoaded", loadSettings);

// Loads settings when page opens
async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const settings = await res.json();

    console.log("Loaded settings:", settings);

    // Save globally for other scripts
    window.APP_SETTINGS = settings;

    // ------------------------------
    // Apply Theme (light / dark)
    // ------------------------------
    document.body.classList.remove("light", "dark");
    if (settings.themeMode) {
      document.body.classList.add(settings.themeMode);
    }

    // ------------------------------
    // Update org / profile name
    // ------------------------------
    const orgNameEls = document.querySelectorAll(".org-name");
    orgNameEls.forEach(elem => elem.textContent = settings.fullName || settings.orgName);

    const roleEls = document.querySelectorAll(".profile-role");
    roleEls.forEach(elem => elem.textContent = settings.role);

    const emailEls = document.querySelectorAll(".admin-email");
    emailEls.forEach(elem => elem.textContent = settings.adminEmail);

    // ------------------------------
    // Compact mode
    // ------------------------------
    if (settings.compactMode) {
      document.body.classList.add("compact-mode");
    }

  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

// run when page loads
document.addEventListener("DOMContentLoaded", loadSettings);
