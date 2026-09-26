import MapCore from './MapCore';
import MapControls from './MapControls';
import ForecastLayer from './ForecastLayer';

export default function MapView() {
  return (
    <div className="w-full h-full relative overflow-hidden">
      <MapCore>
        <MapControls />
        <ForecastLayer />
      </MapCore>
    </div>
  );
}
