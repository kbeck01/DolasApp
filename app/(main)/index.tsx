import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useJob } from '../../src/context/JobContext';
import { JobService } from '../../src/services/jobService';
import { Job } from '../../src/types';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

export default function HomeScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const router = useRouter();
  const { logout } = useAuth();
  const { startJob, clearJob } = useJob();

  useFocusEffect(
    useCallback(() => {
      clearJob();
      loadJobs();
    }, [])
  );

  const loadJobs = async () => {
    const data = await JobService.getJobs();
    setJobs(data);
  };

  const handleOpenJob = (job: Job) => {
    startJob(job);
    router.push(`/(main)/export?jobId=${job.id}`);
  };

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => handleOpenJob(item)}
      activeOpacity={0.8}
    >
      <Text style={styles.jobNumber}>{item.jobNumber}</Text>
      <Text style={styles.jobMeta}>
        {item.documents.length} document{item.documents.length !== 1 ? 's' : ''}
      </Text>
      <Text style={styles.jobDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={item => item.id}
        renderItem={renderJob}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No jobs yet</Text>
            <Text style={styles.emptyHint}>Tap "NEW JOB" to get started</Text>
          </View>
        }
      />
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newJobButton}
          onPress={() => router.push('/(main)/create-job')}
          activeOpacity={0.8}
        >
          <Text style={styles.newJobText}>NEW JOB</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>LOG OUT</Text>
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
  list: {
    padding: spacing.md,
    flexGrow: 1,
  },
  jobCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  jobNumber: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  jobMeta: {
    fontSize: fontSize.large,
    color: colors.textSecondary,
  },
  jobDate: {
    fontSize: fontSize.large,
    color: colors.textDisabled,
    marginTop: spacing.xs,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: fontSize.xxlarge,
    fontWeight: '700',
    color: colors.textDisabled,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: fontSize.large,
    color: colors.textDisabled,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  newJobButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  newJobText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
  logoutButton: {
    backgroundColor: colors.backgroundDark,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textLight,
  },
});
