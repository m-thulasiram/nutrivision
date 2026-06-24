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
  const [processingStatus, setProcessingStatus] = useState('Analysing your meal...');
  const [flash, setFlash] = useState(false);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, any[]>>({});
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, any>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);


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

  // Loading timer for processing phase
  useEffect(() => {
    if (screenState !== 'processing') {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [screenState]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    setError('');
    try {
      // quality: 0.15 keeps file tiny (~80-150KB) — prevents Render OOM on 512MB RAM
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.15,
      });
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
        quality: 0.15,
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
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // 60-second fetch timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const token = await getToken();

      // Guard: reject if base64 is too large (>4MB string)
      if (base64Data && base64Data.length > 4 * 1024 * 1024) {
        throw new Error('Image too large. Please try again.');
      }

      let response: Response;
      if (base64Data) {
        response = await fetch(`${BASE_URL}/api/analyze-meal-b64`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_base64: base64Data }),
          signal: controller.signal,
        });
      } else {
        const formData = new FormData();
        formData.append('image', { uri, type: 'image/jpeg', name: 'meal.jpg' } as any);
        response = await fetch(`${BASE_URL}/api/analyze-meal`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      // Check content type BEFORE parsing to handle HTML error pages safely
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server is unavailable. Please check your connection and try again.");
      }

      // Check response is not empty
      const responseText = await response.text();
      if (!responseText || responseText.trim() === "") {
        throw new Error("Server returned empty response. Please try again.");
      }

      // Parse JSON safely
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Could not read server response. Please try again.");
      }

      if (!response.ok) {
        throw new Error(data?.detail || data?.error_message || `Server error (${response.status})`);
      }

      if (data.status === "error") {
        throw new Error(data.error_message || "Analysis failed. Please try again.");
      }

      // Save full response for demo mode banner check
      setScanResult(data);

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
      clearTimeout(timeoutId);
      const msg = err?.message || String(err);
      
      // User-friendly error messages
      let userMessage = "Could not analyse the image.";
      if (err.name === "AbortError" || err.message?.includes("AbortError")) {
        userMessage = "Request timed out. The AI is taking too long. Please try again with a clearer photo.";
      } else if (
        msg.includes("Network") ||
        msg.includes("fetch") ||
        msg.includes("connection")
      ) {
        userMessage = "Connection failed. Make sure the app is connected to the same network as the server.";
      } else if (
        msg.includes("unavailable") ||
        msg.includes("502")
      ) {
        userMessage = "Server is starting up. Please wait 30 seconds and try again.";
      } else {
        userMessage = msg || "Analysis failed. Try again.";
      }

      setError(userMessage);
      alert(userMessage);
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
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#1D9E75" />
          
          <Text style={styles.processingTitle}>
            Analysing your meal...
          </Text>
          
          <Text style={styles.processingSubtitle}>
            AI is identifying your food.{"\n"}
            This takes 10-15 seconds.{"\n"}
            Please wait ⏳
          </Text>
          
          <Text style={styles.processingTimer}>
            {elapsedSeconds}s elapsed
          </Text>
          
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => {
              abortControllerRef.current?.abort();
              setScreenState("camera");
            }}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screenState === 'results') {
    const hasDetections = detections.length > 0;

    return (
      <View style={styles.container}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={styles.previewImageTop} />
        ) : null}
        <ScrollView style={styles.resultsSheet} contentContainerStyle={styles.resultsContent}>
          {scanResult?.is_demo_mode && (
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerText}>
                🔑 Demo Mode — Add OpenAI API key for real food detection
              </Text>
            </View>
          )}
          {hasDetections ? (
            <>
              {detections.map((det, idx) => (
                <FoodDetectionCard
                  key={idx}
                  det={det}
                  confirmedItems={confirmedItems}
                  onConfirm={confirmItem}
                  onRemove={removeItem}
                />
              ))}
            </>
          ) : (
            <View style={styles.noDetections}>
              <Text style={styles.noDetectTitle}>No food detected</Text>
              <Text style={styles.noDetectSub}>
                Please try taking a clearer photo from a different angle or lighting.
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
                    ...prev.filter((it) => it.name !== name),
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

interface FoodDetectionCardProps {
  det: any;
  confirmedItems: ConfirmedItem[];
  onConfirm: (detection: any, portion: 'small' | 'medium' | 'large') => void;
  onRemove: (name: string) => void;
}

function FoodDetectionCard({ det, confirmedItems, onConfirm, onRemove }: FoodDetectionCardProps) {
  const [showMicros, setShowMicros] = useState(false);
  const [portion, setPortion] = useState<'small' | 'medium' | 'large'>('medium');
  
  const hasNutrition = !!det.nutrition;
  const displayName = det.nutrition ? det.nutrition.food_name : det.food_name;
  const isConfirmed = confirmedItems.some((i) => i.name === displayName);
  const currentConfirmedPortion = confirmedItems.find((i) => i.name === displayName)?.portion;
  
  const activePortion = currentConfirmedPortion || portion;
  const multiplier = activePortion === 'small' ? 0.7 : activePortion === 'large' ? 1.4 : 1.0;
  
  const nutrition = det.nutrition ? {
    calories: Math.round(det.nutrition.calories * multiplier),
    protein_g: Math.round(det.nutrition.protein_g * multiplier * 10) / 10,
    carbs_g: Math.round(det.nutrition.carbs_g * multiplier * 10) / 10,
    fats_g: Math.round(det.nutrition.fats_g * multiplier * 10) / 10,
    fibre_g: Math.round(det.nutrition.fibre_g * multiplier * 10) / 10,
    sugar_g: Math.round(det.nutrition.sugar_g * multiplier * 10) / 10,
    iron_mg: Math.round(det.nutrition.iron_mg * multiplier * 100) / 100,
    calcium_mg: Math.round(det.nutrition.calcium_mg * multiplier * 10) / 10,
    sodium_mg: Math.round(det.nutrition.sodium_mg * multiplier * 10) / 10,
    potassium_mg: Math.round(det.nutrition.potassium_mg * multiplier * 10) / 10,
    vitamin_d_iu: Math.round(det.nutrition.vitamin_d_iu * multiplier * 10) / 10,
  } : null;

  return (
    <View style={styles.detectionCard}>
      <View style={styles.detectionHeader}>
        <Text style={styles.detectionName}>{displayName}</Text>
        <Text style={styles.detectionConf}>{Math.round(det.confidence * 100)}% Match</Text>
      </View>
      
      {det.description ? (
        <Text style={styles.detectionRegion}>{det.description} 🌿</Text>
      ) : null}

      {det.veg_warning ? (
        <Text style={styles.vegWarningText}>⚠️ {det.veg_warning}</Text>
      ) : null}

      {hasNutrition && nutrition ? (
        <>
          {/* Main macros */}
          <View style={styles.macroRow}>
            <MacroPill label="kcal" value={nutrition.calories} color="#1A1A1A"/>
            <MacroPill label="protein" value={`${nutrition.protein_g}g`} color="#1D9E75"/>
            <MacroPill label="carbs" value={`${nutrition.carbs_g}g`} color="#185FA5"/>
            <MacroPill label="fats" value={`${nutrition.fats_g}g`} color="#BA7517"/>
          </View>

          {/* Micronutrients — expandable */}
          <TouchableOpacity 
            onPress={() => setShowMicros(!showMicros)}
            style={styles.microsToggle}
          >
            <Text style={styles.microsToggleText}>
              {showMicros 
                ? "Hide micronutrients ▲" 
                : "Show vitamins & minerals ▼"}
            </Text>
          </TouchableOpacity>

          {showMicros && (
            <View style={styles.microsGrid}>
              <MicroRow label="Fibre" 
                value={`${nutrition.fibre_g}g`}
                daily="25g" 
                pct={nutrition.fibre_g/25}/>
              <MicroRow label="Sugar" 
                value={`${nutrition.sugar_g}g`}
                daily="50g" 
                pct={nutrition.sugar_g/50}/>
              <MicroRow label="Iron" 
                value={`${nutrition.iron_mg}mg`}
                daily="18mg" 
                pct={nutrition.iron_mg/18}/>
              <MicroRow label="Calcium" 
                value={`${nutrition.calcium_mg}mg`}
                daily="1000mg" 
                pct={nutrition.calcium_mg/1000}/>
              <MicroRow label="Sodium" 
                value={`${nutrition.sodium_mg}mg`}
                daily="2300mg" 
                pct={nutrition.sodium_mg/2300}/>
              <MicroRow label="Vitamin D" 
                value={`${nutrition.vitamin_d_iu}IU`}
                daily="600IU" 
                pct={nutrition.vitamin_d_iu/600}/>
            </View>
          )}
          
          <View style={styles.portionRow}>
            {(['small', 'medium', 'large'] as const).map((p) => {
              const isPortionActive = activePortion === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.portionButton,
                    isPortionActive && styles.portionActive,
                  ]}
                  onPress={() => {
                    setPortion(p);
                    onConfirm(det, p);
                  }}
                >
                  <Text style={[
                    styles.portionText,
                    isPortionActive && styles.portionTextActive,
                  ]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.notInDbContainer}>
          <Text style={styles.notInDbText}>{det.message || "Not found in database"}</Text>
          {det.suggestions && det.suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Suggested database matches:</Text>
              {det.suggestions.map((sug: string, sIdx: number) => (
                <TouchableOpacity
                  key={sIdx}
                  style={styles.suggestionItem}
                  onPress={async () => {
                    try {
                      const data = await apiCall<{ foods: FoodSearchResult[] }>(
                        `/api/foods/search?q=${encodeURIComponent(sug)}`,
                        'GET', undefined, true
                      );
                      if (data && data.foods && data.foods.length > 0) {
                        const matched = data.foods[0];
                        const name = matched.Food_items || matched.food_items || sug;
                        onConfirm({
                          nutrition: {
                            food_name: name,
                            calories: matched.Calories || 0,
                            protein_g: matched.Proteins || 0,
                            carbs_g: matched.Carbohydrates || 0,
                            fats_g: matched.Fats || 0,
                            fibre_g: 0,
                            sugar_g: 0,
                            iron_mg: 0,
                            calcium_mg: 0,
                            sodium_mg: 0,
                            potassium_mg: 0,
                            vitamin_d_iu: 0,
                            VegNovVeg: matched.Veg_Flag === 0 ? "0" : "1"
                          },
                          confidence: det.confidence,
                          food_name: name
                        }, 'medium');
                      }
                    } catch (e) {
                      console.error("Failed to add suggestion:", e);
                    }
                  }}
                >
                  <Text style={styles.suggestionText}>{sug}</Text>
                  <Text style={styles.suggestionAddText}>+ Add</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.detectionActions}>
        <TouchableOpacity
          style={[styles.addButton, isConfirmed && styles.addButtonConfirmed]}
          onPress={() => onConfirm(det, activePortion)}
        >
          <Text style={styles.addButtonText}>
            {isConfirmed ? "✓ Added to meal" : "+ Add to meal"}
          </Text>
        </TouchableOpacity>
        {isConfirmed && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(displayName)}
          >
            <Text style={styles.removeButtonText}>✗ Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MacroPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.macroPill, { backgroundColor: color }]}>
      <Text style={styles.macroPillValue}>{value}</Text>
      <Text style={styles.macroPillLabel}>{label}</Text>
    </View>
  );
}

function MicroRow({ label, value, daily, pct }: { label: string; value: string; daily: string; pct: number }) {
  return (
    <View style={styles.microRow}>
      <Text style={styles.microLabel}>{label}</Text>
      <View style={styles.microBarWrap}>
        <View style={[
          styles.microBar,
          { 
            width: `${Math.min(100, pct * 100)}%`,
            backgroundColor: pct >= 0.5 ? "#1D9E75" : "#E24B4A"
          }
        ]}/>
      </View>
      <Text style={styles.microValue}>{value}</Text>
      <Text style={styles.microDaily}>/{daily}</Text>
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
    fontWeight: '700',
  },
  detectionRegion: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  macroPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroPillValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  macroPillLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  microsToggle: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  microsToggleText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '700',
  },
  microsGrid: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    gap: 10,
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  microLabel: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  microBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  microBar: {
    height: '100%',
    borderRadius: 3,
  },
  microValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'right',
  },
  microDaily: {
    width: 50,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
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
    backgroundColor: '#FFFFFF',
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
    fontWeight: '700',
  },
  detectionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  addButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonConfirmed: {
    backgroundColor: '#059669',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removeButton: {
    width: 80,
    height: 42,
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
  vegWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BA7517',
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  notInDbContainer: {
    marginBottom: 12,
  },
  notInDbText: {
    fontSize: 13,
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 12,
  },
  suggestionsContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  suggestionAddText: {
    fontSize: 12,
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
    textAlign: 'center',
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
    backgroundColor: '#FFFFFF',
  },
  manualEntryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D9E75',
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
  processingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  processingTimer: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1D9E75',
    marginTop: 15,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 25,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  demoBanner: {
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  demoBannerText: {
    fontSize: 12,
    color: "#92400E",
    textAlign: "center",
    fontWeight: '600',
  },
});

