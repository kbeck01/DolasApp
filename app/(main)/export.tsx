import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { useJob } from '../../src/context/JobContext';
import { JobService } from '../../src/services/jobService';
import { generateJobZip } from '../../src/utils/exportUtils';
import { logger } from '../../src/utils/logger';
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS } from '../../src/constants/classifications';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

export default function ExportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { currentJob, documents, renameJob, reloadJob, clearJob } = useJob();
  const [isBusy, setIsBusy] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      logger.logNavigation('ExportScreen');
      if (jobId) {
        reloadJob(jobId);
      }
    }, [jobId])
  );

  const job = currentJob;

  const handleStartEditing = () => {
    if (!job) return;
    setEditedName(job.jobNumber);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!job) return;
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== job.jobNumber) {
      await renameJob(job.id, trimmed);
    }
    setIsEditingName(false);
  };

  const generateCsvFile = async (): Promise<string> => {
    if (!job) throw new Error('No job loaded');
    const exportJob = { ...job, documents };
    const csv = JobService.generateCsvExport(exportJob);
    const filename = `pegasus_${job.jobNumber}_export.csv`;
    const file = new File(Paths.cache, filename);
    file.write(csv);
    return file.uri;
  };

  const handleEmailCsv = async () => {
    if (!job || isBusy) return;

    setIsBusy(true);
    try {
      const available = await MailComposer.isAvailableAsync();
      if (!available) {
        Alert.alert('Mail Unavailable', 'No email account is configured on this device.');
        return;
      }

      const uri = await generateCsvFile();
      logger.logExport(job.id, documents.length);

      await MailComposer.composeAsync({
        subject: `Pegasus Job ${job.jobNumber} Documents`,
        body: `Attached is the document export for Job ${job.jobNumber}.\n\n${documents.length} document(s) captured.`,
        attachments: [uri],
      });
    } catch (error) {
      logger.error('Email export failed', error);
      Alert.alert('Export Error', 'Could not open email composer. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleShare = async () => {
    if (!job || isBusy) return;

    setIsBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
        return;
      }

      const uri = await generateCsvFile();
      logger.logExport(job.id, documents.length);

      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        dialogTitle: `Pegasus Job ${job.jobNumber} Export`,
      });
    } catch (error) {
      logger.error('Share export failed', error);
      Alert.alert('Share Error', 'Could not open share sheet. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddDocument = () => {
    router.push(`/(main)/capture?jobId=${jobId}`);
  };

  const handleEditDocument = (documentId: string) => {
    router.push(`/(main)/edit-document?jobId=${jobId}&documentId=${documentId}`);
  };

  const handleDeleteJob = () => {
    if (!job) return;
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await JobService.deleteJob(job.id);
            clearJob();
            router.dismissAll();
          },
        },
      ]
    );
  };

  const handleExportZip = async () => {
    if (!job || isBusy) return;

    setIsBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
        return;
      }

      const exportJob = { ...job, documents };
      const zipUri = await generateJobZip(exportJob);
      logger.logExport(job.id, documents.length);

      await Sharing.shareAsync(zipUri, {
        mimeType: 'application/zip',
        dialogTitle: `Pegasus Job ${job.jobNumber} Export`,
      });
    } catch (error) {
      logger.error('Zip export failed', error);
      Alert.alert('Export Error', 'Could not create zip export. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDone = () => {
    clearJob();
    router.dismissAll();
  };

  if (!job) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading job...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.jobLabel}>JOB</Text>
          {isEditingName ? (
            <View style={styles.jobNameRow}>
              <TextInput
                ref={inputRef}
                style={styles.jobNameInput}
                value={editedName}
                onChangeText={setEditedName}
                onSubmitEditing={handleSaveName}
                onBlur={handleSaveName}
                autoFocus
                returnKeyType="done"
                selectTextOnFocus
              />
              <TouchableOpacity
                style={styles.editIconButton}
                onPress={handleSaveName}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.editIcon}>{'\u2713'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.jobNameRow}
              onPress={handleStartEditing}
              activeOpacity={0.7}
            >
              <Text style={styles.jobNumber}>{job.jobNumber}</Text>
              <Text style={styles.pencilIcon}>{'\u270F\uFE0F'}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {documents.length} document{documents.length !== 1 ? 's' : ''} captured
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>DOCUMENTS</Text>

        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No documents captured</Text>
          </View>
        ) : (
          documents.map((doc, index) => (
            <TouchableOpacity
              key={doc.id}
              style={[
                styles.docCard,
                { borderLeftColor: CLASSIFICATION_COLORS[doc.classification] || colors.info },
              ]}
              onPress={() => handleEditDocument(doc.id)}
              activeOpacity={0.8}
            >
              <View style={styles.docHeader}>
                <Text style={styles.docIndex}>{index + 1}</Text>
                <View style={[
                  styles.classificationBadge,
                  { backgroundColor: CLASSIFICATION_COLORS[doc.classification] || colors.info },
                ]}>
                  <Text style={[
                    styles.classificationText,
                    doc.classification === 'receipt' && styles.classificationTextDark,
                  ]}>
                    {CLASSIFICATION_LABELS[doc.classification] || doc.classification}
                  </Text>
                </View>
              </View>
              <Text style={styles.docFilename}>{doc.filename}</Text>
              <Text style={styles.docTimestamp}>
                {new Date(doc.timestamp).toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={styles.addDocButton}
          onPress={handleAddDocument}
          activeOpacity={0.8}
        >
          <Text style={styles.addDocText}>+ ADD DOCUMENT</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {isBusy ? (
          <View style={styles.busyIndicator}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.busyText}>Preparing export...</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, styles.emailButton, (isBusy || documents.length === 0) && styles.buttonDisabled]}
          onPress={handleEmailCsv}
          disabled={isBusy || documents.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>EMAIL CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.shareButton, (isBusy || documents.length === 0) && styles.buttonDisabled]}
          onPress={handleShare}
          disabled={isBusy || documents.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>SHARE / SAVE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.zipButton, (isBusy || documents.length === 0) && styles.buttonDisabled]}
          onPress={handleExportZip}
          disabled={isBusy || documents.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>EXPORT ZIP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.doneButton]}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>DONE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteJob}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteButtonText}>DELETE JOB</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  loadingText: {
    fontSize: fontSize.large,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  jobLabel: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textDisabled,
    letterSpacing: 1,
  },
  jobNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  jobNumber: {
    fontSize: fontSize.huge,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pencilIcon: {
    fontSize: fontSize.xlarge,
    marginLeft: spacing.sm,
  },
  jobNameInput: {
    fontSize: fontSize.huge,
    fontWeight: '700',
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.xs,
    minWidth: 120,
    textAlign: 'center',
  },
  editIconButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  editIcon: {
    fontSize: fontSize.xxlarge,
    color: colors.success,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: colors.backgroundDark,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  countText: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textLight,
  },
  sectionTitle: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.large,
    color: colors.textDisabled,
  },
  docCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  docIndex: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textDisabled,
    marginRight: spacing.md,
    minWidth: 28,
  },
  classificationBadge: {
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  classificationText: {
    fontSize: fontSize.large,
    fontWeight: '700',
    color: colors.textLight,
  },
  classificationTextDark: {
    color: colors.textPrimary,
  },
  docFilename: {
    fontSize: fontSize.large,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  docTimestamp: {
    fontSize: fontSize.large,
    color: colors.textDisabled,
    marginTop: spacing.xs,
  },
  addDocButton: {
    borderRadius: borderRadius.large,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  addDocText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  busyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  busyText: {
    fontSize: fontSize.medium,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  button: {
    borderRadius: borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emailButton: {
    backgroundColor: colors.info,
  },
  shareButton: {
    backgroundColor: colors.success,
  },
  zipButton: {
    backgroundColor: colors.purple,
  },
  doneButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: fontSize.medium,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
  deleteButton: {
    borderRadius: borderRadius.medium,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    fontSize: fontSize.medium,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 1,
  },
});
