import React, { useState, useMemo } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { MessageCircle } from "lucide-react-native";
import Colors from "@/constants/colors";

interface Location {
  latitude: number;
  longitude: number;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  location: Location;
  commentCount: number;
  participantCount: number;
}

interface MapViewComponentProps {
  currentLocation: Location;
  topics: Topic[];
  onMarkerPress: (topicId: string) => void;
}

export default function MapViewComponent({ 
  currentLocation, 
  topics, 
  onMarkerPress 
}: MapViewComponentProps) {
  const [mapReady, setMapReady] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  
  // Convert topics to simple markers for better performance
  const markers = useMemo(() => {
    if (!mapReady) return [];
    
    return topics.map((topic) => ({
      id: topic.id,
      coordinate: topic.location,
      topic: topic
    }));
  }, [mapReady, topics]);
  
  // Render individual markers for optimal performance with few topics
  const renderMarkers = () => {
    return markers.map((marker) => (
      <Marker
        key={marker.id}
        coordinate={{
          latitude: marker.coordinate.latitude,
          longitude: marker.coordinate.longitude,
        }}
        title={marker.topic.title}
        description={marker.topic.description}
        onPress={() => onMarkerPress(marker.topic.id)}
      >
        <View style={styles.markerContainer}>
          <View style={styles.marker}>
            <MessageCircle size={16} color={Colors.text.light} />
          </View>
        </View>
      </Marker>
    ));
  };
  
  return (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
        showsMyLocationButton
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(region) => setMapRegion(region)}
        loadingEnabled={true}
        loadingIndicatorColor={Colors.primary}
        loadingBackgroundColor={Colors.background}
      >
        {renderMarkers()}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    margin: 16,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: Colors.text.light,
  },
});