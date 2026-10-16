import React from 'react';
import { BookOpen, Feather, Home, Search, Settings as SettingsIcon } from 'lucide-react';

const TABS = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'chapters', label: 'Chapters', icon: BookOpen },
    { id: 'journal', label: 'Journal', icon: Feather },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
];

// Thumb-reach navigation for phones. Hidden inside a conversation, where the
// composer owns the bottom of the screen.
function TabBar({ active, onNavigate, journalCount }) {
    return (
        <nav className="tab-bar" aria-label="Primary">
            {TABS.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    className="tab-bar__item"
                    aria-current={active === id ? 'page' : undefined}
                    onClick={() => onNavigate(id)}
                >
                    <Icon size={21} strokeWidth={active === id ? 2 : 1.6} aria-hidden="true" />
                    {label}
                    {id === 'journal' && journalCount > 0 && (
                        <span className="tab-bar__badge">{journalCount > 99 ? '99+' : journalCount}</span>
                    )}
                </button>
            ))}
        </nav>
    );
}

export default TabBar;
