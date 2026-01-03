import { staticZones, dynamicZones } from "./geofenceZones.js";

// Store last zone states to detect entry/exit
const zoneState = {}; // vehicleId -> zoneId

// Add static zones to map
export function drawStaticGeofences(map) {
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

// Create/update dynamic 200m geofence
export function updateDynamicZone(map, vehicle) {
    const radius = 200; // 200-meter zone
    const id = vehicle.id;

    // If zone does not exist → create new
    if (!dynamicZones[id]) {
        dynamicZones[id] = L.circle([vehicle.lat, vehicle.lng], {
            radius,
            color: "blue",
            fillOpacity: 0.08
        }).addTo(map);

        return;
    }

    // If exists → update its position
    dynamicZones[id].setLatLng([vehicle.lat, vehicle.lng]);
}

// Check if point is inside circle
function isInsideZone(lat, lng, zone) {
    const distance = map.distance([lat, lng], [zone.lat, zone.lng]);
    return distance <= zone.radius;
}

// Zone Event Engine
export function processGeofenceEvents(map, vehicle) {
    const { lat, lng } = vehicle;

    let insideZone = null;

    // Check STATIC ZONES
    for (const zone of staticZones) {
        if (isInsideZone(lat, lng, zone)) {
            insideZone = zone;
            break;
        }
    }

    // Check DYNAMIC ZONE (200m)
    const dz = dynamicZones[vehicle.id];
    if (dz && map.distance([lat, lng], dz.getLatLng()) <= dz.getRadius()) {
        insideZone = { id: "dynamic", name: "200m Proximity Zone", type: "info" };
    }

    const lastZone = zoneState[vehicle.id];

    // ========== ENTRY ==========
    if (!lastZone && insideZone) {
        zoneState[vehicle.id] = insideZone.id;

        showZoneAlert(`${vehicle.name} ENTERED ${insideZone.name}`, insideZone.type);
    }

    // ========== EXIT ==========
    if (lastZone && !insideZone) {
        zoneState[vehicle.id] = null;

        showZoneAlert(`${vehicle.name} EXITED zone`, "neutral");
    }

    // ========== RULE VIOLATION ==========
    if (insideZone) {
        if (insideZone.type === "restricted") {
            showZoneAlert(`⚠️ ${vehicle.name} in RESTRICTED ZONE`, "restricted");
        }
        if (insideZone.type === "danger") {
            showZoneAlert(`🚨 ${vehicle.name} in HIGH-RISK AREA`, "danger");
        }
    }
}

// ALERT UI (simple visible banner)
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
