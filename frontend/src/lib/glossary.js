// The Gita's own words, explained where they appear: tap (or hover) "yoga",
// "dharma", "Partha" and a short meaning opens. Most people meet these words
// without anyone to ask; this is the friend who leans over and tells them.
//
// Each entry: the words it matches (English spelling and Devanagari), and a
// meaning in each language. Kept short — a sentence or two, never a lecture.

const ENTRIES = [
    {
        id: 'yoga',
        en: ['yoga', 'yogi', 'yogis', 'yogī'],
        hi: ['योग', 'योगी'],
        term: { en: 'Yoga', hi: 'योग' },
        meaning: {
            en: 'Not exercise. In the Gita, yoga means union — and steadiness: acting well while staying the same in success and failure (2.48). A yogi is someone who lives this way.',
            hi: 'व्यायाम नहीं। गीता में योग का अर्थ है जुड़ना — और स्थिरता: सफलता और असफलता में एक-सा रहते हुए अच्छा कर्म करना (2.48)। योगी वह है जो ऐसे जीता है।'
        }
    },
    {
        id: 'karma',
        en: ['karma', 'karmic', 'karma-yoga', 'karma yoga'],
        hi: ['कर्म', 'कर्मयोग'],
        term: { en: 'Karma', hi: 'कर्म' },
        meaning: {
            en: 'Action — and what follows from it. The Gita’s advice: give the action everything, and let go of the result (2.47).',
            hi: 'कर्म — और उससे जो होता है। गीता की सीख: कर्म में पूरा मन लगाइए, और फल को छोड़ दीजिए (2.47)।'
        }
    },
    {
        id: 'dharma',
        en: ['dharma', 'dharmic'],
        hi: ['धर्म'],
        term: { en: 'Dharma', hi: 'धर्म' },
        meaning: {
            en: 'What is right for you to do — your duty, given who you are and where you stand. Not “religion” in the narrow sense.',
            hi: 'जो आपके लिए करना उचित है — आप जो हैं और जहाँ खड़े हैं, उसके अनुसार आपका कर्तव्य। केवल “मज़हब” के संकीर्ण अर्थ में नहीं।'
        }
    },
    {
        id: 'svadharma',
        en: ['svadharma', 'swadharma', 'sva-dharma'],
        hi: ['स्वधर्म'],
        term: { en: 'Svadharma', hi: 'स्वधर्म' },
        meaning: {
            en: 'Your own dharma — the path that fits your nature. “Better your own path, imperfectly, than another’s perfectly” (3.35).',
            hi: 'आपका अपना धर्म — वह मार्ग जो आपके स्वभाव से मेल खाए। “दूसरे का धर्म अच्छी तरह निभाने से अपना धर्म अधूरा निभाना बेहतर है” (3.35)।'
        }
    },
    {
        id: 'bhakti',
        en: ['bhakti', 'devotional service'],
        hi: ['भक्ति'],
        term: { en: 'Bhakti', hi: 'भक्ति' },
        meaning: {
            en: 'Devotion: turning toward the Divine with love and trust. One of the Gita’s paths — the one it calls dearest (12.20).',
            hi: 'भक्ति: प्रेम और विश्वास से ईश्वर की ओर मुड़ना। गीता के मार्गों में से एक — जिसे वह सबसे प्रिय कहती है (12.20)।'
        }
    },
    {
        id: 'jnana',
        en: ['jnana', 'jñāna', 'gyan', 'gyana'],
        hi: ['ज्ञान'],
        term: { en: 'Jñāna', hi: 'ज्ञान' },
        meaning: {
            en: 'Knowledge — not facts, but seeing clearly what lasts and what passes. The path of understanding.',
            hi: 'ज्ञान — जानकारी नहीं, बल्कि साफ़ देखना कि क्या टिकता है और क्या बीत जाता है। समझ का मार्ग।'
        }
    },
    {
        id: 'dhyana',
        en: ['dhyana', 'dhyāna'],
        hi: ['ध्यान'],
        term: { en: 'Dhyāna', hi: 'ध्यान' },
        meaning: {
            en: 'Meditation: resting the mind on one thing until it grows quiet. Chapter 6 is the Gita’s guide to it.',
            hi: 'ध्यान: मन को एक बात पर टिकाना, जब तक वह शांत न हो जाए। अध्याय 6 इसकी गीता की मार्गदर्शिका है।'
        }
    },
    {
        id: 'atman',
        en: ['atman', 'ātman', 'atma', 'ātmā'],
        hi: ['आत्मा', 'आत्म'],
        term: { en: 'Ātman', hi: 'आत्मा' },
        meaning: {
            en: 'The Self — the part of you that was never born and never dies, untouched by what happens to the body (2.20).',
            hi: 'आत्मा — आपका वह अंश जो न कभी जन्मा, न कभी मरता है; शरीर के साथ जो होता है, उससे अछूता (2.20)।'
        }
    },
    {
        id: 'brahman',
        en: ['brahman'],
        hi: ['ब्रह्म'],
        term: { en: 'Brahman', hi: 'ब्रह्म' },
        meaning: {
            en: 'The infinite reality underneath everything — what all things are, at their root.',
            hi: 'वह अनंत सत्य जो हर चीज़ के नीचे है — सब कुछ अपनी जड़ में जो है।'
        }
    },
    {
        id: 'moksha',
        en: ['moksha', 'mokṣa', 'mukti', 'liberation'],
        hi: ['मोक्ष', 'मुक्ति'],
        term: { en: 'Moksha', hi: 'मोक्ष' },
        meaning: {
            en: 'Liberation — freedom from the cycle of suffering, birth and death. The Gita’s final promise (18.66).',
            hi: 'मुक्ति — दुख, जन्म और मृत्यु के चक्र से स्वतंत्रता। गीता का अंतिम वचन (18.66)।'
        }
    },
    {
        id: 'gunas',
        en: ['guna', 'gunas', 'guṇa', 'guṇas', 'modes of material nature', 'modes of nature', 'three modes'],
        hi: ['गुण', 'त्रिगुण'],
        term: { en: 'The three guṇas', hi: 'तीन गुण' },
        meaning: {
            en: 'The three qualities everything is woven from: sattva (clarity, goodness), rajas (restless drive, passion) and tamas (heaviness, ignorance). Chapter 14.',
            hi: 'वे तीन गुण जिनसे सब कुछ बुना है: सत्त्व (स्पष्टता, अच्छाई), रजस् (बेचैन चाह) और तमस् (भारीपन, अज्ञान)। अध्याय 14।'
        }
    },
    {
        id: 'sattva',
        en: ['sattva', 'sattvic', 'sāttvika', 'mode of goodness'],
        hi: ['सत्त्व', 'सत्व', 'सात्त्विक', 'सात्विक'],
        term: { en: 'Sattva', hi: 'सत्त्व' },
        meaning: {
            en: 'Goodness and clarity — the quality that brings light, calm and understanding.',
            hi: 'अच्छाई और स्पष्टता — वह गुण जो प्रकाश, शांति और समझ लाता है।'
        }
    },
    {
        id: 'rajas',
        en: ['rajas', 'rajasic', 'rājasika', 'mode of passion'],
        hi: ['रजस्', 'रजोगुण', 'राजसिक'],
        term: { en: 'Rajas', hi: 'रजस्' },
        meaning: {
            en: 'Passion and restlessness — the drive that wants, chases and never quite settles.',
            hi: 'आवेग और बेचैनी — वह खिंचाव जो चाहता है, दौड़ता है, और कभी पूरी तरह ठहरता नहीं।'
        }
    },
    {
        id: 'tamas',
        en: ['tamas', 'tamasic', 'tāmasika', 'mode of ignorance'],
        hi: ['तमस्', 'तमोगुण', 'तामसिक'],
        term: { en: 'Tamas', hi: 'तमस्' },
        meaning: {
            en: 'Heaviness and inertia — the quality behind dullness, delay and confusion.',
            hi: 'भारीपन और जड़ता — आलस्य, टालमटोल और भ्रम के पीछे का गुण।'
        }
    },
    {
        id: 'maya',
        en: ['maya', 'māyā'],
        hi: ['माया'],
        term: { en: 'Māyā', hi: 'माया' },
        meaning: {
            en: 'The power that makes the passing look permanent — the veil over what is truly real (7.14).',
            hi: 'वह शक्ति जो बीतने वाले को स्थायी दिखाती है — सच्चे सत्य पर पड़ा परदा (7.14)।'
        }
    },
    {
        id: 'samsara',
        en: ['samsara', 'saṁsāra', 'transmigration'],
        hi: ['संसार-चक्र'],
        term: { en: 'Saṁsāra', hi: 'संसार-चक्र' },
        meaning: {
            en: 'The wheel of birth, death and rebirth that the Gita describes the soul passing through (2.22).',
            hi: 'जन्म, मृत्यु और पुनर्जन्म का चक्र, जिससे गीता के अनुसार आत्मा गुज़रती है (2.22)।'
        }
    },
    {
        id: 'prakriti',
        en: ['prakriti', 'prakṛti', 'material nature'],
        hi: ['प्रकृति'],
        term: { en: 'Prakṛti', hi: 'प्रकृति' },
        meaning: {
            en: 'Nature — everything that changes: the world, the body, even the mind. Contrasted with the Self that watches it.',
            hi: 'प्रकृति — जो कुछ बदलता है: संसार, शरीर, यहाँ तक कि मन भी। उसे देखने वाली आत्मा से अलग।'
        }
    },
    {
        id: 'yajna',
        en: ['yajna', 'yajña', 'yagya', 'yagna'],
        hi: ['यज्ञ'],
        term: { en: 'Yajña', hi: 'यज्ञ' },
        meaning: {
            en: 'Sacrifice, offering. In the Gita, any work done as an offering rather than for yourself alone (3.9).',
            hi: 'यज्ञ, अर्पण। गीता में, कोई भी काम जो केवल अपने लिए नहीं, अर्पण की तरह किया जाए (3.9)।'
        }
    },
    {
        id: 'sannyasa',
        en: ['sannyasa', 'sannyāsa', 'sanyas', 'sannyasi', 'renunciation', 'renouncer', 'renounced order'],
        hi: ['संन्यास', 'सन्यास', 'संन्यासी'],
        term: { en: 'Sannyāsa', hi: 'संन्यास' },
        meaning: {
            en: 'Renunciation. The Gita’s twist: not giving up action, but giving up clinging to its rewards (18.2).',
            hi: 'त्याग। गीता की बात: कर्म छोड़ना नहीं, उसके फलों से चिपकना छोड़ना (18.2)।'
        }
    },
    {
        id: 'samadhi',
        en: ['samadhi', 'samādhi', 'trance'],
        hi: ['समाधि'],
        term: { en: 'Samādhi', hi: 'समाधि' },
        meaning: {
            en: 'Complete absorption — the mind so settled in meditation that it rests in itself.',
            hi: 'पूर्ण तल्लीनता — ध्यान में मन इतना स्थिर कि वह अपने भीतर विश्राम करे।'
        }
    },
    {
        id: 'prana',
        en: ['prana', 'prāṇa', 'pranayama', 'prāṇāyāma'],
        hi: ['प्राण', 'प्राणायाम'],
        term: { en: 'Prāṇa', hi: 'प्राण' },
        meaning: {
            en: 'Breath, and the life-force it carries. Prāṇāyāma is the practice of steadying it (4.29).',
            hi: 'साँस, और उसमें बहती जीवन-शक्ति। प्राणायाम उसे स्थिर करने का अभ्यास है (4.29)।'
        }
    },
    {
        id: 'japa',
        en: ['japa'],
        hi: ['जप'],
        term: { en: 'Japa', hi: 'जप' },
        meaning: {
            en: 'Repeating a sacred name or mantra, softly, to steady the mind. The Gita calls it the best of offerings (10.25).',
            hi: 'किसी पवित्र नाम या मंत्र को धीरे-धीरे दोहराना, मन को स्थिर करने के लिए। गीता इसे यज्ञों में श्रेष्ठ कहती है (10.25)।'
        }
    },
    {
        id: 'ahamkara',
        en: ['false ego', 'ahankara', 'ahaṅkāra', 'ahamkara'],
        hi: ['अहंकार'],
        term: { en: 'Ahaṅkāra', hi: 'अहंकार' },
        meaning: {
            en: '“False ego” — the sense that “I alone am the doer”. The Gita says it is the root of much suffering (3.27).',
            hi: '“मैं ही करने वाला हूँ” — यह भाव। गीता के अनुसार बहुत से दुखों की जड़ (3.27)।'
        }
    },
    {
        id: 'sthitaprajna',
        en: ['sthitaprajna', 'sthita-prajña', 'steady wisdom', 'steady mind'],
        hi: ['स्थितप्रज्ञ'],
        term: { en: 'Sthita-prajña', hi: 'स्थितप्रज्ञ' },
        meaning: {
            en: 'One of steady wisdom — unshaken by pleasure or pain. Krishna describes them in 2.54–72.',
            hi: 'स्थिर बुद्धि वाला — सुख-दुख से अडिग। कृष्ण 2.54–72 में उनका वर्णन करते हैं।'
        }
    },
    {
        id: 'avatar',
        en: ['avatar', 'avatāra', 'avatara'],
        hi: ['अवतार'],
        term: { en: 'Avatāra', hi: 'अवतार' },
        meaning: {
            en: 'The Divine taking form in the world, “whenever goodness declines” (4.7–8).',
            hi: 'ईश्वर का संसार में रूप लेना, “जब-जब धर्म की हानि होती है” (4.7–8)।'
        }
    },
    {
        id: 'om',
        en: ['oṁ', 'Om', 'OM', 'Aum'],
        hi: ['ॐ', 'ओम्', 'ओम'],
        caseSensitive: true,
        term: { en: 'Oṁ', hi: 'ॐ' },
        meaning: {
            en: 'The sacred syllable — the Divine as sound. The Gita calls it the one-syllabled Brahman (8.13).',
            hi: 'पवित्र अक्षर — ध्वनि के रूप में ईश्वर। गीता इसे एकाक्षर ब्रह्म कहती है (8.13)।'
        }
    },
    {
        id: 'sloka',
        en: ['sloka', 'śloka', 'shloka', 'shlok', 'slokas', 'shlokas'],
        hi: [],
        term: { en: 'Śloka', hi: 'श्लोक' },
        meaning: {
            en: 'A verse of two lines in the Gita’s metre — 700 of them, meant to be recited aloud.',
            hi: 'दो पंक्तियों का छंद, गीता की लय में — ऐसे 700 श्लोक, जो बोलकर पढ़ने के लिए हैं।'
        }
    },
    {
        id: 'sankalpa',
        en: ['sankalpa', 'saṅkalpa'],
        hi: ['संकल्प'],
        term: { en: 'Saṅkalpa', hi: 'संकल्प' },
        meaning: {
            en: 'An intention, resolved in the heart — something you choose to carry through the day.',
            hi: 'मन में लिया गया निश्चय — कुछ जिसे आप दिन भर साथ रखना चुनते हैं।'
        }
    },
    {
        id: 'transcendental',
        en: ['transcendental', 'transcendence'],
        hi: [],
        term: { en: 'Transcendental', hi: 'दिव्य' },
        meaning: {
            en: 'Beyond the material world and its changes — untouched by the ups and downs of nature.',
            hi: 'भौतिक संसार और उसके बदलावों से परे।'
        }
    },
    {
        id: 'demigods',
        en: ['demigod', 'demigods', 'devas'],
        hi: ['देवता', 'देवताओं'],
        term: { en: 'Devas', hi: 'देवता' },
        meaning: {
            en: '“Demigods” — celestial powers of nature. In the Gita they serve the Supreme, and are not the final goal (7.20–23).',
            hi: 'प्रकृति की दिव्य शक्तियाँ। गीता में वे परमेश्वर के अधीन हैं, अंतिम लक्ष्य नहीं (7.20–23)।'
        }
    },
    {
        id: 'vedas',
        en: ['vedas', 'vedic', 'veda', 'upanishad', 'upanishads', 'upaniṣad'],
        hi: ['वेद', 'वेदों', 'उपनिषद्', 'उपनिषद'],
        term: { en: 'The Vedas', hi: 'वेद' },
        meaning: {
            en: 'India’s oldest scriptures; the Upanishads are their philosophical heart. The Gita draws their wisdom into one conversation.',
            hi: 'भारत के सबसे प्राचीन ग्रंथ; उपनिषद् उनका दार्शनिक हृदय हैं। गीता उनकी बुद्धि को एक संवाद में समेटती है।'
        }
    },
    // The people, and the names Krishna calls Arjuna by.
    {
        id: 'krishna',
        en: ['krishna', 'kṛṣṇa', 'keshava', 'kesava', 'madhava', 'mādhava', 'govinda', 'vasudeva', 'vāsudeva', 'janardana', 'janārdana', 'hrishikesha', 'hṛṣīkeśa', 'madhusudana', 'madhusūdana', 'achyuta', 'acyuta'],
        hi: ['कृष्ण', 'श्रीकृष्ण', 'केशव', 'माधव', 'गोविंद', 'गोविन्द', 'वासुदेव', 'जनार्दन', 'हृषीकेश', 'मधुसूदन', 'अच्युत'],
        term: { en: 'Krishna', hi: 'कृष्ण' },
        meaning: {
            en: 'Arjuna’s friend and charioteer — and the Divine. His are the words of the Gita. Keshava, Mādhava, Govinda and others are his names.',
            hi: 'अर्जुन के मित्र और सारथी — और स्वयं ईश्वर। गीता के वचन उन्हीं के हैं। केशव, माधव, गोविंद — ये भी उन्हीं के नाम हैं।'
        }
    },
    {
        id: 'arjuna',
        en: ['arjuna', 'partha', 'pārtha', 'kaunteya', 'dhananjaya', 'dhanañjaya', 'gudakesha', 'guḍākeśa', 'son of kunti', 'son of pritha', 'scion of bharata', 'descendant of bharata', 'best of the bharatas', 'chastiser of the enemy', 'mighty-armed'],
        hi: ['अर्जुन', 'पार्थ', 'कौन्तेय', 'कौंतेय', 'धनंजय', 'गुडाकेश'],
        term: { en: 'Arjuna', hi: 'अर्जुन' },
        meaning: {
            en: 'The warrior prince who breaks down before battle, and to whom Krishna speaks the Gita. Pārtha, Kaunteya, “son of Kunti”, “mighty-armed” — all names for him.',
            hi: 'वह योद्धा राजकुमार जो युद्ध से पहले टूट जाते हैं, और जिनसे कृष्ण गीता कहते हैं। पार्थ, कौन्तेय, धनंजय — सब उन्हीं के नाम।'
        }
    },
    {
        id: 'kurukshetra',
        en: ['kurukshetra', 'kurukṣetra'],
        hi: ['कुरुक्षेत्र'],
        term: { en: 'Kurukshetra', hi: 'कुरुक्षेत्र' },
        meaning: {
            en: 'The battlefield where the Gita is spoken — and, many say, the battlefield inside every heart.',
            hi: 'वह रणभूमि जहाँ गीता कही गई — और, कई कहते हैं, हर हृदय के भीतर की रणभूमि।'
        }
    },
    {
        id: 'sanjaya',
        en: ['sanjaya', 'sañjaya'],
        hi: ['संजय', 'सञ्जय'],
        term: { en: 'Sañjaya', hi: 'संजय' },
        meaning: {
            en: 'The narrator: given divine sight, he describes the battle to the blind king Dhṛtarāṣṭra.',
            hi: 'कथावाचक: दिव्य दृष्टि पाकर वे अंधे राजा धृतराष्ट्र को युद्ध का वर्णन सुनाते हैं।'
        }
    },
    {
        id: 'dhritarashtra',
        en: ['dhritarashtra', 'dhṛtarāṣṭra'],
        hi: ['धृतराष्ट्र'],
        term: { en: 'Dhṛtarāṣṭra', hi: 'धृतराष्ट्र' },
        meaning: {
            en: 'The blind king whose sons, the Kauravas, lead the army opposite Arjuna.',
            hi: 'अंधे राजा, जिनके पुत्र — कौरव — अर्जुन के विरुद्ध सेना का नेतृत्व करते हैं।'
        }
    },
    {
        id: 'pandavas',
        en: ['pandava', 'pandavas', 'pāṇḍava', 'pāṇḍavas', 'pandu'],
        hi: ['पाण्डव', 'पांडव', 'पाण्डु', 'पांडु'],
        term: { en: 'The Pāṇḍavas', hi: 'पांडव' },
        meaning: {
            en: 'The five sons of Pāṇḍu — Arjuna and his brothers — on one side of the war.',
            hi: 'पांडु के पाँच पुत्र — अर्जुन और उनके भाई — युद्ध के एक पक्ष में।'
        }
    },
    {
        id: 'kauravas',
        en: ['kaurava', 'kauravas', 'kuru', 'kurus', 'duryodhana'],
        hi: ['कौरव', 'कौरवों', 'दुर्योधन'],
        term: { en: 'The Kauravas', hi: 'कौरव' },
        meaning: {
            en: 'Dhṛtarāṣṭra’s sons, led by Duryodhana — Arjuna’s own cousins, on the other side of the war.',
            hi: 'धृतराष्ट्र के पुत्र, दुर्योधन के नेतृत्व में — अर्जुन के अपने चचेरे भाई, युद्ध के दूसरे पक्ष में।'
        }
    }
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LETTER = '[\\p{L}\\p{M}]';

// One pattern per language, longest words first ("karma yoga" before "karma").
function patternFor(language) {
    const words = [];
    ENTRIES.forEach((entry) => {
        (entry[language] || []).forEach((word) => words.push({ word, entry }));
    });
    words.sort((a, b) => b.word.length - a.word.length);
    const sensitive = words.filter(({ entry }) => entry.caseSensitive).map(({ word }) => escape(word));
    const insensitive = words.filter(({ entry }) => !entry.caseSensitive).map(({ word }) => escape(word));
    const suffix = language === 'hi' ? '(?:ों|ो|ें)?' : "(?:['’]s|s)?";
    const build = (list, flags) => (list.length ? new RegExp(`(?<!${LETTER})(${list.join('|')})${suffix}(?!${LETTER})`, flags) : null);
    const lookup = new Map(words.map(({ word, entry }) => [entry.caseSensitive ? word : word.toLowerCase(), entry]));
    return { insensitive: build(insensitive, 'giu'), sensitive: build(sensitive, 'gu'), lookup };
}

const PATTERNS = { en: patternFor('en'), hi: patternFor('hi') };

/**
 * For paragraphs shown together: which words each one should leave alone,
 * because an earlier paragraph already explains them.
 * @returns {string[][]}
 */
export function glossSkips(paragraphs, language = 'en') {
    const seen = new Set();
    return paragraphs.map((paragraph) => {
        const skip = [...seen];
        findTerms(paragraph, language, skip).forEach((term) => seen.add(term.entry.id));
        return skip;
    });
}

/**
 * Find the glossary words in a text: the first time each entry appears.
 * @returns {{ start: number, end: number, text: string, entry: object }[]}
 */
export function findTerms(text, language = 'en', skip = []) {
    if (!text || typeof text !== 'string') return [];
    const found = [];
    const seen = new Set(skip);
    // A Hindi reply can carry English words, and an English one Sanskrit names.
    [PATTERNS[language === 'hi' ? 'hi' : 'en'], PATTERNS[language === 'hi' ? 'en' : 'hi']].forEach(({ insensitive, sensitive, lookup }) => {
        [insensitive, sensitive].filter(Boolean).forEach((pattern) => {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text))) {
                const word = match[1];
                const entry = lookup.get(word) || lookup.get(word.toLowerCase());
                if (!entry || seen.has(entry.id)) continue;
                const start = match.index;
                const end = start + match[0].length;
                if (found.some((item) => start < item.end && end > item.start)) continue;
                seen.add(entry.id);
                found.push({ start, end, text: match[0], entry });
            }
        });
    });
    return found.sort((a, b) => a.start - b.start);
}

export const glossaryEntries = () => ENTRIES;
