import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useJob } from '../../src/context/JobContext';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

const CLASSIFICATION_LABELS: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  proof_of_delivery: 'Proof of Delivery',
  receipt: 'Receipt',
  inventory: 'Inventory',
};

export default function ConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobId, documentId } = useLocalSearchParams<{ jobId: string; documentId: string }>();
  const { documents } = useJob();

  const document = documents.find(d => d.id === documentId);

  if (!document) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const handleCaptureNext = () => {
    // Replace confirmation with capture so the pipeline doesn't accumulate
    // Stack becomes: [index, export, capture]
    router.replace(`/(main)/capture?jobId=${jobId}`);
  };

  const handleReturnToDetails = () => {
    // Go back to export (job detail) which is directly behind us after the stack reset
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        <Image source={{ uri: document.imageUri }} style={styles.thumbnail} resizeMode="contain" />

        <View style={styles.details}>
          <Text style={styles.classificationBadge}>
            {CLASSIFICATION_LABELS[document.classification] || document.classification}
          </Text>

          <Text style={styles.label}>FILENAME</Text>
          <Text style={styles.value}>{document.filename}</Text>

          <Text style={styles.label}>CAPTURED</Text>
          <Text style={styles.value}>{new Date(document.timestamp).toLocaleString()}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.captureNextButton]}
            onPress={handleCaptureNext}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>CAPTURE NEXT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.returnButton]}
            onPress={handleReturnToDetails}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>RETURN TO DETAILS</Text>
          </TouchableOpacity>
        </View>
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
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: fontSize.large,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.large,
    marginBottom: spacing.lg,
    backgroundColor: colors.border,
  },
  details: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  classificationBadge: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.info,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textDisabled,
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  value: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.md,
  },
  button: {
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: touchTarget.minHeight * 1.5,
    justifyContent: 'center',
  },
  captureNextButton: {
    backgroundColor: colors.primary,
  },
  returnButton: {
    backgroundColor: colors.success,
  },
  buttonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
});
