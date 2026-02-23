import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useJob } from '../../src/context/JobContext';
import { JobService } from '../../src/services/jobService';
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';

export default function CreateJobScreen() {
  const [jobNumber, setJobNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { startJob } = useJob();

  const handleCreate = async () => {
    if (!jobNumber.trim()) {
      Alert.alert('Error', 'Please enter a job name');
      return;
    }

    setIsCreating(true);
    const job = await JobService.createJob(jobNumber.trim());
    startJob(job);
    setIsCreating(false);
    router.push(`/(main)/capture?jobId=${job.id}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>JOB NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter job name"
            placeholderTextColor={colors.textDisabled}
            value={jobNumber}
            onChangeText={setJobNumber}
            autoCapitalize="characters"
            editable={!isCreating}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isCreating && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isCreating}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {isCreating ? 'CREATING...' : 'CREATE JOB'}
          </Text>
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
    padding: spacing.xl,
    flex: 1,
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    fontSize: fontSize.xlarge,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: touchTarget.minHeight,
    textAlign: 'center',
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: touchTarget.minHeight,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  buttonText: {
    fontSize: fontSize.xlarge,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 1,
  },
});
