# Sakha · सखा — the Gita, as a friend

> *"I tell you this because you are my friend."* — Bhagavad Gita 4.3

Sakha is a quiet place to bring what you feel to the Bhagavad Gita and hear what it says — in plain words, with one small step and a blessing. Tell it anything, in English, Hindi or Hinglish. It answers with the verse that speaks to your situation, explains it simply, and remembers you — privately, on your own device.

## What it does

- **Listens in your own words.** 23 feelings (from worry and grief to desire, emptiness and joy) across 17 life situations (studies, work, family, marriage, health, loss, money, faith…). Each pairing has hand-written counsel grounded in real verses.
- **Reads between the lines.** Before answering, Sakha reads each message the way a friend would: what follows "but" matters most; *"a bit nervous"* is not *"SO scared!!"*; *"I used to be anxious, but I'm better now"* is relief; *"my mom is depressed"* is answered for the one who cares for her; *"I just want to vent"* gets listening, not advice; *"how do I…"* leads with the step and *"why do I…"* with where the feeling comes from; *"a verse about patience"* gets one. Typos (*"lonley"*, *"anxous"*) and emoji are understood, and real words are never "corrected". When it can't tell what you mean, it asks — with the likely answers one tap away.
- **Talks like a friend.** Replies are short and human, not a pamphlet: a friend's first words, a verse when it helps, and a real question back (*"How long were you two together?"*) — never the same one twice, never one you already answered. Right after a verse, *"it hurts"* is met as itself, with the next verse one tap away. *"bro my life is a mess lol"* is heard as overwhelm said to a friend (not a brother), and your name opens a reply now and then, not every time.
- **Explains the Gita's own words.** Tap (or hover) *yoga*, *dharma*, *karma*, *Pārtha*, *the modes of nature* and about forty more, in English or Hindi, wherever they appear — a sentence or two, right above the word.
- **Remembers the conversation.** It notices when things are easing, growing heavier or still there, and never gives the same counsel twice in one conversation.
- **Becomes yours.** Sakha learns, on your device, which of the Gita's four paths helps you — action, understanding, devotion or stillness — from what you choose and from "This helped" / "Not quite". Choose any of the paths that sound like you, or leave it on Auto and let it learn; a pink lotus opens as it does. It speaks the way you asked (gently, plainly, or explaining more), and remembers what you told it about your life ("I'm preparing for exams", "I look after my mother"), so "I'm so tired" is answered as part of that life. "Not quite" answers again: gentler, more practical, deeper, or asks what it is really about.
- **Learns you, the way a friend does.** When Sakha can't tell what you mean ("meh") and you clarify, it learns your word for that feeling — next time, "meh" is understood, and it says so. It notices when you tend to come and how those times feel ("Evenings have been heavy lately"), remembers an exam or interview you mentioned and asks afterwards how it went, and shows all of it as a plain portrait you can read and erase.
- **A verse chosen for you, every day.** Once Sakha knows you a little, the verse of the day is yours — chosen on your device from what has been on your heart this week, with a line saying why ("Because worry has been visiting you this week"). It is the same all day and different most days.
- **Recited by a human voice.** "Listen" sounds a soft bowl, then the śloka and its meaning in a warm devotional narrator's voice (ElevenLabs, "Viraj"). Only verse ids are ever sent — never anything you write — and each recitation is generated once, kept at the edge and on your device. Without a key, the device's most natural voice recites instead, with a reader's pauses.
- **Sound that is modelled, not looped.** Ocean waves that gather, break into foam and draw back; rain on leaves with a drip now and then; a forest stream over stones; singing bowls (with a real bowl's inharmonic overtones) in a quiet room — all through one room reverb and a gentle compressor, made live on the device.
- **Never says the same thing twice in a conversation.** Openings, steps and situations are remembered within each conversation; a carer who writes again is met as themselves, someone venting keeps being listened to, and a replaced step suits the feeling — gentle for grief, practical for pressure.
- **Answers you by name.** Sakha asks what to call you, remembers what you've shared before (as labels, never your words), and follows up: *"Last time, you told me about your studies. How is it now?"*
- **Private by design.** Conversations are understood **in the browser itself** — your words are never sent to any server. Everything you keep lives on your device and can be released at any time.
- **Private and safe by design.** An optional passcode lock (only a salted hash is kept), private conversations that leave nothing behind, a "What Sakha knows about you" page to see, change, download or erase everything, and a Quick exit for anyone who may be watched.
- **Safe first.** Crisis language and situations of abuse are met with helplines (Tele-MANAS 14416, 112, 181…) before scripture.
- **Daily practices.** Three breaths, japa, dhyāna, morning saṅkalpa, evening sandhyā, learning a verse by heart, and a seven-day walk with one verse.
- **Letters for later.** Write to the person you will be; Sakha keeps the letter sealed until the day you choose.
- **The whole Gita.** 701 verses across 18 chapters, readable in ten scripts (Devanagari, IAST, Bengali, Gujarati, Gurmukhi, Odia, Telugu, Kannada, Malayalam, Tamil), with English and Hindi meanings.
- **Made to be kept.** Installable as an app, works offline, dawn and night-lamp themes, wisdom cards to share. Fits every screen — from a 320px phone and landscape phones to tablets and wide desktops — with touch-sized controls and no zooming on input.

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

### The recitation voice (optional)

Verses are recited by ElevenLabs when the backend has a key. Put it in `Backend/.env` locally, and in the Vercel project's environment variables (backend service) for the live app:

```bash
ELEVENLABS_API_KEY=your-key
# optional: ELEVENLABS_VOICE_ID (default uuyFQegRan8rpIQCGu9K, "Viraj"), ELEVENLABS_MODEL (default eleven_multilingual_v2)
```

Without it, everything still works and the device's own voice recites.

## Checks

```bash
cd Backend && npm test          # 113 tests: safety, graded understanding, personalisation, conversations, recitation API
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
