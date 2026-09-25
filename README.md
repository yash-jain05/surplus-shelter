# Surplus Shelter

Surplus Shelter is a food-surplus management platform that connects food donors with recipient organizations and coordinates delivery through drivers.

## Problem Statement

Large amounts of surplus food from individuals, restaurants, events, and organizations can go unused while shelters and community organizations need food resources.

Surplus Shelter provides a digital workflow to connect these two sides and coordinate delivery.

## Proposed Solution

The platform allows:

1. Donors to submit surplus food details.
2. The system to match donations with suitable recipient organizations.
3. Recipients to accept available donations.
4. Drivers to receive assigned deliveries.
5. Drivers to update delivery status.
6. The dashboard to display delivery and impact information.

## Application Flow

Dashboard
↓
Donor
↓
Matching Engine
↓
Recipient
↓
Driver
↓
Delivery
↓
Dashboard

## Key Features

- Food donation registration
- Pickup location selection
- Recipient matching
- Recipient capacity management
- Driver assignment
- Pickup and delivery tracking
- Real-time updates
- Impact dashboard
- Donation and delivery analytics

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- Leaflet

### Backend & Database
- Supabase
- PostgreSQL
- Supabase Realtime

### Deployment
- Vercel

### Development
- VS Code
- Git
- GitHub

## Database

The application uses Supabase PostgreSQL with the following major tables:

- `donations`
- `recipients`
- `matches`
- `drivers`
- `notifications`

## Matching System

The matching engine considers:

- Distance
- Recipient capacity
- Food-type eligibility
- Donation urgency

These factors are used to identify suitable recipient organizations.

## Live Application

https://surplus-shelter-ten.vercel.app

## Application Pages

- Home: https://surplus-shelter-ten.vercel.app/home
- Donor: https://surplus-shelter-ten.vercel.app/donor
- Recipient: https://surplus-shelter-ten.vercel.app/recipient
- Driver: https://surplus-shelter-ten.vercel.app/driver
- Dashboard: https://surplus-shelter-ten.vercel.app/dashboard

## GitHub Repository

https://github.com/yash-jain05/surplus-shelter

## System Architecture

The architecture diagram is available in:

`docs/architecture.png`

## Team

- Yash Jain — Team Captain
- Kabir Katare
- Shelly Soni
- Anubhav Ratnawat

# Team Contributions

### 1. Yash Jain — Team Captain & Lead Developer
- Overall project planning and coordination
- Designed and integrated the overall system workflow
- Frontend development and component integration
- Supabase database and backend integration
- Implemented the donor-to-recipient matching workflow
- Developed and integrated the impact dashboard
- GitHub repository management and deployment
- End-to-end integration, testing, and final project verification

### 2. Kabir Katare — Backend & Matching Developer
- Assisted with database structure and backend integration
- Worked on recipient-side workflow
- Assisted with donation matching logic
- Supported backend testing and integration

### 3. Shelly Soni — UI/UX & Presentation
- Assisted with user interface and user-flow design
- Worked on visual presentation of the application
- Prepared demo screenshots and presentation material
- Assisted with project documentation and pitch preparation

### 4. Anubhav Ratnawat — Testing & Documentation
- Performed end-to-end application testing
- Identified and reported bugs during development
- Assisted with README and technical documentation
- Supported deployment verification
- Assisted with demo preparation and final testing
## Future Scope

- Automatic nearest-driver dispatch
- Improved route optimization
- Mobile application
- Advanced notifications
- AI-assisted food recognition
- Expansion to multiple cities



# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
                        USER
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
      DONOR           RECIPIENT           DRIVER
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
                  REACT FRONTEND
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
       React Router    Leaflet       Recharts
            │             │             │
            └─────────────┼─────────────┘
                          │
                          ▼
                 SUPABASE CLIENT
                          │
                          ▼
                  SUPABASE API
                          │
          ┌───────────────┼────────────────┐
          │               │                │
          ▼               ▼                ▼
      PostgreSQL       Realtime        Database
          │               │
          ▼               ▼
      Donations        Live Updates
      Recipients
      Matches
      Drivers
          │
          ▼
    MATCHING ENGINE
          │
    ┌─────┼─────────┐
    ▼     ▼         ▼
 Distance Capacity  Urgency
    │     │         │
    └─────┼─────────┘
          ▼
     BEST MATCH
          │
          ▼
    DRIVER DELIVERY
          │
          ▼
       DELIVERED
          │
          ▼
      DASHBOARD
