import { create } from 'zustand';
import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';

// Define our own Location type to avoid conflicts
interface AppLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
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
  reverseGeocode: (location: { latitude: number; longitude: number }) => Promise<AppLocation>;
  getDetailedLocationInfo: (location: { latitude: number; longitude: number }) => Promise<{
    areaName: string | null;
    cityName: string | null;
    regionName: string | null;
    countryName: string | null;
  }>;
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
        
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        // Get location name using reverse geocoding
        const locationWithName = await get().reverseGeocode(location);
        
        set({
          permissionStatus: 'granted' as ExpoLocation.PermissionStatus,
          currentLocation: locationWithName,
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
        
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        // Get location name using reverse geocoding
        const locationWithName = await get().reverseGeocode(location);
        
        set({
          currentLocation: locationWithName,
          isLoading: false,
        });
        return;
      }
      
      // Native implementation
      const location = await ExpoLocation.getCurrentPositionAsync({});
      
      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      // Get location name using reverse geocoding
      const locationWithName = await get().reverseGeocode(currentLocation);
      
      set({
        currentLocation: locationWithName,
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

  reverseGeocode: async (location: { latitude: number; longitude: number }): Promise<AppLocation> => {
    try {
      if (Platform.OS === 'web') {
        // Web implementation using a reverse geocoding API
        // For now, return the location with a generic name
        return {
          ...location,
          name: '現在地',
          address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
        };
      }
      
      // Native implementation using Expo Location reverse geocoding
      const reverseGeocodeResult = await ExpoLocation.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      
      if (reverseGeocodeResult && reverseGeocodeResult.length > 0) {
        const result = reverseGeocodeResult[0];
        
        // Build a readable location name
        const nameParts = [];
        if (result.district) nameParts.push(result.district);
        if (result.city) nameParts.push(result.city);
        if (result.region) nameParts.push(result.region);
        
        const name = nameParts.length > 0 ? nameParts.join(', ') : '現在地';
        
        // Build full address
        const addressParts = [];
        if (result.name) addressParts.push(result.name);
        if (result.street) addressParts.push(result.street);
        if (result.district) addressParts.push(result.district);
        if (result.city) addressParts.push(result.city);
        if (result.region) addressParts.push(result.region);
        if (result.country) addressParts.push(result.country);
        
        const address = addressParts.length > 0 ? addressParts.join(', ') : name;
        
        return {
          ...location,
          name,
          address
        };
      }
      
      // Fallback if reverse geocoding fails
      return {
        ...location,
        name: '現在地',
        address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      
      // Return location with fallback name
      return {
        ...location,
        name: '現在地',
        address: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      };
    }
  },

  // 詳細な地域情報を取得する新しいメソッド
  getDetailedLocationInfo: async (location: { latitude: number; longitude: number }) => {
    try {
      if (Platform.OS === 'web') {
        // Web では簡易的な情報のみ
        return {
          areaName: null,
          cityName: null,
          regionName: null,
          countryName: null,
        };
      }
      
      const reverseGeocodeResult = await ExpoLocation.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      
      if (reverseGeocodeResult && reverseGeocodeResult.length > 0) {
        const result = reverseGeocodeResult[0];
        
        return {
          areaName: result.district || result.subregion || null,
          cityName: result.city || result.region || null,
          regionName: result.region || result.administrativeArea || null,
          countryName: result.country || null,
        };
      }
      
      return {
        areaName: null,
        cityName: null,
        regionName: null,
        countryName: null,
      };
    } catch (error) {
      console.error('Failed to get detailed location info:', error);
      return {
        areaName: null,
        cityName: null,
        regionName: null,
        countryName: null,
      };
    }
  },
}));