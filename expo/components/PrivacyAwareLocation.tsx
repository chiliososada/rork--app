import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { getLocationDisplayText } from '@/store/location-settings-store';

interface PrivacyAwareLocationProps {
  topicId: string;
  topicUserId: string;
  originalLocation: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  distance?: number;
  style?: any;
  showDistance?: boolean;
}

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  precisionLevel: 'exact' | 'area' | 'city' | 'hidden';
  isExact: boolean;
}

export default function PrivacyAwareLocation({
  topicId,
  topicUserId,
  originalLocation,
  distance,
  style,
  showDistance = true,
}: PrivacyAwareLocationProps) {
  const { user } = useAuthStore();
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLocationWithPrivacy();
  }, [topicId, user?.id]);

  const fetchLocationWithPrivacy = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_topic_location_with_privacy', {
          topic_id_param: topicId,
          viewing_user_id: user?.id || null,
        });

      if (error) {
        console.error('Error fetching location with privacy:', error);
        // フォールバック: デフォルトの位置情報を使用
        setLocationData({
          latitude: originalLocation.latitude,
          longitude: originalLocation.longitude,
          locationName: originalLocation.name || '位置情報',
          precisionLevel: 'exact',
          isExact: true,
        });
      } else if (data && data.length > 0) {
        const loc = data[0];
        setLocationData({
          latitude: loc.latitude,
          longitude: loc.longitude,
          locationName: loc.location_name,
          precisionLevel: loc.precision_level,
          isExact: loc.is_exact,
        });
      }
    } catch (error) {
      console.error('Error in fetchLocationWithPrivacy:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters.toFixed(0)}m先`;
    } else {
      return `${(meters / 1000).toFixed(1)}km先`;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <MapPin size={14} color={Colors.text.tertiary} />
        <Text style={styles.text}>読み込み中...</Text>
      </View>
    );
  }

  if (!locationData) {
    return null;
  }

  const isOwner = user?.id === topicUserId;
  const displayText = getLocationDisplayText(
    locationData.locationName,
    locationData.precisionLevel,
    isOwner
  );

  // 位置情報が非表示の場合
  if (locationData.precisionLevel === 'hidden' && !isOwner) {
    return (
      <View style={[styles.container, style]}>
        <EyeOff size={14} color={Colors.text.tertiary} />
        <Text style={[styles.text, styles.hiddenText]}>{displayText}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapPin size={14} color={Colors.location} />
      <Text style={styles.text}>
        {displayText}
        {showDistance && distance !== undefined && locationData.precisionLevel !== 'hidden' && (
          <Text style={styles.distanceText}> • {formatDistance(distance)}</Text>
        )}
      </Text>
      {!locationData.isExact && !isOwner && (
        <View style={styles.approximateBadge}>
          <Text style={styles.approximateText}>概算</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  hiddenText: {
    fontStyle: 'italic',
  },
  distanceText: {
    color: Colors.text.tertiary,
  },
  approximateBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  approximateText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
});