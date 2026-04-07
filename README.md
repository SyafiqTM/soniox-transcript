# Soniox Customer/Agent Simulation

A small Express + EJS app that lets one speaker simulate a customer/agent conversation with live Soniox transcription.

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set `SONIOX_API_KEY`.
3. Start the app:
   `npm run dev`

## Scripts

- `npm run dev` starts the app with file watching.
- `npm start` starts the app once.
- `npm test` runs the unit and integration tests.

## Notes

- The browser requests a temporary Soniox key from the backend before each turn.
- The backend creates that key through Soniox's official temporary API key REST endpoint.
- Completed transcripts are saved as JSON files under `data/sessions/`.
- The frontend loads the Soniox web package directly from the official npm CDN ESM build.
