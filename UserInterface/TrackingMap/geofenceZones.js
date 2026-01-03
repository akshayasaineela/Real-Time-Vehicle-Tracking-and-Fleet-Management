// =======================================================
// STATIC & DYNAMIC GEOFENCE ZONES
// =======================================================

// STATIC predefined zones (you can edit anytime)
export const staticZones = [
    {
        id: "warehouse-1",
        name: "Main Warehouse",
        lat: 28.6200,
        lng: 77.2100,
        radius: 300,
        type: "safe"
    },
    {
        id: "school-zone-1",
        name: "School Zone",
        lat: 28.6400,
        lng: 77.2300,
        radius: 250,
        type: "restricted"
    },
    {
        id: "high-risk-1",
        name: "High Risk Area",
        lat: 28.6000,
        lng: 77.2000,
        radius: 400,
        type: "danger"
    }
];

// DYNAMIC ZONES — created for every moving vehicle (200m)
export const dynamicZones = {}; // vehicleId → circle
