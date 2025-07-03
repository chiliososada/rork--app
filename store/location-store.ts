import { create } from 'zustand';
import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';

// Define our own Location type to avoid conflicts
interface AppLocation {
  latitude: number;
  longitude: number;
}

interface LocationState {
  currentLocation: AppLocation | null;
  selectedLocation: AppLocation | null;
  permissionStatus: ExpoLocation.PermissionStatus | null;
  isLoading: boolean;
  error: string | null;
  
  requestPermission: () => Promise<void>;
  getCurrentLocation: () => Promise<void>;
  setSelectedLocation: (location: AppLocation) => void;
  clearSelectedLocation: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  selectedLocation: null,
  permissionStatus: null,
  isLoading: false,
  error: null,

  requestPermission: async () => {
    set({ isLoading: true, error: null });
    
    try {
      if (Platform.OS === 'web') {
        // Web implementation
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        set({
          permissionStatus: 'granted' as ExpoLocation.PermissionStatus,
          currentLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          isLoading: false,
        });
        return;
      }
      
      // Native implementation
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      set({ permissionStatus: status });
      
      if (status !== 'granted') {
        set({ 
          error: "Permission to access location was denied", 
          isLoading: false 
        });
        return;
      }
      
      await get().getCurrentLocation();
    } catch (error) {
      set({ 
        error: "Failed to get location permission", 
        isLoading: false 
      });
    }
  },

  getCurrentLocation: async () => {
    set({ isLoading: true, error: null });
    
    try {
      if (Platform.OS === 'web') {
        // Web implementation
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        set({
          currentLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          isLoading: false,
        });
        return;
      }
      
      // Native implementation
      const location = await ExpoLocation.getCurrentPositionAsync({});
      
      set({
        currentLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        isLoading: false,
      });
    } catch (error) {
      set({ 
        error: "Failed to get current location", 
        isLoading: false 
      });
    }
  },

  setSelectedLocation: (location) => {
    set({ selectedLocation: location });
  },

  clearSelectedLocation: () => {
    set({ selectedLocation: null });
  },
}));