// Sample alert data
const alerts = [
  { date: "2025-01-10 14:23", vehicle: "VH-4521", driver: "John Smith", type: "Critical", msg: "Engine overheating", status: "Unresolved" },
  { date: "2025-01-11 09:35", vehicle: "VH-4522", driver: "Maria Garcia", type: "Warning", msg: "Low tire pressure", status: "Unresolved" },
  { date: "2025-01-12 17:15", vehicle: "VH-4523", driver: "James Wilson", type: "Info", msg: "Vehicle serviced", status: "Resolved" },
  { date: "2025-01-13 12:40", vehicle: "VH-4524", driver: "Sarah Johnson", type: "Warning", msg: "Brake pads worn", status: "Unresolved" }
];

const tableBody = document.querySelector("#alertTable tbody");
const typeFilter = document.querySelector("#alertTypeFilter");
const dateFilter = document.querySelector("#alertDateFilter");

function loadAlerts() {
  tableBody.innerHTML = "";
  let filtered = alerts.filter(a =>
    (!typeFilter.value || a.type === typeFilter.value) &&
    (!dateFilter.value || a.date.startsWith(dateFilter.value))
  );
  filtered.forEach(a => {
    tableBody.innerHTML += `
      <tr>
        <td>${a.date}</td>
        <td>${a.vehicle}</td>
        <td>${a.driver}</td>
        <td>${a.type}</td>
        <td>${a.msg}</td>
        <td>${a.status}</td>
      </tr>`;
  });

  document.getElementById("totalAlerts").innerText = alerts.length;
  document.getElementById("criticalAlerts").innerText = alerts.filter(a => a.type === "Critical").length;
  document.getElementById("warningAlerts").innerText = alerts.filter(a => a.type === "Warning").length;
  document.getElementById("resolvedAlerts").innerText = alerts.filter(a => a.status === "Resolved").length;
}

loadAlerts();
typeFilter.onchange = loadAlerts;
dateFilter.onchange = loadAlerts;

// Export Excel
document.querySelectorAll(".export-excel").forEach(btn =>
  btn.addEventListener("click", () => {
    const table = document.getElementById(btn.dataset.tableId);
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Alerts_Report.xlsx");
  })
);
async function loadSettings() {
  const settings = await fetch("/api/settings").then(r => r.json());

  document.getElementById("speedLimit").innerText =
    settings.speedAlertThreshold;
}
loadSettings();