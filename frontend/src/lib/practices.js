import { BreathGlyph, FlameGlyph, LeafGlyph, MalaGlyph, PathGlyph, SandhyaGlyph } from '../components/ui/Ornaments';
import { partOfDay, readDay } from './day';

// The practices, each grounded in the verse that teaches it. Titles and
// descriptions live in the i18n dictionaries under practice.<id>.*
export const PRACTICES = [
    { id: 'breaths', glyph: BreathGlyph, ref: '4.29', minutes: 1 },
    { id: 'japa', glyph: MalaGlyph, ref: '10.25', minutes: 8 },
    { id: 'dhyana', glyph: FlameGlyph, ref: '6.19', minutes: 5 },
    { id: 'sankalpa', glyph: SandhyaGlyph, ref: '16.1–3', minutes: 1 },
    { id: 'sandhya', glyph: SandhyaGlyph, ref: '9.27', minutes: 4 },
    { id: 'svadhyaya', glyph: LeafGlyph, ref: '18.70', minutes: 6 },
    { id: 'walk', glyph: PathGlyph, ref: '2.48', minutes: 1 }
];

export const practiceById = (id) => PRACTICES.find((practice) => practice.id === id);

// One practice suggested for this moment of the day.
export function practiceForNow(date = new Date()) {
    const part = partOfDay(date);
    const day = readDay();
    if (part === 'morning') return day.sankalpa ? 'breaths' : 'sankalpa';
    if (part === 'day') return 'breaths';
    if (part === 'evening') return day.sandhya ? 'dhyana' : 'sandhya';
    return 'dhyana';
}
