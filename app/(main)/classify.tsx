import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
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

export default function ClassifyScreen() {
  const navigation = useNavigation();
  const { jobId, imageUri, editDocumentId } = useLocalSearchParams<{
    jobId: string;
    imageUri: string;
    editDocumentId?: string;
  }>();
  const { currentJob, documents, addDocument, updateDocument } = useJob();
  const [isSaving, setIsSaving] = useState(false);

  const decodedUri = imageUri ? decodeURIComponent(imageUri) : '';
  const isEditing = !!editDocumentId;

  const handleClassify = async (classification: DocumentClassification) => {
    if (!jobId || !decodedUri || isSaving || !currentJob) return;

    setIsSaving(true);

    let documentId: string;

    if (isEditing) {
      const updated = await JobService.updateDocument(
        jobId,
        editDocumentId,
        { imageUri: decodedUri, classification },
        currentJob.jobNumber,
        documents
      );
      if (!updated) { setIsSaving(false); return; }
      updateDocument(editDocumentId, {
        imageUri: updated.imageUri,
        classification: updated.classification,
        filename: updated.filename,
        timestamp: updated.timestamp,
      });
      documentId = editDocumentId;
    } else {
      const doc = await JobService.addDocument(
        jobId,
        decodedUri,
        classification,
        currentJob.jobNumber,
        documents
      );
      addDocument(doc);
      documentId = doc.id;
    }

    setIsSaving(false);

    // Reset the stack so back from confirmation goes to job detail (export),
    // not back through the capture pipeline
    navigation.dispatch(
      CommonActions.reset({
        index: 2,
        routes: [
          { name: 'index' },
          { name: 'export', params: { jobId } },
          { name: 'confirmation', params: { jobId, documentId } },
        ],
      })
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {decodedUri ? (
        <Image source={{ uri: decodedUri }} style={styles.preview} resizeMode="contain" />
      ) : null}

      <Text style={styles.heading}>Select Document Type</Text>

      {CLASSIFICATIONS.map(item => (
        <TouchableOpacity
          key={item.value}
          style={[styles.button, { backgroundColor: item.color }, isSaving && styles.buttonDisabled]}
          onPress={() => handleClassify(item.value)}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.buttonText,
            item.value === 'receipt' && styles.buttonTextDark,
          ]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
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
  },
  preview: {
    width: '100%',
    height: 250,
    borderRadius: borderRadius.large,
    marginBottom: spacing.lg,
    backgroundColor: colors.border,
  },
  heading: {
    fontSize: fontSize.xxlarge,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: touchTarget.minHeight * 1.5,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  buttonTextDark: {
    color: colors.textPrimary,
  },
});
