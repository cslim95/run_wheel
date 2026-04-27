interface Props {
  runCount: number;
}

export default function HomePinSetup({ runCount }: Props) {
  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <h2>Set your home location</h2>
        <p>
          Click anywhere on the map to drop a pin where you live.
          We&rsquo;ll find your furthest reach in every direction from there.
        </p>
        <p className="hint">{runCount} runs loaded.</p>
      </div>
    </div>
  );
}
