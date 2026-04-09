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

## Soniox vs Competitors — Manager Reference

Live interactive comparison: **https://soniox.com/compare**

### Feature highlights (Soniox advantages)
| Feature | Notes |
|---|---|
| Single Multilingual Model | One model handles all languages — no language switching needed |
| Language Hints | Pass a hint to improve accuracy for a known language |
| Language Identification | Auto-detects spoken language |
| Speaker Diarization | Distinguishes who is speaking |
| Customization | Custom vocabulary / domain adaptation |
| Timestamps | Word-level timestamps included |
| Confidence Scores | Per-word confidence returned |
| Translation (One-way) | Transcribe + translate in one pass |
| Translation (Two-way) | Bidirectional translation |
| Endpoint Detection | Detects end of speech automatically |
| Manual Finalization | Force-finalize a transcript mid-stream |
| Sovereign Cloud | On-prem / private cloud deployment option |

### Head-to-head pages
- [Soniox vs OpenAI](https://soniox.com/compare/soniox-vs-openai)
- [Soniox vs Google](https://soniox.com/compare/soniox-vs-google)
- [Soniox vs Azure](https://soniox.com/compare/soniox-vs-azure)
- [Soniox vs Deepgram](https://soniox.com/compare/soniox-vs-deepgram)
- [Soniox vs Speechmatics](https://soniox.com/compare/soniox-vs-speechmatics)
- [Soniox vs AssemblyAI](https://soniox.com/compare/soniox-vs-assemblyai)

> The comparison runs real API calls to every provider in real time — not a static demo.
> Open-source framework: https://github.com/soniox/soniox-compare
