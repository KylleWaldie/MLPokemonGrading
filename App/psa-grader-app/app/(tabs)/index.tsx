import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// ── Config ─────────────────────────────────────────────────────────────────────
// Replace this with your Hugging Face or Railway API URL when deployed
// For local testing use your computer's IP address e.g. http://192.168.1.5:8000
const API_URL = 'http://192.168.1.72:8000';
// ──────────────────────────────────────────────────────────────────────────────

const PSA_COLORS = {
  1:  '#FF3B3B',
  2:  '#FF6B3B',
  3:  '#FF9F3B',
  4:  '#FFD23B',
  5:  '#FFEF3B',
  6:  '#C8FF3B',
  7:  '#6BFF6B',
  8:  '#3BFFC8',
  9:  '#3BC8FF',
  10: '#B388FF',
};

export default function App() {
  const [image, setImage]       = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const fadeAnim                = useRef(new Animated.Value(0)).current;
  const scaleAnim               = useRef(new Animated.Value(0.8)).current;

  const animateResult = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const resetAnimations = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access gallery was denied');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!pickerResult.canceled) {
      resetAnimations();
      setResult(null);
      setError(null);
      setImage(pickerResult.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access camera was denied');
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!pickerResult.canceled) {
      resetAnimations();
      setResult(null);
      setError(null);
      setImage(pickerResult.assets[0].uri);
    }
  };

  const predictGrade = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri:  image,
        name: 'card.jpg',
        type: 'image/jpeg',
      });

      const response = await axios.post(`${API_URL}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      setResult(response.data);
      animateResult();
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Is the API running?');
      } else if (err.response) {
        setError(`API error: ${err.response.data.detail}`);
      } else {
        setError('Could not connect to the API. Check your API_URL.');
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    resetAnimations();
  };

  const gradeColor = result ? PSA_COLORS[result.predicted_grade] || '#FFFFFF' : '#FFFFFF';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>POKEMON CARD</Text>
          <Text style={styles.headerTitle}>PSA GRADER</Text>
          <View style={styles.headerLine} />
        </View>

        {/* Image Preview */}
        <View style={styles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderIcon}>🃏</Text>
              <Text style={styles.placeholderText}>No card selected</Text>
              <Text style={styles.placeholderSub}>Take a photo or choose from gallery</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <Text style={styles.buttonIcon}>📷</Text>
            <Text style={styles.buttonLabel}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={pickFromGallery}>
            <Text style={styles.buttonIcon}>🖼️</Text>
            <Text style={styles.buttonLabel}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Predict Button */}
        {image && !result && (
          <TouchableOpacity
            style={[styles.predictButton, loading && styles.predictButtonDisabled]}
            onPress={predictGrade}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0F" size="small" />
            ) : (
              <Text style={styles.predictButtonText}>GRADE THIS CARD</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <Animated.View
            style={[
              styles.resultContainer,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
              { borderColor: gradeColor }
            ]}
          >
            <Text style={styles.resultLabel}>PREDICTED GRADE</Text>
            <Text style={[styles.resultGrade, { color: gradeColor }]}>
              PSA {result.predicted_grade}
            </Text>
            <View style={[styles.resultDivider, { backgroundColor: gradeColor }]} />
            <Text style={styles.resultConfidence}>
              {result.confidence}% confidence
            </Text>

            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>GRADE ANOTHER CARD</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 32,
  },
  headerEyebrow: {
    color: '#444455',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
  },
  headerLine: {
    width: 48,
    height: 3,
    backgroundColor: '#B388FF',
    marginTop: 12,
    borderRadius: 2,
  },

  // Image
  imageContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#12121A',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#555566',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSub: {
    color: '#333344',
    fontSize: 13,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#12121A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  buttonIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  buttonLabel: {
    color: '#AAAACC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Predict
  predictButton: {
    backgroundColor: '#B388FF',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  predictButtonDisabled: {
    opacity: 0.6,
  },
  predictButtonText: {
    color: '#0A0A0F',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3,
  },

  // Error
  errorBox: {
    backgroundColor: '#1A0A0A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF3B3B44',
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },

  // Result
  resultContainer: {
    backgroundColor: '#12121A',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 16,
  },
  resultLabel: {
    color: '#555566',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 12,
  },
  resultGrade: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 4,
  },
  resultDivider: {
    width: 48,
    height: 2,
    borderRadius: 1,
    marginVertical: 16,
  },
  resultConfidence: {
    color: '#555566',
    fontSize: 14,
    marginBottom: 24,
  },
  resetButton: {
    borderWidth: 1,
    borderColor: '#333344',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  resetButtonText: {
    color: '#AAAACC',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
});