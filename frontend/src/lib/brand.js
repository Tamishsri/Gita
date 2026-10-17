// The app's name lives here, and only here.
//
// Sakha (सखा) — "friend". Krishna shares the Gita's secret with Arjuna
// because "you are my devotee and my friend" — bhakto 'si me sakhā ceti (4.3).
// The whole Gita is a friend answering a friend in his hardest hour, and it
// begins with a smile (2.10). That is what this app hopes to be.

export const BRAND = Object.freeze({
    name: { en: 'Sakha', hi: 'सखा' },
    sanskrit: 'सखा',
    iast: 'sakhā',
    tagline: { en: 'the Gita, as a friend', hi: 'गीता, एक मित्र की तरह' },
    // For file names and anything that must stay ASCII.
    slug: 'Sakha'
});

export const appName = (lang = 'en') => BRAND.name[lang] || BRAND.name.en;
export const appTagline = (lang = 'en') => BRAND.tagline[lang] || BRAND.tagline.en;
