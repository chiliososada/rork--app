import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { MapPin } from "lucide-react-native";
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
      >
        {mapReady && topics.map((topic) => (
          <Marker
            key={topic.id}
            coordinate={{
              latitude: topic.location.latitude,
              longitude: topic.location.longitude,
            }}
            title={topic.title}
            description={topic.description}
            onPress={() => onMarkerPress(topic.id)}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker}>
                <MapPin size={16} color={Colors.text.light} />
              </View>
            </View>
          </Marker>
        ))}
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
  },
  marker: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 8,
  },
});