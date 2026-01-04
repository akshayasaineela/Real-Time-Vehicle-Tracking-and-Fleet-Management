# 🚚 TrackSecure — Real-Time Fleet Tracking & Driver Analytics

TrackSecure is a real-time fleet management and driver analytics system built to demonstrate production-style backend architecture, real-time communication, and map-based visualization.

The project focuses on live vehicle tracking, realistic trip simulation, and driver behavior analysis, closely resembling how modern fleet and logistics platforms operate in real-world scenarios.

# 🚀 Key Features
## 📍 Live Vehicle Tracking

Real-time GPS updates using WebSockets (Socket.IO)

Smooth vehicle marker movement on interactive Leaflet maps

Live status updates without page refresh

## 🛣️ Trip & Route Management

Real-world road routing using OSRM

Automatic trip lifecycle handling (start → progress → completion)

Remaining distance and ETA calculation in real time

## 🚗 Realistic Driving Simulation

Harsh braking detection

Harsh acceleration detection

Overspeed monitoring

Traffic idle behavior tracking

## 📊 Driver Performance Analytics

Harsh braking count

Harsh acceleration count

Overspeed events

Idle time tracking

Per-trip performance statistics

## 📈 Interactive Dashboard

Vehicle and driver filtering

Live vehicle detail panel (speed, ETA, status, fuel)

Route visualization directly on the map

# 🛠 Tech Stack
## Backend

Node.js

Express.js

MongoDB with Mongoose

Socket.IO

OSRM (Open Source Routing Machine)

## Frontend

HTML, CSS, JavaScript

Leaflet.js (maps)

Socket.IO Client

# 🧠 System Overview

Backend simulates vehicle movement along real road routes

Vehicle location and driving metrics are broadcast in real time via WebSockets

Frontend listens to live updates and renders vehicles dynamically on the map

Driver behavior data is stored and analyzed for performance insights

# ⚙️ Setup & Run
## Clone the Repository
git clone https://github.com/vivekvardhan592/TrackSecure.git
cd TrackSecure

## Backend Setup
cd backend
npm install

## Environment Variables

####Create a .env file in the backend directory:

MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password

##Start the Server
npm start

Open in Browser
http://localhost:5000/live-tracking.html
