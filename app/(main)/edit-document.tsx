import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useJob } from '../../src/context/JobContext';
import { JobService } from '../../src/services/jobService';
import { DocumentClassification } from '../../src/types';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

const CLASSIFICATIONS: { label: string; value: DocumentClassification; color: string }[] = [
  { label: 'Bill of Lading', value: 'bill_of_lading', color: colors.info },
  { label: 'Proof of Delivery', value: 'proof_of_delivery', color: colors.success },
  { label: 'Receipt', value: 'receipt', color: colors.warning },
  { label: 'Inventory', value: 'inventory', color: colors.primary },
];

const CLASSIFICATION_LABELS: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  proof_of_delivery: 'Proof of Delivery',
  receipt: 'Receipt',
  inventory: 'Inventory',
};

export default function EditDocumentScreen() {
  const router = useRouter();
  const { jobId, documentId } = useLocalSearchParams<{ jobId: string; documentId: string }>();
  const { currentJob, documents, updateDocument } = useJob();
  const [isSaving, setIsSaving] = useState(false);

  const document = documents.find(d => d.id === documentId);

  if (!document || !currentJob) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const handleChangeClassification = async (classification: DocumentClassification) => {
    if (isSaving || classification === document.classification) return;

    setIsSaving(true);
    const updated = await JobService.updateDocument(
      jobId,
      documentId,
      { classification },
      currentJob.jobNumber,
      documents
    );
    if (updated) {
      updateDocument(documentId, {
        classification: updated.classification,
        filename: updated.filename,
        timestamp: updated.timestamp,
      });
    }
    setIsSaving(false);
    router.back();
  };

  const handleReplaceImage = () => {
    router.push(`/(main)/capture?jobId=${jobId}&editDocumentId=${documentId}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={{ uri: document.imageUri }} style={styles.preview} resizeMode="contain" />

      <View style={styles.infoCard}>
        <Text style={styles.currentLabel}>CURRENT TYPE</Text>
        <Text style={styles.currentValue}>
          {CLASSIFICATION_LABELS[document.classification] || document.classification}
        </Text>
        <Text style={styles.filenameLabel}>FILENAME</Text>
        <Text style={styles.filenameValue}>{document.filename}</Text>
      </View>

      <Text style={styles.sectionTitle}>CHANGE CLASSIFICATION</Text>

      {CLASSIFICATIONS.map(item => (
        <TouchableOpacity
          key={item.value}
          style={[
            styles.classButton,
            { backgroundColor: item.color },
            item.value === document.classification && styles.classButtonActive,
            isSaving && styles.classButtonDisabled,
          ]}
          onPress={() => handleChangeClassification(item.value)}
          disabled={isSaving || item.value === document.classification}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.classButtonText,
            item.value === 'receipt' && styles.classButtonTextDark,
          ]}>
            {item.label}
            {item.value === document.classification ? '  (current)' : ''}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.replaceButton}
        onPress={handleReplaceImage}
        activeOpacity={0.8}
      >
        <Text style={styles.replaceButtonText}>REPLACE IMAGE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    fontSize: fontSize.large,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.large,
    marginBottom: spacing.lg,
    backgroundColor: colors.border,
  },
  infoCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  currentLabel: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textDisabled,
    letterSpacing: 0.5,
  },
  currentValue: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.info,
    marginTop: spacing.xs,
  },
  filenameLabel: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textDisabled,
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  filenameValue: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  classButton: {
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: touchTarget.minHeight * 1.5,
    justifyContent: 'center',
  },
  classButtonActive: {
    opacity: 0.4,
  },
  classButtonDisabled: {
    opacity: 0.5,
  },
  classButtonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  classButtonTextDark: {
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  replaceButton: {
    backgroundColor: colors.backgroundDark,
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: touchTarget.minHeight * 1.5,
    justifyContent: 'center',
  },
  replaceButtonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
});
