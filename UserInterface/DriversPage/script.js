function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

const apiBase = "http://localhost:5000/api";
let allDrivers = [];
let currentSort = "default";
let editingDriverId = null;
let driverTripsChart = null;

// DOM references
const driversGrid = document.getElementById("driversGrid");
const searchInput = document.getElementById("searchInput");
const sortButtons = document.querySelectorAll(".sort-buttons .btn-secondary");

const profileModal = document.getElementById("profileModal");
const addDriverModal = document.getElementById("addDriverModal");

const addDriverBtn = document.getElementById("addDriverBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const closeAddDriverBtn = document.getElementById("closeAddDriverBtn");
const cancelAddEditBtn = document.getElementById("cancelAddEditBtn");
const exportBtn = document.getElementById("exportBtn");

const addDriverForm = document.getElementById("addDriverForm");
const addEditTitle = document.getElementById("addEditTitle");
const submitBtn = document.getElementById("submitBtn");
const photoFileInput = document.getElementById("photoFile");

// Stats elements
const statTotalDrivers = document.getElementById("statTotalDrivers");
const statAvgRating = document.getElementById("statAvgRating");
const statTotalTrips = document.getElementById("statTotalTrips");
const statTotalViolations = document.getElementById("statTotalViolations");

/* ───────── HELPERS ───────── */

const DEFAULT_PHOTO = "https://randomuser.me/api/portraits/men/10.jpg";

function getDriverName(d) {
  return d.driver || d.name || "Unnamed";
}

function generateTripsHistory(totalTrips) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const avg = totalTrips / months.length || 0;
  return months.map((m, i) => ({
    label: m,
    trips: Math.max(0, Math.round(avg + (i - 2) * 2))
  }));
}


/* ───────── FETCH + RENDER ───────── */

async function loadDrivers() {
  try {
    const res = await fetch(`${apiBase}/drivers`);
    const data = await res.json();
    allDrivers = data;
    updateStats();
    renderDrivers();
  } catch (err) {
    console.error("Error fetching drivers:", err);
  }
}

function updateStats() {
  const total = allDrivers.length;

  const totalTrips = allDrivers.reduce(
    (sum, d) => sum + (Number(d.trips) || 0),
    0
  );

  const totalViolations = allDrivers.reduce(
    (sum, d) =>
      sum +
      (Array.isArray(d.violations)
        ? d.violations.length
        : Number(d.violations) || 0),
    0
  );

  const avgRating =
    total === 0
      ? 0
      : (
          allDrivers.reduce(
            (sum, d) => sum + (Number(d.rating) || 0),
            0
          ) / total
        ).toFixed(1);

  statTotalDrivers.textContent = total;
  statTotalTrips.textContent = totalTrips;
  statTotalViolations.textContent = totalViolations;
  statAvgRating.textContent = avgRating;
}

function getFilteredSortedDrivers() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = allDrivers.filter((d) =>
    getDriverName(d).toLowerCase().includes(query)
  );

  switch (currentSort) {
    case "rating":
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;

    case "trips":
      filtered.sort((a, b) => (b.trips || 0) - (a.trips || 0));
      break;

    default:
      filtered.sort((a, b) =>
        getDriverName(a).localeCompare(getDriverName(b))
      );
  }

  return filtered;
}

function renderDrivers() {
  const drivers = getFilteredSortedDrivers();
  driversGrid.innerHTML = "";

  if (drivers.length === 0) {
    driversGrid.innerHTML =
      '<div class="empty-state" style="grid-column: 1 / -1;">No drivers found.</div>';
    return;
  }

  drivers.forEach((driver) => {
    const card = document.createElement("div");
    card.className = "driver-card";
    card.innerHTML = `
      <div class="driver-card-header">
        <img src="${driver.photo || DEFAULT_PHOTO}" class="driver-avatar" />
        <div class="driver-info">
          <h2 class="driver-name">${getDriverName(driver)}</h2>
          <p class="driver-phone">${driver.phone || ""}</p>
        </div>
      </div>

      <div class="driver-card-body">
        <div class="card-item">
          <div class="item-label">Rating</div>
          <div class="item-value">${(driver.rating || 0).toFixed(1)} ★</div>
        </div>

        <div class="card-item">
          <div class="item-label">Trips</div>
          <div class="item-value">${driver.trips || 0}</div>
        </div>

        <div class="card-item">
          <div class="item-label">Violations</div>
          <div class="item-value">${
            Array.isArray(driver.violations)
              ? driver.violations.length
              : driver.violations || 0
          }</div>
        </div>

        <div class="card-item vehicle-item">
          <div class="item-label">Vehicle</div>
          <div class="item-value">${driver.assignedVehicle?.vehicleNumber || "Not assigned"}</div>
        </div>
      </div>

      <div class="card-footer">
        <button class="btn-profile">View</button>
        <button class="btn-edit">Edit</button>
        <button class="btn-delete">Delete</button>
      </div>
    `;

    card.querySelector(".btn-profile").addEventListener("click", () =>
      openProfileModal(driver)
    );
    card.querySelector(".btn-edit").addEventListener("click", () =>
      openEditDriverModal(driver)
    );
    card.querySelector(".btn-delete").addEventListener("click", () =>
      handleDeleteDriver(driver._id)
    );

    driversGrid.appendChild(card);
  });
}

