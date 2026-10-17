import React from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import { sanskritLines } from '../lib/verse';

const LANG_BY_SCRIPT = {
    deva: 'sa', iast: 'sa-Latn', beng: 'sa-Beng', gujr: 'sa-Gujr', guru: 'sa-Guru',
    orya: 'sa-Orya', telu: 'sa-Telu', knda: 'sa-Knda', mlym: 'sa-Mlym', taml: 'sa-Taml'
};

// Keep a daṇḍa with the word before it, so it never starts a line alone.
const holdDanda = (line) => line.replace(/\s+([।॥|]+)/g, ' $1');

// A śloka, in the script the reader chose, broken at its daṇḍas.
function Sloka({ verse, className = '', as: Tag = 'p' }) {
    const { sanskrit, script } = usePreferences();
    if (!verse?.sanskrit) return null;
    const text = sanskrit(verse.sanskrit, verse.iast);
    return (
        <Tag className={`sanskrit sloka${script === 'iast' ? ' sloka--iast' : ''} ${className}`} lang={LANG_BY_SCRIPT[script] || 'sa'}>
            {sanskritLines(text).map((line, index) => <span key={index}>{holdDanda(line)}</span>)}
        </Tag>
    );
}

export default Sloka;
