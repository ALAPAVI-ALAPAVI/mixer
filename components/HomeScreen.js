'use client';

const TILES = [
  { key: 'folders', label: 'Folders', icon: '▤' },
  { key: 'allsongs', label: 'All Songs', icon: '♪' },
  { key: 'account', label: 'Account', icon: '☺' },
];

export default function HomeScreen({ userName, onNavigate }) {
  return (
    <section>
      <div className="library-header">
        <h2>Welcome back{userName ? `, ${userName}` : ''}</h2>
      </div>

      <div className="home-tiles">
        {TILES.map((tile) => (
          <button key={tile.key} className="home-tile" onClick={() => onNavigate(tile.key)}>
            <span className="home-tile-icon" aria-hidden="true">
              {tile.icon}
            </span>
            <span className="home-tile-label">{tile.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
