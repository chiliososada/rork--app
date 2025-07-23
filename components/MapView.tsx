import React from 'react';
import { Platform } from 'react-native';

// Define the props interface
interface Location {
  latitude: number;
  longitude: number;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  location: Location;
}

interface MapViewComponentProps {
  currentLocation: Location;
  topics: Topic[];
  onMarkerPress: (topicId: string) => void;
  onRegionChange?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
}

// Platform-specific component loading
let MapViewComponent: React.ComponentType<MapViewComponentProps>;

if (Platform.OS === 'web') {
  MapViewComponent = require('./MapView.web').default;
} else {
  MapViewComponent = require('./MapView.native').default;
}

export default MapViewComponent;