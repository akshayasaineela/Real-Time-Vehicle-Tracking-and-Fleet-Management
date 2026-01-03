/* ======================================================
   STATIC & DYNAMIC GEOFENCE SYSTEM (MERGED + FIXED)
====================================================== */

// --- STATIC predefined zones ---

// const zoneState = {};     
   // IMPORTANT — this was missing

// Draw static zone circles
function drawStaticGeofences(map) {
    staticZones.forEach(z => {
        L.circle([z.lat, z.lng], {
            radius: z.radius,
            color: z.type === "restricted" ? "red" :
                   z.type === "danger" ? "orange" : "green",
            fillOpacity: 0.15
        }).addTo(map);

        L.marker([z.lat, z.lng])
            .bindPopup(`${z.name} (${z.type})`)
            .addTo(map);
    });
}

// Create / Update dynamic 200m follow-circle
const dynamicZones = {}; // vehicleId -> circle

function updateDynamicZone(map, vehicle) {
    const radius = 200; // meters
    const id = vehicle.id;

    if (!dynamicZones[id]) {
        dynamicZones[id] = L.circle([vehicle.lat, vehicle.lng], {
            radius: radius,
            color: "blue",
            fillColor: "rgba(0,0,255,0.2)",
            fillOpacity: 0.3,
            weight: 2
        }).addTo(map);
    } else {
        dynamicZones[id].setLatLng([vehicle.lat, vehicle.lng]);
    }
}

// Helper — check if inside any zone
function isInsideZone(lat, lng, zone) {
    const distance = map.distance([lat, lng], [zone.lat, zone.lng]);
    return distance <= zone.radius;
}

// Main event processor
const zoneState = {}; // vehicleId -> inside/outside

function processGeofenceEvents(map, vehicle) {
    const dz = dynamicZones[vehicle.id];
    if (!dz) return;

    const distance = map.distance(
        [vehicle.lat, vehicle.lng],
        dz.getLatLng()
    );

    const radius = dz.getRadius();
    const inside = distance <= radius;

    // not set yet
    if (zoneState[vehicle.id] === undefined) {
        zoneState[vehicle.id] = inside;
        return;
    }

    // ENTER event
    if (!zoneState[vehicle.id] && inside) {
        sendPushNotification(vehicle, "entered");
    }

    // EXIT event
    if (zoneState[vehicle.id] && !inside) {
        sendPushNotification(vehicle, "exited");
    }

    // update state
    zoneState[vehicle.id] = inside;
}

// UI alert
function showZoneAlert(message, type) {
    let color = "blue";
    if (type === "danger") color = "red";
    if (type === "restricted") color = "orange";
    if (type === "neutral") color = "gray";

    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.top = "20px";
    div.style.right = "20px";
    div.style.padding = "12px 18px";
    div.style.background = color;
    div.style.color = "#fff";
    div.style.fontWeight = "bold";
    div.style.borderRadius = "8px";
    div.style.zIndex = 9999;
    div.innerText = message;

    document.body.appendChild(div);

    setTimeout(() => div.remove(), 2500);
}


       const socket = io("http://localhost:5000");

// ============================================
// Initialize Map
// ============================================
const map = L.map("map").setView([28.6139, 77.2090], 12); // New Delhi

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
}).addTo(map);

// ============================================
// Global Variables
// ============================================



let vehicles = [];
let markers = [];
let routes = {};
const smoothAnimations = {};
let socketPaused = false;


let activeFilters = {
    vehicle: "all",
    driver: "all",
    status: "all",
    search: "",
};

