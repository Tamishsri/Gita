# Sakha · सखा — the Gita, as a friend

> *"I tell you this because you are my friend."* — Bhagavad Gita 4.3

Sakha is a quiet place to bring what you feel to the Bhagavad Gita and hear what it says — in plain words, with one small step and a blessing. Tell it anything, in English, Hindi or Hinglish. It answers with the verse that speaks to your situation, explains it simply, and remembers you — privately, on your own device.

## What it does

- **Listens in your own words.** 23 feelings (from worry and grief to desire, emptiness and joy) across 17 life situations (studies, work, family, marriage, health, loss, money, faith…). Each pairing has hand-written counsel grounded in real verses.
- **Reads between the lines.** Before answering, Sakha reads each message the way a friend would: what follows "but" matters most; *"a bit nervous"* is not *"SO scared!!"*; *"I used to be anxious, but I'm better now"* is relief; *"my mom is depressed"* is answered for the one who cares for her; *"I just want to vent"* gets listening, not advice; *"how do I…"* leads with the step and *"why do I…"* with where the feeling comes from; *"a verse about patience"* gets one. Typos (*"lonley"*, *"anxous"*) and emoji are understood, and real words are never "corrected". When it can't tell what you mean, it asks — with the likely answers one tap away.
- **Remembers the conversation.** It notices when things are easing, growing heavier or still there, and never gives the same counsel twice in one conversation.
- **Answers you by name.** Sakha asks what to call you, remembers what you've shared before (as labels, never your words), and follows up: *"Last time, you told me about your studies. How is it now?"*
- **Private by design.** Conversations are understood **in the browser itself** — your words are never sent to any server. Everything you keep lives on your device and can be released at any time.
- **Safe first.** Crisis language and situations of abuse are met with helplines (Tele-MANAS 14416, 112, 181…) before scripture.
- **Daily practices.** Three breaths, japa, dhyāna, morning saṅkalpa, evening sandhyā, learning a verse by heart, and a seven-day walk with one verse.
- **Letters for later.** Write to the person you will be; Sakha keeps the letter sealed until the day you choose.
- **The whole Gita.** 701 verses across 18 chapters, readable in ten scripts (Devanagari, IAST, Bengali, Gujarati, Gurmukhi, Odia, Telugu, Kannada, Malayalam, Tamil), with English and Hindi meanings.
- **Made to be kept.** Installable as an app, works offline, dawn and night-lamp themes, wisdom cards to share.

## Run it locally

Requires Node.js 18+.

```bash
# 1. The verses API (port 5000)
cd Backend
npm install
npm start

# 2. The app (port 5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Checks

```bash
cd Backend && npm test          # 90 tests: safety, a graded understanding set, counsel integrity, API
cd frontend && npm run lint     # ESLint
cd frontend && npm run check:i18n   # every interface key exists in English and Hindi
cd frontend && npm run build    # production build with the offline service worker
```

## How it's built

| Part | What it is |
| --- | --- |
| `shared/wisdom-engine.js` | The listening engine: crisis and safety detection, `understand()` (the reading of a message), feelings, situations, care, counsel, verse ranking, blessings. One file, used by the API, the app and the offline service worker. |
| `frontend/` | React + Vite app. `src/lib/localSakha.js` runs the engine on the device; `src/lib/person.js` keeps the private memory. |
| `Backend/` | Express API that serves the verses (`/api/verses`, `/api/daily`, `/api/search`). |
| `Dataset/` | The Gita: Sanskrit, transliteration, English and Hindi meanings, themes and life situations for all 701 verses. |

The app's name lives in one place: `frontend/src/lib/brand.js`. The mark — a peacock feather's eye that is also a flame — is drawn from `frontend/src/lib/sakhaMark.js`; `node frontend/scripts/generate-icons.mjs` regenerates every app icon from it.

---

*Sakha offers perspective, not treatment. If you are in danger, please reach a helpline — in India, Tele-MANAS: 14416; anywhere: [findahelpline.com](https://findahelpline.com).*
