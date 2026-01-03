const apiBase = "http://localhost:5001";

// let maintenance = [];
let editingId = null;
let currentSort = "nextService"; // default sort

// DOM
const addBtn = document.getElementById("addRecordBtn");
const modal = document.getElementById("maintModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const form = document.getElementById("maintForm");
const tableBody = document.getElementById("maintenanceBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

// Stats
const statTotal = document.getElementById("statTotal");
const statGood = document.getElementById("statGood");
const statUpcoming = document.getElementById("statUpcoming");
const statOverdue = document.getElementById("statOverdue");

// Load data
async function loadMaintenance() {
  try {
    // ⛔ TEMPORARILY DISABLE BACKEND CALL
    // const res = await fetch(`${apiBase}/maintenance`);
    // maintenance = await res.json();

    // ✅ USE TEMPORARY LOCAL DATA
    renderTable();
    updateStats();
    updateCharts();
  } catch (err) {
    console.error("Failed to load:", err);
  }
}


// Sort buttons
document.querySelectorAll(".sort-buttons .btn-secondary").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sort-buttons .btn-secondary")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentSort = btn.dataset.sort;
    renderTable();
  });
});

// Search
searchInput.addEventListener("input", renderTable);

// Filter by status
statusFilter.addEventListener("change", renderTable);


let maintenance = [
  {
    id: 1,
    vehicle: "TS 09 BE 0999",
    lastService: "2025-12-02",
    nextService: "2026-02-02",
    serviceType: "Engine",
    notes: "Oil changed, filters replaced"
  },
  {
    id: 2,
    vehicle: "TS 09 BE 0976",
    lastService: "2025-12-02",
    nextService: "2026-01-15",
    serviceType: "Full Service",
    notes: "General checkup, tyre rotation"
  }
];




// Table
function renderTable() {
  let data = [...maintenance];

  // Search filter
  const q = searchInput.value.toLowerCase();
  data = data.filter(m => m.vehicle.toLowerCase().includes(q));

  // Status filter
  const f = statusFilter.value;
  data = data.filter(m => {
    const days = daysUntil(m.nextService);
    if (days > 20) return f === "all" || f === "good";
    if (days > 7) return f === "all" || f === "upcoming";
    return f === "all" || f === "overdue";
  });

  // Sorting
  data.sort((a, b) => {
    if (currentSort === "vehicle") return a.vehicle.localeCompare(b.vehicle);
    if (currentSort === "nextService") return new Date(a.nextService) - new Date(b.nextService);
    if (currentSort === "status") return daysUntil(a.nextService) - daysUntil(b.nextService);
  });

  tableBody.innerHTML = "";
  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No records found</td></tr>`;
    return;
  }

  data.forEach((m) => {
    const days = daysUntil(m.nextService);
    let status = "Healthy";
    let cls = "status-good";

    if (days <= 7) {
      status = "Overdue";
      cls = "status-overdue";
    } else if (days <= 20) {
      status = "Upcoming";
      cls = "status-upcoming";
    }

    tableBody.innerHTML += `
      <tr>
        <td>${m.vehicle}</td>
        <td>${m.lastService}</td>
        <td>${m.nextService}</td>
        <td>${m.serviceType}</td>
        <td><span class="status-badge ${cls}">${status}</span></td>
        <td>${m.notes || ""}</td>
        <td>
          <button class="btn-edit" onclick="editRecord(${m.id})">Edit</button>
          <button class="btn-delete" onclick="deleteRecord(${m.id})">Delete</button>
        </td>
      </tr>
    `;
  });
}

// Stats
function updateStats() {
  statTotal.textContent = maintenance.length;
  statGood.textContent = maintenance.filter(m => daysUntil(m.nextService) > 20).length;
  statUpcoming.textContent = maintenance.filter(m => daysUntil(m.nextService) <= 20 && daysUntil(m.nextService) > 7).length;
  statOverdue.textContent = maintenance.filter(m => daysUntil(m.nextService) <= 7).length;
}

function daysUntil(date) {
  return Math.round((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
}

// Add or Edit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const record = {
    vehicle: document.getElementById("vehicle").value,
    lastService: document.getElementById("lastService").value,
    nextService: document.getElementById("nextService").value,
    serviceType: document.getElementById("serviceType").value,
    notes: document.getElementById("notes").value,
  };

  try {
    if (editingId) {
      await fetch(`${apiBase}/maintenance/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } else {
      await fetch(`${apiBase}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    }
    closeModal();
    loadMaintenance();
  } catch (err) {
    console.error("Error saving:", err);
  }
});

// Export CSV
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!maintenance.length) return alert("No records to export");

  const header = ["Vehicle", "Last Service", "Next Service", "Service Type", "Status", "Notes"];
  const rows = maintenance.map(m => {
    const d = daysUntil(m.nextService);
    const s = d > 20 ? "Healthy" : d > 7 ? "Upcoming" : "Overdue";
    return [m.vehicle, m.lastService, m.nextService, m.serviceType, s, m.notes || ""];
  });

  const csv = [header, ...rows].map(r => r.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "maintenance.csv";
  a.click();
});

// Edit
window.editRecord = (id) => {
  const m = maintenance.find(r => r.id === id);
  editingId = id;
  document.getElementById("vehicle").value = m.vehicle;
  document.getElementById("lastService").value = m.lastService;
  document.getElementById("nextService").value = m.nextService;
  document.getElementById("serviceType").value = m.serviceType;
  document.getElementById("notes").value = m.notes;
  document.getElementById("modalTitle").textContent = "Edit Maintenance";
  modal.classList.add("active");
};

// Delete
window.deleteRecord = async (id) => {
  if (!confirm("Delete record?")) return;
  await fetch(`${apiBase}/maintenance/${id}`, { method: "DELETE" });
  loadMaintenance();
};

// Modal
addBtn.addEventListener("click", () => {
  editingId = null;
  form.reset();
  document.getElementById("modalTitle").textContent = "Add Maintenance";
  modal.classList.add("active");
});
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

function closeModal() {
  modal.classList.remove("active");
}

// Charts
let statusChart, typeChart, scheduleChart;
function updateCharts() {
  const statuses = { Healthy: 0, Upcoming: 0, Overdue: 0 };
  const types = {};

  maintenance.forEach((m) => {
    const d = daysUntil(m.nextService);
    if (d > 20) statuses.Healthy++;
    else if (d > 7) statuses.Upcoming++;
    else statuses.Overdue++;

    types[m.serviceType] = (types[m.serviceType] || 0) + 1;
  });

  drawChart("statusChart", "pie", Object.keys(statuses), Object.values(statuses), statusChart, (chart) => statusChart = chart);
  drawChart("typeChart", "bar", Object.keys(types), Object.values(types), typeChart, (chart) => typeChart = chart);
  drawChart("scheduleChart", "line", maintenance.map(m => m.vehicle), maintenance.map(m => daysUntil(m.nextService)), scheduleChart, (chart) => scheduleChart = chart);
}

function drawChart(canvasId, type, labels, data, oldChart, setter) {
  const ctx = document.getElementById(canvasId);
  if (oldChart) oldChart.destroy();
  setter(new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label: canvasId === "statusChart" ? "Status" :
               canvasId === "typeChart" ? "Service Types" :
               "Upcoming Load",
        data,
        backgroundColor: ["#22c55e", "#f97316", "#ef4444", "#3b82f6", "#a855f7"]
      }]
    }
  }));
}

loadMaintenance();
