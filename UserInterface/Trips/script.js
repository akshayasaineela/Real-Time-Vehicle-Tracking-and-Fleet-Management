// =====================================================================================
// SIDEBAR
// =====================================================================================
const sidebar = document.getElementById("sidebar");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const closeSidebarBtn = document.getElementById("closeSidebar");
const startTimeInput = document.getElementById("startTime");

if (hamburgerBtn) hamburgerBtn.addEventListener("click", () => sidebar.classList.add("active"));
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", () => sidebar.classList.remove("active"));


// =====================================================================================
// ADD TRIP BUTTON HANDLER
// =====================================================================================
const addTripBtn = document.querySelector(".add-btn");
const modal = document.getElementById("tripModal");

if (addTripBtn) {
  addTripBtn.addEventListener("click", () => {
    modal.classList.add("active");
  });
}

// =====================================================================================
// BACK BUTTON HANDLER
// =====================================================================================
const backBtn = document.querySelector(".back-btn");

if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.history.back();
  });
}


// =====================================================================================
// LABELS
// =====================================================================================
const driverLabel = document.getElementById("selectedDriver");
const vehicleLabel = document.getElementById("selectedVehicle");
const selectDriverBtn = document.getElementById("selectDriverBtn");
const selectVehicleBtn = document.getElementById("selectVehicleBtn");


// =====================================================================================
// DRIVER UI SYNC – FINAL FIXED VERSION
// =====================================================================================
async function updateDriverUI() {
  const driverId = localStorage.getItem("selectedDriverId");
  const driverName = localStorage.getItem("selectedDriverName");

  if (!driverId || !driverName) {
    driverLabel.innerText = "No Driver Selected";
    selectDriverBtn.innerText = "Select Driver";
    selectDriverBtn.onclick = () => window.location.href = "select-driver.html";
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/api/drivers/${driverId}`);
    if (!res.ok) {
      localStorage.removeItem("selectedDriverId");
      localStorage.removeItem("selectedDriverName");
      return updateDriverUI();
    }
  } catch {}

  driverLabel.innerText = driverName;
  selectDriverBtn.innerText = "❌ Remove Driver";
  selectDriverBtn.onclick = () => {
    localStorage.removeItem("selectedDriverId");
    localStorage.removeItem("selectedDriverName");
    updateDriverUI();
  };
}

updateDriverUI();


// =====================================================================================
// VEHICLE UI SYNC – FINAL FIXED VERSION
// =====================================================================================
async function updateVehicleUI() {
  const vehicleId = localStorage.getItem("selectedVehicleId");
  const vehicleNumber = localStorage.getItem("selectedVehicleNumber");

  if (!vehicleId || !vehicleNumber) {
    vehicleLabel.innerText = "No Vehicle Selected";
    selectVehicleBtn.innerText = "Select Vehicle";
    selectVehicleBtn.onclick = () => window.location.href = "select-vehicle.html";
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/api/vehicles/${vehicleId}`);
    if (!res.ok) {
      localStorage.removeItem("selectedVehicleId");
      localStorage.removeItem("selectedVehicleNumber");
      return updateVehicleUI();
    }
  } catch {}

  vehicleLabel.innerText = vehicleNumber;
  selectVehicleBtn.innerText = "❌ Remove Vehicle";
  selectVehicleBtn.onclick = () => {
    localStorage.removeItem("selectedVehicleId");
    localStorage.removeItem("selectedVehicleNumber");
    updateVehicleUI();
  };
}

updateVehicleUI();


// =====================================================================================
// HELPER: Get Coords
// =====================================================================================
async function getCoordsFromAddress(address) {
  if (!address || address.trim().length < 3) throw new Error("Invalid address");

  const res = await fetch(`http://localhost:5000/api/geocode?place=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error("Geocode failed");

  return await res.json();
}


// =====================================================================================
// FIXED START TIME FORMATTER
// =====================================================================================
function normalizeStartTime(raw) {
  if (!raw) return "";

  // Example raw: "2025-12-08T09:45"
  if (raw.length === 16) return raw + ":00"; // add seconds

  return raw;
}


// =====================================================================================
// AVAILABILITY CHECK – FINAL FIXED VERSION
// =====================================================================================
async function fetchAvailability() {
  let startTime = normalizeStartTime(startTimeInput.value);

  if (!startTime || isNaN(new Date(startTime).getTime())) {
    console.warn("Invalid startTime → skipping availability check");
    return;
  }

  const duration = 60;
  const url = `http://localhost:5000/api/trips/availability?startTime=${encodeURIComponent(startTime)}&duration=${duration}`;

  console.log("📡 Checking availability:", url);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("⚠ Availability check failed:", res.status);
      return;
    }

    const data = await res.json();
    if (!data.success) return console.warn("Backend error:", data.message);

    localStorage.setItem("availableDrivers", JSON.stringify(data.drivers));
    localStorage.setItem("availableVehicles", JSON.stringify(data.vehicles));

    if (typeof renderDriverList === "function") renderDriverList(data.drivers);
    if (typeof renderVehicleList === "function") renderVehicleList(data.vehicles);

    console.log("✓ Availability loaded.");
  } catch (err) {
    console.error("Availability error:", err);
  }
}

if (startTimeInput) startTimeInput.addEventListener("change", fetchAvailability);


// =====================================================================================
// TRIP SUBMISSION – FINAL CLEAN WORKING VERSION
// =====================================================================================
/* ============================================================
   TRIP SUBMISSION – FINAL CLEAN WORKING VERSION
============================================================ */
if (document.getElementById("tripForm")) {
  document.getElementById("tripForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const driverId = localStorage.getItem("selectedDriverId");
    const vehicleId = localStorage.getItem("selectedVehicleId");

    if (!driverId || !vehicleId) {
      alert("Please select both Driver and Vehicle.");
      return;
    }

    const origin = document.getElementById("startPoint").value.trim();
    const destination = document.getElementById("destination").value.trim();

    let startTime = normalizeStartTime(document.getElementById("startTime").value);
    startTime = new Date(startTime);

    if (!origin || !destination || isNaN(startTime)) {
      alert("Fill all fields correctly.");
      return;
    }

    try {
      const originCoords = await getCoordsFromAddress(origin);
      const destinationCoords = await getCoordsFromAddress(destination);

      let duration = 1;
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destinationCoords.lng},${destinationCoords.lat}?overview=false`;
        const osrmRes = await fetch(url);
        const osrmData = await osrmRes.json();
        if (osrmData.routes?.length) duration = Math.ceil(osrmData.routes[0].duration / 60);
      } catch {}

      const trip = {
        driver: driverId,
        vehicle: vehicleId,
        origin,
        destination,
        originCoords,
        destinationCoords,
        startTime,
        duration
      };

      const res = await fetch("http://localhost:5000/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip)
      });

      const data = await res.json();

      if (data.success) {
        alert("Trip created successfully!");
        modal.classList.remove("active");
        tripForm.reset();
        localStorage.clear();
        updateDriverUI();
        updateVehicleUI();
      } else {
        alert(data.message || "Trip creation failed");
      }

    } catch (err) {
      console.error("Trip error:", err);
      alert("Trip creation failed. Check console.");
    }
  });
}
/* ============================================================
   END TRIP SUBMISSION
============================================================ */
