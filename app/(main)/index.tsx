import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useJob } from '../../src/context/JobContext';
import { JobService } from '../../src/services/jobService';
import { Job } from '../../src/types';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

export default function HomeScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      'Delete Jobs',
      `Delete ${count} job${count !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await JobService.deleteJobs(Array.from(selectedIds));
            exitSelectionMode();
            loadJobs();
          },
        },
      ]
    );
  }, [selectedIds]);

  useLayoutEffect(() => {
    if (selectionMode) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={exitSelectionMode}
            style={styles.headerButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.headerCloseText}>{'\u2715'}</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            style={styles.headerButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[
              styles.headerTrashText,
              selectedIds.size === 0 && styles.headerTrashDisabled,
            ]}>{'\uD83D\uDDD1'}</Text>
          </TouchableOpacity>
        ),
        title: `${selectedIds.size} selected`,
      });
    } else {
      navigation.setOptions({
        headerLeft: undefined,
        headerRight: undefined,
        title: 'Jobs',
      });
    }
  }, [selectionMode, selectedIds, navigation, exitSelectionMode, handleDeleteSelected]);

  const handleOpenJob = (job: Job) => {
    startJob(job);
    router.push(`/(main)/export?jobId=${job.id}`);
  };

  const handleLongPress = (job: Job) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([job.id]));
    }
  };

  const toggleSelection = (jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const renderJob = ({ item }: { item: Job }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.jobCard, selectionMode && isSelected && styles.jobCardSelected]}
        onPress={() => selectionMode ? toggleSelection(item.id) : handleOpenJob(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
      >
        {selectionMode ? (
          <View style={styles.cardRow}>
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              {isSelected ? <Text style={styles.checkmark}>{'\u2713'}</Text> : null}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.jobNumber}>{item.jobNumber}</Text>
              <Text style={styles.jobMeta}>
                {item.documents.length} document{item.documents.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.jobDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.jobNumber}>{item.jobNumber}</Text>
            <Text style={styles.jobMeta}>
              {item.documents.length} document{item.documents.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.jobDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={item => item.id}
        renderItem={renderJob}
        extraData={selectionMode ? selectedIds : null}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No jobs yet</Text>
            <Text style={styles.emptyHint}>Tap "NEW JOB" to get started</Text>
          </View>
        }
      />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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
  jobCardSelected: {
    backgroundColor: '#FFF3ED',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.small,
    borderWidth: 2,
    borderColor: colors.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.textLight,
    fontSize: fontSize.medium,
    fontWeight: '700',
  },
  cardContent: {
    flex: 1,
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
  headerButton: {
    padding: spacing.sm,
    minWidth: touchTarget.minWidth,
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseText: {
    fontSize: fontSize.xlarge,
    color: colors.textLight,
    fontWeight: '700',
  },
  headerTrashText: {
    fontSize: fontSize.xxlarge,
  },
  headerTrashDisabled: {
    opacity: 0.3,
  },
});
