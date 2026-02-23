/**
 * Tests for src/context/AuthContext.tsx
 *
 * Level 1 (Unit):       login's pure validation — returns false for empty email
 *                       without touching AsyncStorage.
 *
 * Level 2 (Integration): AuthProvider + useAuth hook wired to mocked
 *                        AsyncStorage — checkSession, login, logout.
 *                        Key regression: checkSession error path must call
 *                        logger.error, not console.error.
 *
 * Level 3 (Acceptance): Full session persistence lifecycle — provider mounted
 *                       with stored session, assert state is restored.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from './AuthContext';
import { logger } from '../utils/logger';

// ─── Helper ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ─── Level 1: Unit Tests ─────────────────────────────────────────────────────

describe('Unit | AuthContext login validation', () => {
  it('returns false for an empty email without calling AsyncStorage.setItem', async () => {
    // Empty email must be rejected immediately — no storage write should occur.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returnValue!: boolean;
    await act(async () => {
      returnValue = await result.current.login('');
    });

    expect(returnValue).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns true for a valid email', async () => {
    // A non-empty email should proceed and return true on success.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returnValue!: boolean;
    await act(async () => {
      returnValue = await result.current.login('driver@example.com');
    });

    expect(returnValue).toBe(true);
  });
});

// ─── Level 2: Integration Tests ──────────────────────────────────────────────

describe('Integration | AuthContext', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('isLoading starts true and becomes false after checkSession completes', async () => {
    // Validates that the loading flag guards the auth check on mount.
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('checkSession restores isAuthenticated and driverEmail when session exists', async () => {
    // A stored session must be re-hydrated into context on mount, so the
    // driver does not need to log in again after an app restart.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ email: 'driver@test.com', timestamp: '2026-01-01T00:00:00.000Z' })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.driverEmail).toBe('driver@test.com');
  });

  it('checkSession calls logger.error when AsyncStorage.getItem throws', async () => {
    // Regression guard: the original code used console.error, bypassing the
    // logger and always printing to console in production. This must use
    // logger.error so MockTransport can suppress it in production builds.
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('Storage failure')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(logger.error as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining('checking session'),
      expect.any(Error)
    );
  });

  it('checkSession sets isLoading false even when AsyncStorage.getItem throws', async () => {
    // A storage error must not leave the app stuck on the loading screen.
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('Storage failure')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('login writes session JSON to @pegasus_session', async () => {
    // Validates the storage key and that the email is included in the payload.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('driver@example.com');
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@pegasus_session',
      expect.stringContaining('"email":"driver@example.com"')
    );
  });

  it('login sets isAuthenticated true and driverEmail in context', async () => {
    // State must reflect authentication immediately after a successful login.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('driver@example.com');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.driverEmail).toBe('driver@example.com');
  });

  it('logout removes @pegasus_session from AsyncStorage', async () => {
    // Validates that the storage key is cleared on logout so the next app
    // launch does not restore the session.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('driver@example.com');
    });
    await act(async () => {
      await result.current.logout();
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pegasus_session');
  });

  it('logout clears isAuthenticated and driverEmail', async () => {
    // After logout the auth guard must redirect to the login screen.
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('driver@example.com');
    });
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.driverEmail).toBe('');
  });
});

// ─── Level 3: Acceptance Tests ───────────────────────────────────────────────

describe('Acceptance | session persistence', () => {
  it('provider mounted with a stored session restores authentication', async () => {
    // End-to-end persistence check: simulates an app restart. The driver
    // logged in previously; the next mount should restore their session
    // without requiring them to log in again.
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ email: 'driver@restart.com', timestamp: '2026-01-01T00:00:00.000Z' })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.driverEmail).toBe('driver@restart.com');
  });

  it('provider mounted with no stored session stays unauthenticated', async () => {
    // No session in storage — driver must log in from scratch.
    // AsyncStorage.getItem returns null by default (jest.setup.js mock).
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.driverEmail).toBe('');
  });
});
