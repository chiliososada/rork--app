import { Platform } from 'react-native';

// Platform-specific imports
const MapViewComponent = Platform.select({
  web: () => require('./MapView.web').default,
  default: () => require('./MapView.native').default,
})();

export default MapViewComponent;