import React from "react";
import { StyleSheet, Text, View } from "react-native";
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
  return (
    <View style={styles.webFallback}>
      <MapPin size={40} color={Colors.primary} />
      <Text style={styles.webFallbackTitle}>Map View</Text>
      <Text style={styles.webFallbackText}>
        The map view is only available on mobile devices. Please use the Nearby tab to browse topics.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  webFallbackText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },
});