// ============================================
// Marker Icon Generator
// ============================================
// FIXED ICON FUNCTION (NO ROTATION HERE)
function getMarkerIcon(status) {
    let color = "#4CAF50";
    if (status === "idle") color = "#FFC107";
    if (status === "stopped") color = "#F44336";

    return L.divIcon({
        className: "custom-marker",
        html: `
            <div style="
                background-color: ${color};
                border: 3px solid white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

// ============================================
// SOCKET UPDATE HANDLER
// ============================================
socket.on("vehicle-update", (vehicle) => {
    if (socketPaused) return;

    // Find existing object
    const v = vehicles.find(x => x.id === vehicle.id);
    if (!v) {
        console.warn("Vehicle not found in local list:", vehicle.id);
        return;
    }

    // Update live values from backend
    v.lat = vehicle.lat;
    v.lng = vehicle.lng;
    v.speed = vehicle.speed;
    v.status = vehicle.status;

    v.remainingDistance = vehicle.remainingDistance;
v.eta = vehicle.etaMinutes ?? null;

    if (vehicle.destinationCoords) {
        v.destinationCoords = vehicle.destinationCoords;
    }

    // ⭐ REAL backend alerts (no front-end calculation)
    if (vehicle.harshBrake) console.log("🚨 Backend Harsh Brake");
    if (vehicle.harshAccel) console.log("⚡ Backend Harsh Acceleration");
    if (vehicle.overspeed) console.log("🚧 Backend Overspeeding");

    // Move marker smoothly
    updateLiveMarker(v);
});

if (Notification.permission !== "granted") {
    Notification.requestPermission();
}


function sendPushNotification(vehicle, type) {
    const message =
        type === "entered"
            ? `${vehicle.name} ENTERED the geofence zone`
            : `${vehicle.name} EXITED the geofence zone`;

    // Browser push notification
    if (Notification.permission === "granted") {
        new Notification("Geofence Alert", { body: message });
    } else {
        console.log("Push Notification:", message);
    }

    // Show popup alert
    alert(message);
}
// ============================================
// Smooth Marker Movement
// ============================================
function updateLiveMarker(vehicle) {
    if (typeof vehicle.lat !== "number" || typeof vehicle.lng !== "number") {
        return;
    }

    let marker = markers.find(m => m.vehicleId === vehicle.id);

    // Create marker first time
    if (!marker) {
        marker = L.marker([vehicle.lat, vehicle.lng], {
            icon: getMarkerIcon(vehicle.status),
        }).addTo(map);

        marker.vehicleId = vehicle.id;
        marker._lastLatLng = L.latLng(vehicle.lat, vehicle.lng);

        marker.on("click", () => {
            const live = vehicles.find(v => v.id === vehicle.id);
            if (live) showVehiclePanel(live);
        });

        markers.push(marker);
        return;
    }

    const from = marker._lastLatLng;
    const to = L.latLng(vehicle.lat, vehicle.lng);
const speed = Math.max(vehicle.speed, 5); // km/h safeguard
const duration = Math.max(400, 1000 - speed * 5);

    const start = performance.now();

    function animate(now) {
        const progress = Math.min((now - start) / duration, 1);

        const lat = from.lat + (to.lat - from.lat) * progress;
        const lng = from.lng + (to.lng - from.lng) * progress;

        marker.setLatLng([lat, lng]);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            marker._lastLatLng = to;
        }
    }

    requestAnimationFrame(animate);

    marker.setIcon(getMarkerIcon(vehicle.status));

    // Geofence logic stays same
    updateDynamicZone(map, vehicle);
    processGeofenceEvents(map, vehicle);
}



// ============================================
// GEOFENCE: DRAW 200m CIRCLE AROUND VEHICLE
// ============================================
// let geofenceCircles = {};  // store circles by vehicleId

// =======================================================
// GEOFENCE NOTIFICATION LOGIC
// =======================================================
// let geofenceState = {};  // track inside/outside state
    // ENTER ALERT
function calculateBearing(start, end) {
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
}
// ============================================
// LOAD VEHICLES FROM BACKEND
// ============================================

// Toggle icon mode (Car <-> Arrow)

// Toggle view mode (Top <-> Side)


async function loadVehiclesFromBackend() {
    try {
        const res = await fetch("http://localhost:5000/api/vehicles/live");

        if (!res.ok) {
            console.error("❌ LIVE API HTTP ERROR:", res.status);
            return;
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
            console.error("❌ Invalid API response:", data);
            vehicles = [];
            return;
        }

        vehicles = data.map(v => ({
            id: v._id,
            name: v.vehicleNumber,
            driver: v.driverName || "N/A",
            lat: Number(v.lat),
lng: Number(v.lng),

            speed: v.speed,
            status: v.status,
            fuel: v.fuel,
            lastUpdated: "Just now",
            destinationCoords: v.destinationCoords || null
        }));

        console.log("LIVE RESPONSE:", data);

        addVehiclesToMap(vehicles);
       // drawStaticGeofences(map);

        populateFilters();
    } catch (err) {
        console.error("❌ Failed to load vehicles:", err);
    }
}

// ============================================
// Add markers to map
// ============================================
function addVehiclesToMap(list) {
    list.forEach(vehicle => {
        if (typeof vehicle.lat !== "number" || typeof vehicle.lng !== "number") {
            console.warn("Skipping invalid GPS:", vehicle.name);
            return;
        }

        let marker = markers.find(m => m.vehicleId === vehicle.id);

        if (!marker) {
            marker = L.marker([vehicle.lat, vehicle.lng], {
                icon: getMarkerIcon(vehicle.status),
            }).addTo(map);

            marker.vehicleId = vehicle.id;
            

marker.on("click", () => {
    const liveVehicle = vehicles.find(v => v.id === marker.vehicleId);
    if (liveVehicle) showVehiclePanel(liveVehicle);
});

            markers.push(marker);
        } else {
            marker.setLatLng([vehicle.lat, vehicle.lng]);
            marker.setIcon(getMarkerIcon(vehicle.status));
        }
    });
}

// ============================================
// Vehicle Detail Panel
// ==================================
function showVehiclePanel(vehicle) {
    const live = vehicles.find(x => x.id === vehicle.id);
    if (!live) return;

    document.getElementById("panelVehicleName").textContent = live.name;
    document.getElementById("panelDriver").textContent = live.driver;
    document.getElementById("panelSpeed").textContent = `${live.speed} km/h`;

    document.getElementById("panelETA").textContent =
        live.eta !== undefined ? `${live.eta} min` : "--";

    document.getElementById("panelTime").textContent = "Just now";
    document.getElementById("panelFuel").textContent = `${live.fuel || 0}%`;

    const panel = document.getElementById("vehiclePanel");
    panel.classList.add("active");
    panel.dataset.vehicleId = live.id;
}



function closePanel() {
    const panel = document.getElementById("vehiclePanel");
    const vehicleId = panel.dataset.vehicleId;

    if (vehicleId && routes[vehicleId]) {
        map.removeLayer(routes[vehicleId]);
        delete routes[vehicleId];
    }

    panel.classList.remove("active");
    panel.dataset.vehicleId = "";
}

// ============================================
// Filter Logic
// ============================================
function populateFilters() {
    const vehicleFilter = document.getElementById("vehicleFilter");
    const driverFilter = document.getElementById("driverFilter");

    vehicleFilter.innerHTML = `<option value="all">All Vehicles</option>`;
    driverFilter.innerHTML = `<option value="all">All Drivers</option>`;

    vehicles.forEach(v => {
        vehicleFilter.innerHTML += `<option value="${v.id}">${v.name}</option>`;
        driverFilter.innerHTML += `<option value="${v.driver}">${v.driver}</option>`;
    });
}

function filterVehicles() {
    socketPaused = true;
    activeFilters.vehicle = document.getElementById("vehicleFilter").value;
    activeFilters.driver = document.getElementById("driverFilter").value;
    activeFilters.status = document.getElementById("statusFilter").value;
    activeFilters.search = document.getElementById("searchVehicle").value.toLowerCase();

    const filtered = vehicles.filter(v => {
        const matchVehicle = activeFilters.vehicle === "all" || v.id == activeFilters.vehicle;
        const matchDriver = activeFilters.driver === "all" || v.driver === activeFilters.driver;
        const matchStatus = activeFilters.status === "all" || v.status === activeFilters.status;
        const matchSearch =
            activeFilters.search === "" ||
            v.name.toLowerCase().includes(activeFilters.search) ||
            v.driver.toLowerCase().includes(activeFilters.search);

        return matchVehicle && matchDriver && matchStatus && matchSearch;
    });

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    addVehiclesToMap(filtered);
    socketPaused = false;

}

// Attach filter events
document.getElementById("vehicleFilter").addEventListener("change", filterVehicles);
document.getElementById("driverFilter").addEventListener("change", filterVehicles);
document.getElementById("statusFilter").addEventListener("change", filterVehicles);
document.getElementById("searchVehicle").addEventListener("input", filterVehicles);

// ============================================
// Trip Route Display
// ============================================
async function showTripRouteForVehicle(vehicle) {
    try {
        if (
            typeof vehicle.lat !== "number" ||
            typeof vehicle.lng !== "number" ||
            !vehicle.destinationCoords
        ) {
            return;
        }

        const url = `https://router.project-osrm.org/route/v1/driving/${vehicle.lng},${vehicle.lat};${vehicle.destinationCoords.lng},${vehicle.destinationCoords.lat}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        const data = await res.json();

        if (!data.routes || !data.routes.length) return;

        const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

        if (routes[vehicle.id]) {
            map.removeLayer(routes[vehicle.id]);
        }

        routes[vehicle.id] = L.polyline(routeCoords, {
            color: "#2196F3",
            weight: 5,
        }).addTo(map);
    } catch (err) {
        console.error("Route fetch error:", err);
    }
}

function showSelectedVehicleRoute() {
    const panel = document.getElementById("vehiclePanel");
    const vehicleId = panel.dataset.vehicleId;

    const vehicle = vehicles.find(v => v.id === vehicleId);

    if (!vehicle) {
        alert("Vehicle not found");
        return;
    }
    if (!vehicle.destinationCoords) {
        alert("This vehicle has no active trip");
        return;
    }

    showTripRouteForVehicle(vehicle);
}

function goHome(){
    window.location.href="/UserInterface/dashboard/dashboards.html"
}



// Load initial data
loadVehiclesFromBackend();