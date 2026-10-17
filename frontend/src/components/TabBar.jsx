import React from 'react';
import { BookOpen, Feather, Home } from 'lucide-react';
import { FlameGlyph, PathGlyph } from './ui/Ornaments';
import { useI18n } from '../i18n';

const TABS = [
    { id: 'home', icon: Home },
    { id: 'practice', glyph: FlameGlyph },
    { id: 'chapters', icon: BookOpen },
    { id: 'journal', icon: Feather },
    { id: 'path', glyph: PathGlyph }
];

// Thumb-reach navigation for phones. Hidden inside a conversation, where the
// composer owns the bottom of the screen.
function TabBar({ active, onNavigate, journalCount }) {
    const { t } = useI18n();
    return (
        <nav className="tab-bar" aria-label={t('header.nav')}>
            {TABS.map(({ id, icon: Icon, glyph: Glyph }) => (
                <button
                    key={id}
                    type="button"
                    className="tab-bar__item"
                    aria-current={active === id ? 'page' : undefined}
                    onClick={() => onNavigate(id)}
                >
                    {Icon ? <Icon size={22} aria-hidden="true" /> : <Glyph size={24} />}
                    {t(`nav.${id}`)}
                    {id === 'journal' && journalCount > 0 && (
                        <span className="tab-bar__badge">{journalCount > 99 ? '99+' : journalCount}</span>
                    )}
                </button>
            ))}
        </nav>
    );
}

export default TabBar;
