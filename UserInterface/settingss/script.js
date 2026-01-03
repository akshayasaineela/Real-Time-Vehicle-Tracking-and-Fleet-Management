const apiBase = "http://localhost:5003";

let currentSettings = null;
let uploadedPhotoBase64 = "";

// ===== Helpers =====
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

function updateAvatarUI(name, color, photo) {
  const initials = (name || "JD")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarCircle = document.getElementById("avatarCircle");
  const avatarLarge = document.getElementById("avatarLarge");
  const headerName = document.getElementById("headerName");
  const headerRole = document.getElementById("headerRole");

  headerName.textContent = name || "John Doe";
  headerRole.textContent =
    document.getElementById("roleInput").value || "Fleet Manager";

  if (photo) {
    avatarCircle.style.backgroundImage = `url(${photo})`;
    avatarLarge.style.backgroundImage = `url(${photo})`;
  } else {
    avatarCircle.style.backgroundImage = "none";
    avatarLarge.style.backgroundImage = "none";
    avatarCircle.style.backgroundColor = color || "#3b82f6";
    avatarLarge.style.backgroundColor = color || "#3b82f6";
  }

  // show initials only if no photo
  if (!photo) {
    avatarCircle.textContent = initials;
    avatarLarge.textContent = initials;
  } else {
    avatarCircle.textContent = "";
    avatarLarge.textContent = "";
  }
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
  const pillTheme = document.getElementById("pillTheme");
  pillTheme.textContent =
    "Theme: " + theme[0].toUpperCase() + theme.slice(1);
}

function updatePills(settings) {
  const pillAlerts = document.getElementById("pillAlerts");
  const pillSecurity = document.getElementById("pillSecurity");

  const a = [];
  if (settings.notifications.emailAlerts) a.push("Email");
  if (settings.notifications.pushAlerts) a.push("Push");
  if (settings.notifications.smsAlerts) a.push("SMS");
  pillAlerts.textContent = "Alerts: " + (a.join(" + ") || "None");

  pillSecurity.textContent =
    "Security: " + (settings.security.twoFactor ? "2FA Enabled" : "Standard");
}

// ===== Load settings from backend =====
async function loadSettings() {
  try {
    const res = await fetch(`${apiBase}/settings`);
    currentSettings = await res.json();

    const s = currentSettings;

    // Profile
    document.getElementById("nameInput").value = s.profile.name || "";
    document.getElementById("roleInput").value = s.profile.role || "";
    document.getElementById("emailInput").value = s.profile.email || "";
    document.getElementById("avatarColorInput").value =
      s.profile.avatarColor || "#3b82f6";
    uploadedPhotoBase64 = ""; // reset local uploaded
    updateAvatarUI(s.profile.name, s.profile.avatarColor, s.profile.photo);

    // Preferences
    document.getElementById("languageSelect").value =
      s.preferences.language || "en";
    document.getElementById("timezoneSelect").value =
      s.preferences.timezone || "IST";
    document.getElementById("dateFormatSelect").value =
      s.preferences.dateFormat || "DD/MM/YYYY";

    // Appearance
    document
      .querySelectorAll('input[name="theme"]')
      .forEach((r) => (r.checked = r.value === s.appearance.theme));
    document.getElementById("compactModeInput").checked =
      !!s.appearance.compactMode;
    document.getElementById("themeSwitch").checked =
      s.appearance.theme === "dark";
    applyTheme(s.appearance.theme);

    // Notifications
    document.getElementById("emailAlertsInput").checked =
      !!s.notifications.emailAlerts;
    document.getElementById("smsAlertsInput").checked =
      !!s.notifications.smsAlerts;
    document.getElementById("pushAlertsInput").checked =
      !!s.notifications.pushAlerts;
    document.getElementById("maintenanceRemindersInput").checked =
      !!s.notifications.maintenanceReminders;
    document.getElementById("tripAlertsInput").checked =
      !!s.notifications.tripAlerts;

    // Security
    document.getElementById("twoFactorInput").checked =
      !!s.security.twoFactor;
    document.getElementById("loginAlertsInput").checked =
      !!s.security.loginAlerts;
    document.getElementById("newPasswordInput").value = "";

    // Data
    document.getElementById("autoBackupInput").checked =
      !!s.data.autoBackup;
    document.getElementById("backupFrequencySelect").value =
      s.data.backupFrequency || "weekly";

    updatePills(s);
  } catch (err) {
    console.error("Error loading settings:", err);
  }
}

// ===== Event: photo upload → base64 =====
document.getElementById("photoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) {
    uploadedPhotoBase64 = "";
    return;
  }
  try {
    uploadedPhotoBase64 = await toBase64(file);
    updateAvatarUI(
      document.getElementById("nameInput").value,
      document.getElementById("avatarColorInput").value,
      uploadedPhotoBase64
    );
  } catch (err) {
    console.error("Error reading photo:", err);
  }
});

