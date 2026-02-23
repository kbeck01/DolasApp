import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import { useJob } from '../../src/context/JobContext';
import { JobService } from '../../src/services/jobService';
import { logger } from '../../src/utils/logger';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

const CLASSIFICATION_LABELS: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  proof_of_delivery: 'Proof of Delivery',
  receipt: 'Receipt',
  inventory: 'Inventory',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  bill_of_lading: colors.info,
  proof_of_delivery: colors.success,
  receipt: colors.warning,
  inventory: colors.primary,
};

export default function ExportScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { currentJob, documents, startJob, clearJob } = useJob();
  const [csvFileUri, setCsvFileUri] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!currentJob && jobId) {
      loadJob();
    }
  }, []);

  const loadJob = async () => {
    const data = await JobService.getJobById(jobId!);
    if (data) startJob(data);
  };

  const job = currentJob;

  const ensureCsvFile = async (): Promise<string> => {
    if (csvFileUri) return csvFileUri;
    if (!job) throw new Error('No job loaded');

    const exportJob = { ...job, documents };
    const csv = JobService.generateCsvExport(exportJob);
    const filename = `pegasus_${job.jobNumber}_export.csv`;
    const file = new File(Paths.cache, filename);
    file.write(csv);
    setCsvFileUri(file.uri);
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

      const uri = await ensureCsvFile();
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

      const uri = await ensureCsvFile();
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

  const handleDone = () => {
    clearJob();
    router.replace('/(main)');
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
          <Text style={styles.jobNumber}>{job.jobNumber}</Text>
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
            <View
              key={doc.id}
              style={[
                styles.docCard,
                { borderLeftColor: CLASSIFICATION_COLORS[doc.classification] || colors.info },
              ]}
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
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
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
          style={[styles.button, styles.doneButton]}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>DONE</Text>
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
  jobNumber: {
    fontSize: fontSize.huge,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
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
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  busyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  busyText: {
    fontSize: fontSize.large,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  button: {
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: touchTarget.minHeight * 1.5,
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
  doneButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
});
