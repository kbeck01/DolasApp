import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';

import { useJob } from '../../src/context/JobContext';
import { logger } from '../../src/utils/logger';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

const IMAGES_DIR = 'pegasus_images';

// Exported for testing.
export function generateImageId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Exported for testing.
export async function copyImageToPermanentStorage(pickerUri: string): Promise<string> {
  const dir = new Directory(Paths.document, IMAGES_DIR);
  if (!dir.exists) {
    dir.create();
  }
  const imageId = generateImageId();
  const destFile = new File(Paths.document, `${IMAGES_DIR}/${imageId}.jpg`);
  const srcFile = new File(pickerUri);
  srcFile.copy(destFile);
  return destFile.uri;
}

export default function CaptureScreen() {
  const router = useRouter();
  const { jobId, editDocumentId } = useLocalSearchParams<{ jobId: string; editDocumentId?: string }>();
  const { currentJob, documents } = useJob();

  useFocusEffect(useCallback(() => { logger.logNavigation('CaptureScreen'); }, []));

  const handleImageSelected = async (pickerUri: string) => {
    try {
      const permanentUri = await copyImageToPermanentStorage(pickerUri);
      navigateToClassify(permanentUri);
    } catch (error) {
      logger.error('Failed to save image to permanent storage', error);
      Alert.alert('Save Failed', 'Could not save the image. Please try again.');
    }
  };

  const navigateToClassify = (uri: string) => {
    let url = `/(main)/classify?jobId=${jobId}&imageUri=${encodeURIComponent(uri)}`;
    if (editDocumentId) {
      url += `&editDocumentId=${editDocumentId}`;
    }
    router.push(url);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to capture documents.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleImageSelected(result.assets[0].uri);
    }
  };

  const handleChooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleImageSelected(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {currentJob ? (
          <View style={styles.jobBanner}>
            <Text style={styles.jobLabel}>Job {currentJob.jobNumber}</Text>
            <Text style={styles.docCount}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} captured
            </Text>
          </View>
        ) : null}

        <Text style={styles.heading}>Capture Document</Text>
        <Text style={styles.subheading}>Take a photo or choose from your gallery</Text>

        <TouchableOpacity
          style={[styles.button, styles.cameraButton]}
          onPress={handleTakePhoto}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>TAKE PHOTO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.libraryButton]}
          onPress={handleChooseFromLibrary}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>CHOOSE FROM GALLERY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  jobBanner: {
    backgroundColor: colors.backgroundDark,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  jobLabel: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
  },
  docCount: {
    fontSize: fontSize.large,
    color: colors.primaryLight,
    marginTop: spacing.xs,
  },
  heading: {
    fontSize: fontSize.xxlarge,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subheading: {
    fontSize: fontSize.large,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  button: {
    borderRadius: borderRadius.large,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    minHeight: touchTarget.minHeight * 2,
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: colors.primary,
  },
  libraryButton: {
    backgroundColor: colors.info,
  },
  buttonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
});
