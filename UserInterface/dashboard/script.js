// Import Leaflet
const L = window.L;

// ===============================
// On Page Load
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  initializeCharts();
  initializeMap();
  addInteractivity();

setInterval(() => {
  loadVehicleStats();  // Updates Total, Running, Idle
  loadTripStats();     // Updates Ongoing Trips
}, 2000); // every 2 seconds

  // loadDriverPerformance();
});


// ===============================
// CHARTS (Fake Data)
// ===============================
function initializeCharts() {
  // Trips Per Week Chart
  new Chart(document.getElementById("tripsChart"), {
    type: "line",
    data: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      datasets: [{
        label: "Trips",
        data: [45, 52, 48, 61],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
        fill: true
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Distance Chart
  new Chart(document.getElementById("distanceChart"), {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{
        label: "Distance (km)",
        data: [1200, 1450, 1100, 1600, 1350, 900, 800],
        backgroundColor: "#10b981",
        borderRadius: 8
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Fuel Cost Chart
  new Chart(document.getElementById("fuelCostChart"), {
    type: "line",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [{
        label: "Fuel Cost ($)",
        data: [2400, 2800, 2600, 3200, 2900, 3400],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        tension: 0.4,
        fill: true
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}



// ===============================
// LIVE MAP (REAL DATA)
// ===============================
function initializeMap() {
  const map = L.map("map").setView([20.5937, 78.9629], 5); // India center

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  let vehicles = [];
  let vehicleMarkers = {};

  const getIcon = (status) => {
    const colors = {
      running: "#10b981",
      idle: "#f59e0b",
      stopped: "#ef4444",
    };

    return L.divIcon({
      className: "custom-marker",
      html: `<div style="background:${colors[status] || "#999"}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  async function loadLiveVehicles() {
    try {
      const res = await fetch("http://localhost:5000/api/vehicles/live");
      vehicles = await res.json();
      updateVehicleMarkers();
    } catch (err) {
      console.error("Failed to load live vehicles:", err);
    }
  }

  function updateVehicleMarkers() {
    vehicles.forEach(v => {
      if (!v.lat || !v.lng) return;

      const id = v._id;

      if (!vehicleMarkers[id]) {
        vehicleMarkers[id] = L.marker([v.lat, v.lng], {
          icon: getIcon(v.status)
        })
        .addTo(map)
        .bindPopup(`
          <strong>${v.vehicleNumber}</strong><br>
          Driver: ${v.driverName || "N/A"}<br>
          Speed: ${v.speed || 0} km/h<br>
          Fuel: ${v.fuel || 0}%
        `);
      } else {
        vehicleMarkers[id].setLatLng([v.lat, v.lng]);
        vehicleMarkers[id].setPopupContent(`
          <strong>${v.vehicleNumber}</strong><br>
          Driver: ${v.driverName || "N/A"}<br>
          Speed: ${v.speed || 0} km/h<br>
          Fuel: ${v.fuel || 0}%
        `);
      }
    });
  }

  loadLiveVehicles();
  setInterval(loadLiveVehicles, 3000);
}



// ===============================
// INTERACTIVITY (Fake Alerts & Animations)
// ===============================
function addInteractivity() {
  // Animate menu
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // Fake notifications
  document.querySelector(".notification-bell").addEventListener("click", () => {
    alert("You have new alerts:\n- Overspeed detected\n- Harsh braking\n- Route deviation");
  });

  // Stats animation
  const statCards = document.querySelectorAll(".stat-card");
  statCards.forEach((card, i) => {
    card.style.opacity = 0;
    card.style.transform = "translateY(20px)";
    setTimeout(() => {
      card.style.transition = "0.5s";
      card.style.opacity = 1;
      card.style.transform = "translateY(0)";
    }, i * 120);
  });
}



// ===============================
// VEHICLE STATS (REAL DATA)
// ===============================
async function loadVehicleStats() {
  const { total, running, idle } = await fetch("http://localhost:5000/api/stats/vehicles")
    .then(r => r.json());

  document.querySelector(".stat-card.blue .stat-number").innerText = total;
  document.querySelector(".stat-card.green .stat-number").innerText = running;
  document.querySelector(".stat-card.orange .stat-number").innerText = idle;
}

async function loadTripStats() {
  const { ongoing } = await fetch("http://localhost:5000/api/stats/trips")
    .then(r => r.json());

  document.querySelector(".stat-card.purple .stat-number").innerText = ongoing;
}


// ===============================
// TRIP STATS (REAL DATA)
// ===============================



// ===============================
// DRIVER PERFORMANCE (REAL DATA)
// ===============================
// async function loadDriverPerformance() {
//   try {
//     const container = document.querySelector(".stats-grid");

//     const card = document.createElement("div");
//     card.className = "stat-card purple";
//     card.innerHTML = `
//       <div class="stat-icon"><i class="fas fa-star"></i></div>
//       <div class="stat-info">
//         <h3>Top Drivers</h3>
//         <ul id="topDriverList"></ul>
//       </div>
//     `;
//     container.appendChild(card);

//     const drivers = await fetch("http://localhost:5000/api/drivers").then(res => res.json());

//     const results = [];

//     for (const d of drivers) {
//       const perf = await fetch(`http://localhost:5000/api/drivers/performance/${d._id}`).then(res => res.json());

//       if (perf.success && perf.performance) {
//         results.push({
//           name: d.driver,
//           score: perf.performance.performanceScore
//         });
//       }
//     }

//     results.sort((a, b) => b.score - a.score);

//     const ul = document.getElementById("topDriverList");
//     results.slice(0, 5).forEach(d => {
//       const li = document.createElement("li");
//       li.textContent = `${d.name} • Score: ${d.score}`;
//       ul.appendChild(li);
//     });

//   } catch (err) {
//     console.error("Driver performance load error:", err);
//   }
// }



// Add bell animation CSS
const style = document.createElement("style");
style.textContent = `
@keyframes bellRing {
  0%, 100% { transform: rotate(0deg); }
  10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
  20%, 40%, 60%, 80% { transform: rotate(10deg); }
}`;
document.head.appendChild(style);
