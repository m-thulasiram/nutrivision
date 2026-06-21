import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { apiCall, ApiRequestError, BASE_URL } from '../utils/api';
import { getToken } from '../utils/auth';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface DetectionResult {
  class_name: string;
  confidence: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated_weight_g: number;
  raw_model_label: string;
}

interface FoodSearchResult {
  Food_items?: string;
  food_items?: string;
  Calories?: number;
  Proteins?: number;
  Carbohydrates?: number;
  Fats?: number;
  Veg_Flag?: number;
  region?: string;
  state?: string;
}

interface ConfirmedItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: 'small' | 'medium' | 'large';
}

type ScreenState = 'camera' | 'processing' | 'results' | 'manual' | 'summary';

const PORTION_MULTIPLIER = { small: 0.7, medium: 1.0, large: 1.3 };

function capitalizeLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ScanScreen({ navigation }: { navigation: any }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [screenState, setScreenState] = useState<ScreenState>('camera');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [topPredictions, setTopPredictions] = useState<{ label: string; prob: number }[]>([]);
  const [confirmedItems, setConfirmedItems] = useState<ConfirmedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [selectedMealTime, setSelectedMealTime] = useState('breakfast');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, any[]>>({});
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, any>>({});


  useEffect(() => {
    if (screenState === 'processing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.85, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [screenState, pulseAnim]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    setError('');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3 });
      if (!photo?.uri) {
        setError('Failed to capture image.');
        return;
      }
      setCapturedUri(photo.uri);
      setScreenState('processing');
      await analyzeImage(photo.base64 ?? null, photo.uri);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError('Camera error: ' + msg);
      alert('Camera error: ' + msg);
      setScreenState('camera');
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.3,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCapturedUri(asset.uri);
        setScreenState('processing');
        await analyzeImage(asset.base64 ?? null, asset.uri);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError('Gallery error: ' + msg);
      alert('Gallery error: ' + msg);
    }
  }, []);

  const analyzeImage = async (base64Data: string | null, uri: string) => {
    setProcessing(true);
    setError('');
    try {
      const token = await getToken();

      let response: Response;

      if (base64Data) {
        // Send as base64 JSON — reliable on all Android versions
        response = await fetch(`${BASE_URL}/api/analyze-meal-b64`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_base64: base64Data }),
        });
      } else {
        // Fallback: multipart FormData
        const formData = new FormData();
        formData.append('image', { uri, type: 'image/jpeg', name: 'meal.jpg' } as any);
        response = await fetch(`${BASE_URL}/api/analyze-meal`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new ApiRequestError(response.status, data.detail || 'Analysis failed');
      }

      if (data.status === 'uncertain' || !data.detections || data.detections.length === 0) {
        setDetections([]);
        setTopPredictions(data.top3_predictions || []);
        setScreenState('results');
        return;
      }

      const detectionsList: DetectionResult[] = data.detections || [];
      setDetections(detectionsList);
      setTopPredictions(data.top3_predictions || []);
      setScreenState('results');

      // Fetch regional candidate matches from the backend for each detected class
      const newCandidatesMap: Record<string, any[]> = {};
      const defaultSelections: Record<string, any> = {};

      for (const det of detectionsList) {
        if (det.raw_model_label) {
          try {
            const matchData = await apiCall<{
              success: boolean;
              candidates: any[];
            }>('/api/scanner/match', 'POST', {
              detected_class: det.raw_model_label,
            }, true);

            if (matchData && matchData.success && matchData.candidates.length > 0) {
              newCandidatesMap[det.raw_model_label] = matchData.candidates;
              // Default to the first candidate (which has highest score)
              defaultSelections[det.raw_model_label] = matchData.candidates[0];
            }
          } catch (e) {
            console.warn(`Failed to fetch candidates for ${det.raw_model_label}`, e);
          }
        }
      }

      setCandidatesMap(newCandidatesMap);
      setSelectedCandidates(defaultSelections);

    } catch (err: any) {
      const msg = err?.message || String(err);
      if (err instanceof ApiRequestError) {
        if (err.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
          return;
        }
        setError(err.message);
        alert('Server Error: ' + err.message);
      } else {
        setError('Analysis failed: ' + msg);
        alert('Network Error: ' + msg);
      }
      setScreenState('camera');
    } finally {
      setProcessing(false);
    }
  };

  const searchFoods = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await apiCall<{ foods: FoodSearchResult[] }>(
        `/api/foods/search?q=${encodeURIComponent(q)}`,
        'GET', undefined, true
      ).catch(() => null);
      setSearchResults(data?.foods || []);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const confirmItem = (detection: DetectionResult, portion: 'small' | 'medium' | 'large') => {
    const mult = PORTION_MULTIPLIER[portion];
    const candidate = selectedCandidates[detection.raw_model_label];
    
    let name = detection.class_name;
    let calories = detection.calories;
    let protein = detection.protein;
    let carbs = detection.carbs;
    let fat = detection.fat;

    if (candidate) {
      const sizeMult = detection.estimated_weight_g / 100;
      name = candidate.food_name;
      calories = candidate.calories * sizeMult;
      protein = candidate.protein_g * sizeMult;
      carbs = candidate.carbs_g * sizeMult;
      fat = candidate.fats_g * sizeMult;
    }

    setConfirmedItems((prev) => [
      ...prev,
      {
        name,
        calories: calories * mult,
        protein: protein * mult,
        carbs: carbs * mult,
        fat: fat * mult,
        portion,
      },
    ]);
  };

  const removeItem = (name: string) => {
    setConfirmedItems((prev) => prev.filter((it) => it.name !== name));
  };

  const logMeal = async () => {
    if (confirmedItems.length === 0) return;
    setProcessing(true);
    setError('');
    try {
      const totalCals = confirmedItems.reduce((s, i) => s + i.calories, 0);
      const totalPro = confirmedItems.reduce((s, i) => s + i.protein, 0);
      const totalCarbs = confirmedItems.reduce((s, i) => s + i.carbs, 0);
      const totalFats = confirmedItems.reduce((s, i) => s + i.fat, 0);

      await apiCall('/api/users/me/meals', 'POST', {
        meal_time: selectedMealTime,
        total_calories: totalCals,
        total_protein: totalPro,
        total_carbs: totalCarbs,
        total_fats: totalFats,
        detected_items: confirmedItems.map((i) => i.name).join(', '),
      }, true);

      setConfirmedItems([]);
      setCapturedUri(null);
      setDetections([]);
      setScreenState('camera');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to log meal.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const addToConfirmed = () => {
    setConfirmedItems((prev) => [
      ...prev,
      { name: 'Manual Entry', calories: 0, protein: 0, carbs: 0, fat: 0, portion: 'medium' },
    ]);
    setScreenState('summary');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permissions loading...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          NutriVision needs camera access to scan your food
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screenState === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flash ? 'on' : 'off'}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <View style={styles.cameraTopLeft}>
                <Text style={styles.regionBadge}>Region 🌿</Text>
              </View>
              <TouchableOpacity onPress={() => setScreenState('manual')}>
                <Text style={styles.manualText}>Type manually</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity onPress={pickFromGallery} style={styles.galleryButton}>
                <Text style={styles.galleryIcon}>🖼️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={takePicture} style={styles.captureButton}>
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFlash((f) => !f)} style={styles.flashButton}>
                <Text style={styles.flashIcon}>{flash ? '⚡' : '🔌'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (screenState === 'processing') {
    return (
      <View style={styles.container}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={styles.previewImage} />
        ) : null}
        <Animated.View style={[styles.processingOverlay, { opacity: pulseAnim }]}>
          <ActivityIndicator size="large" color="#1D9E75" />
          <Text style={styles.processingText}>Analysing your meal...</Text>
          <Text style={styles.processingSubtext}>Identifying foods and calculating nutrition</Text>
        </Animated.View>
      </View>
    );
  }

  if (screenState === 'results') {
    const hasDetections = detections.length > 0;
    const uncertainDetections = detections.filter((d) => d.confidence < 0.75 && d.confidence >= 0.50);
    const unknownDetections = detections.filter((d) => d.confidence < 0.50);
    const goodDetections = detections.filter((d) => d.confidence >= 0.75);

    return (
      <View style={styles.container}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={styles.previewImageTop} />
        ) : null}
        <ScrollView style={styles.resultsSheet} contentContainerStyle={styles.resultsContent}>
          {hasDetections ? (
            <>
              {goodDetections.map((det, idx) => {
                const candidate = selectedCandidates[det.raw_model_label];
                const sizeMult = det.estimated_weight_g / 100;
                
                const displayName = candidate ? candidate.food_name : det.class_name;
                const displayRegion = candidate ? `${candidate.state || candidate.cuisine} (${det.raw_model_label.replace("_", " ")})` : `${det.raw_model_label.replace("_", " ")}`;
                
                const displayCals = candidate ? Math.round(candidate.calories * sizeMult) : Math.round(det.calories);
                const displayPro = candidate ? Math.round(candidate.protein_g * sizeMult) : Math.round(det.protein);
                const displayCarbs = candidate ? Math.round(candidate.carbs_g * sizeMult) : Math.round(det.carbs);
                const displayFat = candidate ? Math.round(candidate.fats_g * sizeMult) : Math.round(det.fat);

                return (
                  <View key={idx} style={styles.detectionCard}>
                    <View style={styles.detectionHeader}>
                      <Text style={styles.detectionName}>{displayName}</Text>
                      <Text style={styles.detectionConf}>{Math.round(det.confidence * 100)}% ●●●●○</Text>
                    </View>
                    <Text style={styles.detectionRegion}>{displayRegion} 🌿</Text>
                    <Text style={styles.detectionMacros}>
                      {displayCals} kcal · {displayPro}g P · {displayCarbs}g C · {displayFat}g F
                    </Text>

                    {/* Regional Candidates List */}
                    {candidatesMap[det.raw_model_label] && (
                      <View style={styles.candidatesContainer}>
                        <Text style={styles.candidatesTitle}>Select precise regional dish:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidatesScroll}>
                          {candidatesMap[det.raw_model_label].map((cand) => {
                            const isSelected = selectedCandidates[det.raw_model_label]?.food_name === cand.food_name;
                            return (
                              <TouchableOpacity
                                key={cand.food_name}
                                style={[
                                  styles.candidateChip,
                                  isSelected && styles.candidateChipActive,
                                ]}
                                onPress={() => {
                                  setSelectedCandidates((prev) => ({
                                    ...prev,
                                    [det.raw_model_label]: cand,
                                  }));
                                }}
                              >
                                <Text style={[
                                  styles.candidateChipText,
                                  isSelected && styles.candidateChipTextActive,
                                ]}>
                                  {cand.food_name} ({cand.state || cand.cuisine})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}

                    <View style={styles.portionRow}>
                      {(['small', 'medium', 'large'] as const).map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.portionButton,
                            confirmedItems.some((i) => i.name === displayName && i.portion === p) && styles.portionActive,
                          ]}
                          onPress={() => confirmItem(det, p)}
                        >
                          <Text style={[
                            styles.portionText,
                            confirmedItems.some((i) => i.name === displayName && i.portion === p) && styles.portionTextActive,
                          ]}>
                            {capitalizeLabel(p)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.detectionActions}>
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => confirmItem(det, 'medium')}
                      >
                        <Text style={styles.addButtonText}>✓ Add to meal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeItem(displayName)}
                      >
                        <Text style={styles.removeButtonText}>✗ Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {uncertainDetections.map((det, idx) => (
                <View key={idx} style={styles.uncertainCard}>
                  <Text style={styles.uncertainTitle}>❓ What is this food?</Text>
                  <View style={styles.uncertainOptions}>
                    {['Idli', 'Vada', 'Medu Vada'].map((opt, oi) => (
                      <TouchableOpacity
                        key={oi}
                        style={styles.uncertainOption}
                        onPress={() => {
                          setConfirmedItems((prev) => [
                            ...prev,
                            { name: opt, calories: 150, protein: 4, carbs: 30, fat: 2, portion: 'medium' },
                          ]);
                        }}
                      >
                        <Text style={styles.uncertainOptionText}>{opt}</Text>
                        <Text style={styles.uncertainOptionPct}>{100 - oi * 17}%</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={() => setScreenState('manual')}
                  >
                    <Text style={styles.uncertainManual}>None of these — type manually</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {unknownDetections.length > 0 && !hasDetections ? (
                <View style={styles.unknownCard}>
                  <Text style={styles.unknownTitle}>🔍 Food not recognised</Text>
                  <TextInput
                    style={styles.unknownSearch}
                    placeholder="Type to search your food..."
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                    value={searchQuery}
                    onChangeText={(t) => {
                      setSearchQuery(t);
                      searchFoods(t);
                    }}
                  />
                  {searchQuery.length > 0 ? (
                    <Text style={styles.unknownSuggestion}>
                      No results found. Try another name.
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.manualEntryButton}
                    onPress={() => setScreenState('manual')}
                  >
                    <Text style={styles.manualEntryText}>Search manually</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.noDetections}>
              <Text style={styles.noDetectTitle}>No food detected</Text>
              <Text style={styles.noDetectSub}>
                Confidence: {topPredictions.length > 0 ? `${Math.round(topPredictions[0].prob * 100)}%` : 'low'}
              </Text>
              <TouchableOpacity
                style={styles.tryAgainButton}
                onPress={() => setScreenState('camera')}
              >
                <Text style={styles.tryAgainText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setScreenState('manual')}
              >
                <Text style={styles.manualEntryText}>Enter food manually</Text>
              </TouchableOpacity>
            </View>
          )}

          {confirmedItems.length > 0 ? (
            <TouchableOpacity
              style={styles.viewSummaryButton}
              onPress={() => setScreenState('summary')}
            >
              <Text style={styles.viewSummaryText}>
                View Meal Summary ({confirmedItems.length} items)
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (screenState === 'manual') {
    return (
      <View style={styles.container}>
        <View style={styles.manualHeader}>
          <TouchableOpacity onPress={() => setScreenState('camera')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.manualTitle}>Search Food</Text>
          <View style={{ width: 60 }} />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a food..."
          placeholderTextColor="#9CA3AF"
          autoFocus
          value={searchQuery}
          onChangeText={(t) => {
            setSearchQuery(t);
            searchFoods(t);
          }}
        />
        <ScrollView style={styles.searchResults}>
          {searchResults.map((food, idx) => {
            const name = food.Food_items || food.food_items || '';
            return (
              <TouchableOpacity
                key={idx}
                style={styles.searchResultItem}
                onPress={() => {
                  setConfirmedItems((prev) => [
                    ...prev,
                    {
                      name,
                      calories: food.Calories || 0,
                      protein: food.Proteins || 0,
                      carbs: food.Carbohydrates || 0,
                      fat: food.Fats || 0,
                      portion: 'medium',
                    },
                  ]);
                  setScreenState('summary');
                }}
              >
                <Text style={styles.searchResultName}>{name}</Text>
                <Text style={styles.searchResultMeta}>
                  {Math.round(food.Calories || 0)} kcal/100g
                </Text>
                <Text style={styles.searchResultVeg}>
                  {(food.Veg_Flag ?? 1) === 0 ? '🌿 Veg' : '🍗 Non-Veg'}
                </Text>
              </TouchableOpacity>
            );
          })}
          {searchQuery.length > 0 && searchResults.length === 0 ? (
            <Text style={styles.noResults}>No foods found. Try a different name.</Text>
          ) : null}
        </ScrollView>
        {confirmedItems.length > 0 ? (
          <TouchableOpacity
            style={styles.summaryNavButton}
            onPress={() => setScreenState('summary')}
          >
            <Text style={styles.summaryNavText}>
              Continue ({confirmedItems.length} items)
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const totalCals = confirmedItems.reduce((s, i) => s + i.calories, 0);
  const totalPro = confirmedItems.reduce((s, i) => s + i.protein, 0);
  const totalCarbs = confirmedItems.reduce((s, i) => s + i.carbs, 0);
  const totalFats = confirmedItems.reduce((s, i) => s + i.fat, 0);

  return (
    <View style={styles.container}>
      <View style={styles.summaryHeader}>
        <TouchableOpacity onPress={() => setScreenState('results')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.manualTitle}>Meal Summary</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.summaryContent}>
        {confirmedItems.map((item, idx) => (
          <View key={idx} style={styles.summaryItem}>
            <View style={styles.summaryItemInfo}>
              <Text style={styles.summaryItemName}>{item.name}</Text>
              <Text style={styles.summaryItemPortion}>{capitalizeLabel(item.portion)} portion</Text>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.name)}>
              <Text style={styles.summaryRemove}>✗</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.summaryTotal}>
          <Text style={styles.summaryTotalTitle}>Total</Text>
          <Text style={styles.summaryTotalCals}>{Math.round(totalCals)} kcal</Text>
          <Text style={styles.summaryTotalMacros}>
            {Math.round(totalPro)}g P · {Math.round(totalCarbs)}g C · {Math.round(totalFats)}g F
          </Text>
        </View>

        <View style={styles.mealTimeSelector}>
          <Text style={styles.mealTimeLabel}>Meal time</Text>
          <View style={styles.mealTimeChips}>
            {['breakfast', 'lunch', 'dinner', 'snack'].map((mt) => (
              <TouchableOpacity
                key={mt}
                style={[styles.mealChip, selectedMealTime === mt && styles.mealChipActive]}
                onPress={() => setSelectedMealTime(mt)}
              >
                <Text style={[styles.mealChipText, selectedMealTime === mt && styles.mealChipTextActive]}>
                  {capitalizeLabel(mt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.logButton, processing && styles.logButtonDisabled]}
          onPress={logMeal}
          disabled={processing || confirmedItems.length === 0}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.logButtonText}>Log This Meal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
  },
  cameraTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regionBadge: {
    fontSize: 13,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  manualText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cameraBottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingBottom: 40,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryIcon: {
    fontSize: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  flashButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashIcon: {
    fontSize: 24,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#E24B4A',
    textAlign: 'center',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  permissionButton: {
    height: 52,
    marginHorizontal: 32,
    borderRadius: 12,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewImage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    resizeMode: 'cover',
  },
  previewImageTop: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.4,
    resizeMode: 'cover',
  },
  processingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  resultsSheet: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  resultsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  detectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  detectionConf: {
    fontSize: 12,
    color: '#1D9E75',
    fontWeight: '600',
  },
  detectionRegion: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  detectionMacros: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  portionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  portionButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portionActive: {
    borderColor: '#1D9E75',
    backgroundColor: '#F0FDF4',
  },
  portionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  portionTextActive: {
    color: '#1D9E75',
  },
  detectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E24B4A',
  },
  uncertainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  uncertainTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  uncertainOptions: {
    gap: 8,
  },
  uncertainOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uncertainOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  uncertainOptionPct: {
    fontSize: 13,
    color: '#6B7280',
  },
  uncertainManual: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  unknownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  unknownTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  unknownSearch: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  unknownSuggestion: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  manualEntryButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualEntryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D9E75',
  },
  noDetections: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  noDetectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  noDetectSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  tryAgainButton: {
    height: 44,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tryAgainText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualButton: {
    height: 44,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewSummaryButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewSummaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  backText: {
    fontSize: 16,
    color: '#1D9E75',
    fontWeight: '600',
  },
  searchInput: {
    height: 52,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchResultItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  searchResultMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 8,
  },
  searchResultVeg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D9E75',
  },
  noResults: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
  summaryNavButton: {
    margin: 20,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryNavText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  summaryContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  summaryItemPortion: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  summaryRemove: {
    fontSize: 18,
    color: '#E24B4A',
    fontWeight: '700',
    paddingLeft: 16,
  },
  summaryTotal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    alignItems: 'center',
  },
  summaryTotalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryTotalCals: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1D9E75',
  },
  summaryTotalMacros: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  mealTimeSelector: {
    marginBottom: 20,
  },
  mealTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  mealTimeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  mealChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  mealChipActive: {
    borderColor: '#1D9E75',
    backgroundColor: '#1D9E75',
  },
  mealChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  mealChipTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    color: '#E24B4A',
    textAlign: 'center',
    marginBottom: 12,
  },
  logButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logButtonDisabled: {
    opacity: 0.5,
  },
  logButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  candidatesContainer: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 10,
  },
  candidatesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
  },
  candidatesScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  candidateChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  candidateChipActive: {
    backgroundColor: '#1D9E75',
    borderColor: '#1D9E75',
  },
  candidateChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  candidateChipTextActive: {
    color: '#FFFFFF',
  },
});
