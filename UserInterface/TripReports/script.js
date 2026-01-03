/* ---------- Top bar date text ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const todayText = document.getElementById("todayText");
  if (todayText) {
    const d = new Date();
    const options = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
    todayText.textContent = `Today · ${d.toLocaleDateString(undefined, options)}`;
  }
});

/* ---------- Tabs switching ---------- */
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;

    tabButtons.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(tabName)?.classList.add("active");

    loadReport(tabName); // load relevant data
  });
});

/* ---------- Backend Integration ---------- */

const BASE_URL = "http://127.0.0.1:5000/api/reports";

async function fetchReport(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}`);
    if (!res.ok) throw new Error("Network error");
    return await res.json();
  } catch (err) {
    console.error("❌ Backend error:", endpoint, err);
    return [];
  }
}

function renderTable(tbodySelector, template, data) {
  const tbody = document.querySelector(tbodySelector);
  if (!tbody) return;
  tbody.innerHTML = "";
  data.forEach((row) => {
    tbody.innerHTML += template(row);
  });
}

function loadReport(tab) {
  // Trips
  if (tab === "trip-reports") {
    fetchReport("trips").then((data) => {
      renderTable("#tripTable tbody", (i) => {
        const statusClass =
          (i.status || "").toLowerCase() === "completed"
            ? "status-completed"
            : (i.status || "").toLowerCase() === "in progress"
            ? "status-active"
            : "status-pending";

        return `
          <tr>
            <td>${i.tripId || "-"}</td>
            <td>${i.driver || "-"}</td>
            <td>${i.vehicle || "-"}</td>
            <td>${i.start || "-"}</td>
            <td>${i.destination || "-"}</td>
            <td>${i.distance || "-"}</td>
            <td>${i.duration || "-"}</td>
            <td><span class="status-badge ${statusClass}">${i.status || "Unknown"}</span></td>
          </tr>
        `;
      }, data);
    });
  }

  // Driver performance
  if (tab === "driver-performance") {
    fetchReport("driver-performance").then((data) => {
      renderTable("#driverTable tbody", (i) => {
        const score = i.safetyScore || 0;
        const scoreClass = score >= 95 ? "score-excellent" : "score-good";
        return `
          <tr>
            <td>${i.driver || "-"}</td>
            <td>${i.empId || "-"}</td>
            <td>${i.miles || "-"}</td>
            <td><span class="score-badge ${scoreClass}">${score}%</span></td>
            <td>${i.efficiency || 0}%</td>
            <td>${i.onTime || 0}%</td>
            <td>${i.trips || "-"}</td>
            <td>${i.rating || "-"}</td>
          </tr>
        `;
      }, data);
    });
  }

  // Vehicle usage
  if (tab === "vehicle-usage") {
    fetchReport("vehicle-usage").then((data) => {
      renderTable("#vehicleTable tbody", (i) => {
        const status = (i.status || "").toLowerCase();
        let statusClass = "vehicle-active";
        if (status === "idle") statusClass = "vehicle-idle";
        if (status === "maintenance") statusClass = "vehicle-maintenance";

        return `
          <tr>
            <td>${i.vehicleId || "-"}</td>
            <td>${i.type || "-"}</td>
            <td>${i.currentMileage || "-"}</td>
            <td>${i.monthMiles || "-"}</td>
            <td>${i.utilization || 0}%</td>
            <td>${i.fuel || "-"}</td>
            <td>${i.avgMpg || "-"}</td>
            <td><span class="vehicle-status ${statusClass}">${i.status || "Unknown"}</span></td>
          </tr>
        `;
      }, data);
    });
  }

  // Violations
  if (tab === "violations-report") {
    fetchReport("violations").then((data) => {
      renderTable("#violationsTable tbody", (i) => {
        const sev = (i.severity || "").toLowerCase();
        let sevClass = "severity-info";
        if (sev === "warning") sevClass = "severity-warning";
        if (sev === "alert") sevClass = "severity-alert";
        if (sev === "critical") sevClass = "severity-critical";

        return `
          <tr>
            <td>${i.datetime || "-"}</td>
            <td>${i.driver || "-"}</td>
            <td>${i.vehicle || "-"}</td>
            <td>${i.type || "-"}</td>
            <td>${i.location || "-"}</td>
            <td><span class="severity-pill ${sevClass}">${i.severity || "-"}</span></td>
            <td>${i.impact || "-"}</td>
            <td><input type="checkbox" ${i.reviewed ? "checked" : ""} /></td>
          </tr>
        `;
      }, data);
    });
  }

  // Maintenance
  if (tab === "maintenance-report") {
    fetchReport("maintenance").then((data) => {
      renderTable("#maintenanceTable tbody", (i) => {
        const st = (i.status || "").toLowerCase();
        let stClass = "maint-scheduled";
        if (st === "in progress") stClass = "maint-in-progress";
        if (st === "completed") stClass = "maint-completed";
        if (st === "overdue") stClass = "maint-overdue";

        return `
          <tr>
            <td>${i.vehicle || "-"}</td>
            <td>${i.mileage || "-"}</td>
            <td>${i.serviceType || "-"}</td>
            <td>${i.lastService || "-"}</td>
            <td>${i.nextDue || "-"}</td>
            <td>${i.daysLeft || "-"}</td>
            <td><span class="maint-status ${stClass}">${i.status || "-"}</span></td>
            <td>${i.notes || "-"}</td>
          </tr>
        `;
      }, data);
    });
  }
}

/* ---------- Excel export ---------- */

function exportTableToExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });
  XLSX.writeFile(wb, filename);
}

document.querySelectorAll(".export-excel").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tableId = btn.getAttribute("data-table-id");
    const activeTab = document.querySelector(".tab-btn.active");
    const tabLabel = activeTab ? activeTab.textContent.trim().replace(/\s+/g, "_") : "Report";
    const filename = `Fleet_${tabLabel}.xlsx`;
    exportTableToExcel(tableId, filename);
  });
});

/* ---------- PDF button hooks (frontend only) ---------- */
// Right now just alerts. Later you can connect actual backend PDF export.
document.querySelectorAll(".download-pdf").forEach((btn) => {
  btn.addEventListener("click", () => {
    const activeTab = document.querySelector(".tab-btn.active");
    const tabLabel = activeTab ? activeTab.textContent.trim() : "Report";
    alert(`PDF download for "${tabLabel}" can be wired to backend here.`);
  });
});

async function loadTripReports() {
    try {
        const res = await fetch("http://localhost:5000/api/trips");
        const trips = await res.json();

        const table = document.getElementById("tripReportTableBody");
        table.innerHTML = "";

        trips.forEach(trip => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${trip._id}</td>
                <td>${trip.driver?.name || "Unknown"}</td>
                <td>${trip.vehicle?.vehicleNumber || "Unknown"}</td>
                <td>${trip.origin || "-"}</td>
                <td>${trip.destination || "-"}</td>
                <td>${trip.distance || 0} km</td>
                <td>${formatDuration(trip.duration)}</td>
                <td>${formatStatus(trip.status)}</td>
            `;

            table.appendChild(row);
        });

    } catch (error) {
        console.error("ERROR LOADING TRIP REPORTS:", error);
    }
}

function formatDuration(minutes) {
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

function formatStatus(status) {
    if (!status) return "-";
    return status.charAt(0).toUpperCase() + status.slice(1);
}

/* ---------- Initial load ---------- */
window.addEventListener("load", () => {
  // Default: load trip-reports
  loadReport("trip-reports");
});
