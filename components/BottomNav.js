'use client';

import { HomeIcon, FolderIcon, MusicIcon, UserIcon } from '@/components/icons';

const ITEMS = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'folders', label: 'Folders', Icon: FolderIcon },
  { key: 'allsongs', label: 'All Songs', Icon: MusicIcon },
  { key: 'account', label: 'Account', Icon: UserIcon },
];

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          className={`nav-item${active === item.key ? ' active' : ''}`}
          onClick={() => onNavigate(item.key)}
        >
          <item.Icon width={20} height={20} className="nav-icon" />
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
