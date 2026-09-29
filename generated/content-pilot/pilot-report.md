# Phase 8A Pilot Report

STATUS: **PHASE_8A_PILOT_100_READY_FOR_REVIEW**

- catalog: 2026.1-pilot
- generator: prod-v1
- checksum: `456c3b87cf32c3a617f37d8cd1f5ccf518c51df85095ec026ed001971b072bc9`
- pool: 351
- selected: 100
- rejected: 128

## Tier quota

| Tier | Target | Actual |
| --- | ---: | ---: |
| BEGINNER | 10 | 10 |
| EASY | 25 | 25 |
| MEDIUM | 30 | 30 |
| HARD | 25 | 25 |
| EXPERT | 10 | 10 |

## Reject reasons

- empty_or_full: 1
- exact_duplicate: 17
- not_unique: 86
- performance: 5
- stalled: 8
- transform_duplicate: 11

## Collections

- animals: 6
- birds: 5
- drinks: 6
- food: 6
- home: 6
- nature: 13
- objects: 3
- patterns: 22
- plants: 8
- sea: 5
- space: 5
- symbols: 11
- transport: 4

Pattern share: 22.0%

## Logic

{"productionReady":100,"unique":100,"logical":100,"hintChain":100}

## Top near-duplicates

- patterns-expert-lattice-cal-10 (Плетение) ↔ patterns-expert-mut-4 (Плетение) 10x10 sim=0.9800
- patterns-expert-lattice-cal-10 (Плетение) ↔ patterns-expert-mut-5 (Плетение) 10x10 sim=0.9800
- patterns-expert-lattice-cal-10 (Плетение) ↔ patterns-expert-mut-6 (Плетение) 10x10 sim=0.9800
- patterns-expert-mut-0 (Мозаика) ↔ patterns-expert-scatter-cal-10 (Мозаика) 10x10 sim=0.9800
- patterns-expert-mut-1 (Мозаика) ↔ patterns-expert-scatter-cal-10 (Мозаика) 10x10 sim=0.9800
- patterns-expert-mut-2 (Мозаика) ↔ patterns-expert-scatter-cal-10 (Мозаика) 10x10 sim=0.9800
- patterns-expert-mut-3 (Мозаика) ↔ patterns-expert-scatter-cal-10 (Мозаика) 10x10 sim=0.9800
- patterns-expert-mut-0 (Мозаика) ↔ patterns-expert-mut-1 (Мозаика) 10x10 sim=0.9600
- patterns-expert-mut-0 (Мозаика) ↔ patterns-expert-mut-2 (Мозаика) 10x10 sim=0.9600
- patterns-expert-mut-0 (Мозаика) ↔ patterns-expert-mut-3 (Мозаика) 10x10 sim=0.9600
- patterns-expert-mut-1 (Мозаика) ↔ patterns-expert-mut-2 (Мозаика) 10x10 sim=0.9600
- patterns-expert-mut-1 (Мозаика) ↔ patterns-expert-mut-3 (Мозаика) 10x10 sim=0.9600
- patterns-expert-mut-2 (Мозаика) ↔ patterns-expert-mut-3 (Мозаика) 10x10 sim=0.9600
- patterns-expert-mut-4 (Плетение) ↔ patterns-expert-mut-5 (Плетение) 10x10 sim=0.9600
- patterns-expert-mut-4 (Плетение) ↔ patterns-expert-mut-6 (Плетение) 10x10 sim=0.9600
- patterns-expert-mut-5 (Плетение) ↔ patterns-expert-mut-6 (Плетение) 10x10 sim=0.9600
- food-apple-proc-10 (Яблоко) ↔ plants-flower-proc-10-p4 (Цветок) 10x10 sim=0.9500
- home-building-proc-10x10-0 (Дом) ↔ home-building-proc-10x10-1 (Домик) 10x10 sim=0.9500
- birds-duck-10 (Утка) ↔ plants-flower-proc-10-p4 (Цветок) 10x10 sim=0.9300
- plants-flower-proc-10-p4 (Цветок) ↔ plants-flower-proc-10-p6 (Ромашка) 10x10 sim=0.9200

## Representatives

Playlist: birds-bird-proc-15, patterns-maze-20-g2, symbols-bar-5x3, drinks-cup-proc-15-h0, food-cake-10, nature-cloud-10, sea-boat-proc-15x15-2, symbols-compass-15, transport-plane-10, nature-bridge-15x9, nature-moon-5, space-rocket-5, patterns-expert-mut-6, patterns-expert-scatter-cal-10, symbols-star-proc-15
Edge: {"hardest":"patterns-expert-mut-6","easiest":"symbols-bar-5x3","largest":"animals-cat-proc-20-e4","slowestSolver":"patterns-frame-proc-20-g3","slowestHint":"patterns-frame-proc-20-g3","mostComponents":"patterns-check-proc-15-p2","rep20":"animals-cat-proc-20-e4","rep25":null}

## Artifacts

- manifest: `D:\PetProject\NonogramGameRuStore\generated\content-pilot\manifest.json`
- contact sheet: `D:\PetProject\NonogramGameRuStore\review-artifacts\production-content\pilot\contact-sheet.html`
- manifest bytes: 65359 (×10 est 653590)

## Achievement risk

Achievements are derived from GALLERY_ITEMS. Replacing gallery taxonomy can remove first_collection if previously completed small collections disappear. REQUIRES DESIGN FIX BEFORE RUNTIME INTEGRATION.

## STOP

READY FOR HUMAN PILOT CONTACT-SHEET REVIEW

Do not scale to 1000 without explicit approval.