/* ───────── PROFILE MODAL ───────── */
function openProfileModal(driver) {
  document.getElementById("modalDriverPhoto").src = driver.photo || DEFAULT_PHOTO;
  document.getElementById("modalDriverName").textContent = getDriverName(driver);

  document.getElementById("modalDriverRating").textContent = driver.rating || 0;
  document.getElementById("modalDriverTrips").textContent = driver.trips || 0;
  document.getElementById("modalDriverPhone").textContent = driver.phone || "—";
  document.getElementById("modalDriverLicense").textContent = driver.license || "—";
  document.getElementById("modalDriverExpiry").textContent = driver.licenseExpiry || "—";

  document.getElementById("modalAssignedVehicle").textContent =
    driver.assignedVehicle?.vehicleNumber || "Not assigned";

  document.getElementById("modalPerformanceTrips").textContent = driver.trips || 0;

  document.getElementById("modalPerformanceViolations").textContent =
    Array.isArray(driver.violations) ? driver.violations.length : driver.violations || 0;

  document.getElementById("modalPerformanceRating").textContent = driver.rating || 0;

  document.getElementById("modalPerformanceDistance").textContent =
    driver.avgDistance || "—";


  // ⭐⭐⭐ PERFORMANCE FETCH (correct place)
  fetch(`${apiBase}/drivers/performance/${driver._id}`)
    .then(res => res.json())
    .then(response => {
      const perf = response.performance;
      if (!perf) return;

      document.getElementById("perfOverspeed").textContent = perf.overspeedCount;
      document.getElementById("perfHarshBrake").textContent = perf.harshBrakingCount;
      document.getElementById("perfHarshAccel").textContent = perf.harshAccelerationCount;
      document.getElementById("perfIdle").textContent = perf.idleTimeMinutes;
      document.getElementById("perfFatigue").textContent = perf.fatigueAlerts;

      const scoreEl = document.getElementById("perfScore");
      const score = perf.performanceScore || 100;

      scoreEl.textContent = `${score} / 100`;

      if (score >= 80) scoreEl.style.color = "#00c853";
      else if (score >= 60) scoreEl.style.color = "#ff9800";
      else scoreEl.style.color = "#e53935";
    })
    .catch(err => console.error("Performance fetch error:", err));


    // Fetch Driver Trip History
// Fetch Driver Trip History
fetch(`${apiBase}/drivers/history/${driver._id}`)
  .then(res => res.json())
  .then(history => {
    const tbody = document.getElementById("driverTripHistoryBody");
    tbody.innerHTML = "";

    if (!history.length) {
      tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center; color:#777;">
      No trips completed
      </td></tr>`;
      return;
    }

    history.forEach(trip => {
      tbody.innerHTML += `
        <tr>
<td>${trip.date ? new Date(trip.date).toLocaleDateString() : "—"}</td>
          <td>${trip.origin || "—"}</td>
          <td>${trip.destination || "—"}</td>
          <td>${trip.distanceKm ? trip.distanceKm.toFixed(2) : "0.00"}</td>
          <td>${trip.durationMin || 0}</td>
        </tr>`;
    });
  })
  .catch(err => console.error("Trip history error:", err));


  profileModal.classList.add("active");
}

function closeProfileModal() {
  profileModal.classList.remove("active");
}

/* ───────── ADD / EDIT DRIVER ───────── */

function openAddDriverModal() {
  editingDriverId = null;
  addEditTitle.textContent = "Add New Driver";
  submitBtn.textContent = "Add Driver";
  addDriverForm.reset();
  addDriverModal.classList.add("active");
}

function openEditDriverModal(driver) {
  editingDriverId = driver._id;
  addEditTitle.textContent = "Edit Driver";
  submitBtn.textContent = "Save Changes";

  document.getElementById("name").value = getDriverName(driver);
  document.getElementById("phone").value = driver.phone || "";
  document.getElementById("license").value = driver.license || "";
  document.getElementById("licenseExpiry").value =
    driver.licenseExpiry || "";
  document.getElementById("rating").value = driver.rating || "";
  document.getElementById("trips").value = driver.trips || "";
  document.getElementById("violations").value =
    Array.isArray(driver.violations)
      ? driver.violations.length
      : driver.violations || 0;

  document.getElementById("avgDistance").value =
    driver.avgDistance || "";

  document.getElementById("assignedVehicle").value =
  driver.assignedVehicle?._id || "";


  addDriverModal.classList.add("active");
}

function closeAddDriverModal() {
  addDriverModal.classList.remove("active");
  editingDriverId = null;
}

/* ───────── CRUD ───────── */

async function handleAddOrEditDriver(event) {
  event.preventDefault();

  let photo = DEFAULT_PHOTO;
  const file = photoFileInput.files[0];

  if (file) {
    photo = await toBase64(file);
  } else if (editingDriverId) {
    const existing = allDrivers.find((d) => d._id === editingDriverId);
    if (existing && existing.photo) photo = existing.photo;
  }

  const totalTrips = Number(document.getElementById("trips").value) || 0;

  const newDriver = {
  driver: document.getElementById("name").value,
  phone: document.getElementById("phone").value,
  license: document.getElementById("license").value,
  licenseExpiry: document.getElementById("licenseExpiry").value,
  rating: Number(document.getElementById("rating").value) || 0,
  trips: totalTrips,
  violations: Number(document.getElementById("violations").value) || 0,
  avgDistance: document.getElementById("avgDistance").value || "—",
  assignedVehicle: document.getElementById("assignedVehicle").value || null,
   // ✅ ✅ THE MOST IMPORTANT FIX
  photo
};

  try {
    if (editingDriverId) {
      await fetch(`${apiBase}/drivers/${editingDriverId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDriver)
      });
    } else {
      await fetch(`${apiBase}/drivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDriver)
      });
    }

    closeAddDriverModal();
    await loadDrivers();
  } catch (err) {
    console.error("Error saving driver:", err);
  }
}

async function handleDeleteDriver(id) {
  if (!confirm("Are you sure you want to delete this driver?")) return;

  try {
    await fetch(`${apiBase}/drivers/${id}`, { method: "DELETE" });
    await loadDrivers();
  } catch (err) {
    console.error("Error deleting driver:", err);
  }
}

/* ───────── EXPORT CSV ───────── */

function exportDriversToCSV() {
  if (!allDrivers.length) {
    alert("No drivers to export");
    return;
  }

  const header = [
    "Name",
    "Phone",
    "License",
    "LicenseExpiry",
    "Rating",
    "Trips",
    "Violations",
    "AvgDistance",
    "AssignedVehicle"
  ];

  const lines = [header.join(",")];

  allDrivers.forEach((d) => {
    const row = [
      getDriverName(d),
      d.phone || "",
      d.license || "",
      d.licenseExpiry || "",
      d.rating ?? "",
      d.trips ?? "",
      Array.isArray(d.violations) ? d.violations.length : d.violations || "",
      d.avgDistance || "",
      d.assignedVehicle || ""
    ].map((val) =>
      `"${String(val).replace(/"/g, '""')}"`
    );

    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "drivers.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ───────── EVENTS ───────── */

searchInput.addEventListener("input", renderDrivers);

sortButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    sortButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSort = btn.getAttribute("data-sort");
    renderDrivers();
  });
});

addDriverBtn.addEventListener("click", openAddDriverModal);
closeModalBtn.addEventListener("click", closeProfileModal);
closeAddDriverBtn.addEventListener("click", closeAddDriverModal);
cancelAddEditBtn.addEventListener("click", closeAddDriverModal);

if (exportBtn) exportBtn.addEventListener("click", exportDriversToCSV);

addDriverForm.addEventListener("submit", handleAddOrEditDriver);

/* ───────── INIT ───────── */

loadDrivers();
