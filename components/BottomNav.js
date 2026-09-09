'use client';

const ITEMS = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'folders', label: 'Folders', icon: '▤' },
  { key: 'allsongs', label: 'All Songs', icon: '♪' },
  { key: 'account', label: 'Account', icon: '☺' },
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
          <span className="nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
