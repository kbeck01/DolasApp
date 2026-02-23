import { Stack } from 'expo-router';
import { JobProvider } from '../../src/context/JobContext';
import { colors } from '../../src/theme/colors';

export default function MainLayout() {
  return (
    <JobProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.backgroundDark },
          headerTintColor: colors.textLight,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Jobs', headerBackVisible: false }} />
        <Stack.Screen name="create-job" options={{ title: 'New Job' }} />
        <Stack.Screen name="capture" options={{ title: 'Capture Document' }} />
        <Stack.Screen name="classify" options={{ title: 'Classify Document' }} />
        <Stack.Screen name="confirmation" options={{ title: 'Confirmation' }} />
        <Stack.Screen name="export" options={{ title: 'Job Detail' }} />
        <Stack.Screen name="edit-document" options={{ title: 'Edit Document' }} />
      </Stack>
    </JobProvider>
  );
}