// ===== Save handlers =====

// Profile
document
  .getElementById("saveProfileBtn")
  .addEventListener("click", async () => {
    const name = document.getElementById("nameInput").value;
    const role = document.getElementById("roleInput").value;
    const email = document.getElementById("emailInput").value;
    const avatarColor = document.getElementById("avatarColorInput").value;

    // use uploaded photo if present, else keep existing
    const photo =
      uploadedPhotoBase64 || (currentSettings?.profile.photo || "");

    const payload = {
      profile: { name, role, email, avatarColor, photo },
    };

    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      currentSettings = data.settings;
      updateAvatarUI(name, avatarColor, photo);
      updatePills(currentSettings);
      showToast("Profile updated");
    } catch (err) {
      console.error(err);
    }
  });

// Preferences
document
  .getElementById("savePreferencesBtn")
  .addEventListener("click", async () => {
    const payload = {
      preferences: {
        language: document.getElementById("languageSelect").value,
        timezone: document.getElementById("timezoneSelect").value,
        dateFormat: document.getElementById("dateFormatSelect").value,
      },
    };

    try {
      await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showToast("Preferences updated");
    } catch (err) {
      console.error(err);
    }
  });

// Theme quick switch
document.getElementById("themeSwitch").addEventListener("change", (e) => {
  const isDark = e.target.checked;
  const theme = isDark ? "dark" : "light";

  document
    .querySelectorAll('input[name="theme"]')
    .forEach((r) => (r.checked = r.value === theme));
  applyTheme(theme);
});

// Appearance save
document
  .getElementById("saveAppearanceBtn")
  .addEventListener("click", async () => {
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    const theme = themeRadio ? themeRadio.value : "light";

    const payload = {
      appearance: {
        theme,
        compactMode: document.getElementById("compactModeInput").checked,
      },
    };

    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      currentSettings = data.settings;
      applyTheme(currentSettings.appearance.theme);
      updatePills(currentSettings);
      showToast("Appearance saved");
    } catch (err) {
      console.error(err);
    }
  });

// Notifications
document
  .getElementById("saveNotificationsBtn")
  .addEventListener("click", async () => {
    const payload = {
      notifications: {
        emailAlerts: document.getElementById("emailAlertsInput").checked,
        smsAlerts: document.getElementById("smsAlertsInput").checked,
        pushAlerts: document.getElementById("pushAlertsInput").checked,
        maintenanceReminders:
          document.getElementById("maintenanceRemindersInput").checked,
        tripAlerts: document.getElementById("tripAlertsInput").checked,
      },
    };

    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      currentSettings = data.settings;
      updatePills(currentSettings);
      showToast("Notifications saved");
    } catch (err) {
      console.error(err);
    }
  });

// Security
document
  .getElementById("saveSecurityBtn")
  .addEventListener("click", async () => {
    const newPass =
      document.getElementById("newPasswordInput").value.trim();
    if (newPass && newPass.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    const payload = {
      security: {
        twoFactor: document.getElementById("twoFactorInput").checked,
        loginAlerts: document.getElementById("loginAlertsInput").checked,
        // password is not actually used anywhere – simulated
      },
    };

    try {
      const res = await fetch(`${apiBase}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      currentSettings = data.settings;
      document.getElementById("newPasswordInput").value = "";
      updatePills(currentSettings);
      showToast("Security updated");
    } catch (err) {
      console.error(err);
    }
  });

// Backup / restore
document.getElementById("backupBtn").addEventListener("click", async () => {
  try {
    const res = await fetch(`${apiBase}/settings/backup`, {
      method: "POST",
    });
    const data = await res.json();
    showToast(data.message || "Backup complete");
  } catch (err) {
    console.error(err);
  }
});

document.getElementById("restoreBtn").addEventListener("click", async () => {
  if (!confirm("Simulate restore backup?")) return;
  try {
    const res = await fetch(`${apiBase}/settings/restore`, {
      method: "POST",
    });
    const data = await res.json();
    showToast(data.message || "Restore complete");
  } catch (err) {
    console.error(err);
  }
});

// REAL delete account (reset to defaults)
document
  .getElementById("deleteAccountBtn")
  .addEventListener("click", async () => {
    if (
      !confirm(
        "This will reset all your settings to default. Are you sure?"
      )
    )
      return;

    try {
      const res = await fetch(`${apiBase}/settings/account`, {
        method: "DELETE",
      });
      const data = await res.json();
      currentSettings = data.settings;
      showToast("Account reset to default");
      loadSettings();
    } catch (err) {
      console.error(err);
    }
  });

// ===== Init =====
loadSettings();
