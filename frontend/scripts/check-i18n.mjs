// Checks that every translation key used in src/ exists in each dictionary,
// that dynamic keys (`mood.${id}.word`) have entries, and that placeholders
// match between languages.  Run: npm run check:i18n
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const NAMESPACES = /^(about|breaths|card|ceremony|chapters|common|daily|dhyana|guidance|guna|header|home|install|intent|japa|journal|journey|keys|meta|mood|nav|offline|palette|path|practice|practiceHub|sanctuary|sandhya|sankalpa|saved|search|settings|sound|support|svadhyaya|time|toast|update|verse|voice|you|lock|feedback|path4|followup|welcome|letters|topic|feeling)\./;

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'i18n' ? [] : walk(full);
        return /\.(jsx?|mjs)$/.test(entry.name) ? [full] : [];
    });
}

const used = new Map();
const templates = new Map();
const note = (map, key, file) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(path.relative(root, file));
};

for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(['"])([a-z][a-zA-Z]*\.[a-zA-Z0-9_.]+)\1/g)) {
        if (NAMESPACES.test(m[2]) && !/\.(jsx?|css|png|svg|json|html)$/.test(m[2])) note(used, m[2], file);
    }
    for (const m of text.matchAll(/\b(?:t|translate|hasTranslation)\(\s*`([^`]+)`/g)) note(templates, m[1], file);
}

const load = async (name) => (await import(pathToFileURL(path.join(root, 'i18n', `${name}.js`)).href)).default;
const dictionaries = { en: await load('en'), hi: await load('hi') };
const problems = [];

for (const [key, files] of used) {
    for (const [lang, dict] of Object.entries(dictionaries)) {
        if (!(key in dict)) problems.push(`missing ${lang}: ${key}  (${[...files].join(', ')})`);
    }
}

for (const [template, files] of templates) {
    const pattern = new RegExp(`^${template.split(/\$\{[^}]+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^]+?')}$`);
    for (const [lang, dict] of Object.entries(dictionaries)) {
        if (!Object.keys(dict).some((key) => pattern.test(key))) problems.push(`no ${lang} entries for template ${template}  (${[...files].join(', ')})`);
    }
}

const { en, hi } = dictionaries;
const vars = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const key of Object.keys(en)) {
    if (!(key in hi)) {
        if (!key.endsWith('_one')) problems.push(`hi lacks ${key}`);
        continue;
    }
    if (vars(en[key]) !== vars(hi[key])) problems.push(`placeholders differ for ${key}: en {${vars(en[key])}} · hi {${vars(hi[key])}}`);
}
for (const key of Object.keys(hi)) {
    if (!(key in en)) problems.push(`en lacks ${key}`);
}

if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n✗ ${problems.length} i18n problem(s)`);
    process.exit(1);
}
console.log(`✓ i18n: ${used.size} keys and ${templates.size} dynamic patterns · en ${Object.keys(en).length} · hi ${Object.keys(hi).length}`);
