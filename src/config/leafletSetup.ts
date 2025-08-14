import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default Leaflet icon fix
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// This is a common fix for Leaflet with bundlers like Vite or Webpack.
// It ensures that the default icon paths are correctly resolved.
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});