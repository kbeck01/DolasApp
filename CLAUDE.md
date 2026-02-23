# CLAUDE.md — Pegasus App Persistent Instruction Set

This file is the authoritative reference for all AI-assisted development on this project.
If you are a new Claude session with no prior context, read this file entirely before touching any code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [App Structure](#3-app-structure)
4. [Known Limitations and Intentionally Unimplemented Features](#4-known-limitations-and-intentionally-unimplemented-features)
5. [Coding Standards](#5-coding-standards)
6. [Testing Requirements](#6-testing-requirements)
7. [Git Commit Protocol](#7-git-commit-protocol)
8. [Change Protocol](#8-change-protocol)
9. [Expo and React Native Specifics](#9-expo-and-react-native-specifics)
10. [Known Issues and Technical Debt](#10-known-issues-and-technical-debt)
11. [Keeping CLAUDE.md Current](#11-keeping-claudemd-current)

---

## 1. Project Overview

**App name (display):** Moving & Storage Driver
**Internal name:** Pegasus
**Bundle ID:** `com.movingstorage.driverapp`
**Expo slug:** `moving-storage-driver`

### What It Is

Pegasus is a mobile document capture and logging tool built for truck drivers and logistics workers. The app allows a driver to create a named "job" (identified by a job number), photograph delivery-related documents at a job site, classify each document by type, and then export the full job log as a CSV file — either by email or via the native OS share sheet.

The app is entirely **local-first**: all data is stored on the device using AsyncStorage and the device filesystem. There is no backend server, no cloud sync, and no user account system (authentication is a local email-only session, not verified against any server).

### Who It Is For

Drivers employed by moving and storage companies. The UI is designed for field use: high-contrast colors, minimum 48px touch targets, and minimum 18pt font sizes throughout. Assume the user is working outdoors, possibly wearing gloves, and needs to complete the flow quickly.

### Core Workflow

1. Driver opens the app and enters their email to begin a local session.
2. Driver creates a new **job** by entering a job name or number.
3. Driver captures one or more documents using the device camera or photo library.
4. Each document is **classified** as one of four types:
   - `bill_of_lading`
   - `proof_of_delivery`
   - `receipt`
   - `inventory`
5. Driver reviews the job, can rename it, add more documents, or edit/delete individual documents.
6. Driver **exports** the job as a CSV file (via email or share sheet).
7. Driver returns to the jobs list to start a new job or review past jobs.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React Native | 0.81.5 |
| Runtime | React | 19.1.0 |
| SDK | Expo | ~54.0.30 |
| Routing | Expo Router | ~6.0.21 |
| Language | TypeScript | ~5.9.2 |
| Local persistence | @react-native-async-storage/async-storage | 2.2.0 |
| Camera / gallery | expo-image-picker | ~17.0.10 |
| Filesystem | expo-file-system | ~19.0.21 (class-based v19 API) |
| Email export | expo-mail-composer | ~15.0.8 |
| Share sheet | expo-sharing | ~14.0.8 |
| Zip archive | jszip | ^3.10.1 |
| Safe area | react-native-safe-area-context | ~5.6.0 |
| Screen transitions | react-native-screens | ~4.16.0 |
| Testing | Jest | ^29.7.0 |
| Testing | @testing-library/react-native | ^13.3.3 |
| Build / deploy | EAS (Expo Application Services) | CLI >= 13.2.0 |

**React Native New Architecture** is enabled (`newArchEnabled: true` in app.json).

**TypeScript strict mode** is enabled (`"strict": true` in tsconfig.json, extending `expo/tsconfig.base`).

**No path aliases** are configured in tsconfig.json. The `@/` alias in `jest.config.js` maps to `src/` for tests only and is not available in source files. All imports use relative paths.

---

## 3. App Structure

```
Pegasus-App/
├── app/                        Expo Router screens and layouts (file-system routing)
│   ├── _layout.tsx             Root layout: wraps everything in AuthProvider, enforces auth guard
│   ├── +not-found.tsx          404 catch-all for unmatched routes
│   ├── (auth)/                 Route group: unauthenticated screens
│   │   ├── _layout.tsx         Auth group Stack (no header)
│   │   └── login.tsx           Email-only login screen (local session, not server-verified)
│   └── (main)/                 Route group: authenticated app screens
│       ├── _layout.tsx         Main Stack with styled headers, wraps all screens in JobProvider
│       ├── index.tsx           Jobs list (home screen) — multi-select delete, tap to open
│       ├── create-job.tsx      New job creation — enter job name/number
│       ├── capture.tsx         Document capture — take photo or select from gallery
│       ├── classify.tsx        Document classification — select one of four types
│       ├── confirmation.tsx    Post-classification confirmation — shows thumbnail + metadata
│       ├── export.tsx          Job detail + export — rename, add docs, delete, email/share CSV
│       └── edit-document.tsx   Edit a single document — reclassify, replace image, or delete
│
├── src/
│   ├── context/
│   │   ├── AuthContext.tsx     Auth state: isAuthenticated, isLoading, driverEmail; login/logout
│   │   └── JobContext.tsx      Current job state: currentJob, documents; all in-session mutations
│   ├── constants/
│   │   └── classifications.ts  CLASSIFICATIONS array, CLASSIFICATION_LABELS and _COLORS records
│   ├── services/
│   │   └── jobService.ts       All AsyncStorage CRUD operations and CSV generation (static class)
│   ├── theme/
│   │   └── colors.ts           Design tokens: colors, spacing, fontSize, borderRadius, touchTarget
│   ├── types/
│   │   └── index.ts            TypeScript interfaces: Job, Document; type: DocumentClassification
│   └── utils/
│       ├── exportUtils.ts      generateJobZip(job): builds zip (CSV + images/), writes to Paths.cache
│       └── logger.ts           Logger singleton with ConsoleTransport (dev) / MockTransport (prod)
│
├── assets/                     Static image assets (icon, splash, favicon, adaptive icon)
├── docs/                       Static HTML documentation page
├── App.tsx                     Vestigial stub — renders static image; only used by App.test.tsx
├── App.test.tsx                 The only existing test file (covers App.tsx stub only)
├── index.ts                    Registers App.tsx via registerRootComponent (never run — see §4)
├── jest.config.js              Jest configuration
├── jest.setup.js               Global mocks for all native/Expo modules
├── app.json                    Expo app configuration
├── eas.json                    EAS build and submit configuration
├── babel.config.js             Babel config (babel-preset-expo + @babel/preset-typescript)
├── tsconfig.json               TypeScript config (strict mode, extends expo/tsconfig.base)
└── package.json                Project manifest
```

### Route Map

| Route | Screen Component | Purpose |
|---|---|---|
| `/(auth)/login` | `LoginScreen` | Email entry; calls `login(email)` from AuthContext |
| `/(main)` | `HomeScreen` | Jobs list; multi-select; tap to open job |
| `/(main)/create-job` | `CreateJobScreen` | Single input: job name/number |
| `/(main)/capture` | `CaptureScreen` | Camera or gallery image picker |
| `/(main)/classify` | `ClassifyScreen` | Four classification buttons |
| `/(main)/confirmation` | `ConfirmationScreen` | Document saved confirmation |
| `/(main)/export` | `ExportScreen` | Job detail, rename, export CSV |
| `/(main)/edit-document` | `EditDocumentScreen` | Edit/reclassify/replace/delete a document |

### Navigation Patterns (Expo Router)

- `router.push(url)` — forward navigation, adds to stack
- `router.replace(url)` — replaces current screen (used for auth redirects and "Capture Next")
- `router.back()` — simple back
- `router.dismissAll()` — pop entire stack (used after job done/deleted)
- `navigation.dispatch(CommonActions.reset({...}))` — full stack rebuild (used in `classify.tsx` after saving a document to ensure back-navigation from confirmation goes to job detail, not back through the classification pipeline)

### Data Flow

**AsyncStorage keys:**
- `@pegasus_session` — stores `{ email: string, timestamp: string }` as JSON
- `@pegasus_jobs` — stores the entire `Job[]` array (each `Job` embeds its `Document[]`) as JSON

**Context responsibilities:**
- `AuthContext` — holds session state; reads/writes `@pegasus_session`
- `JobContext` — holds the currently active job in memory; delegates all persistence to `JobService`
- `JobService` — the single source of truth for all reads/writes to `@pegasus_jobs`; performs a full read-mutate-write cycle on every operation

**Query parameters used by screens:**

| Screen | Params |
|---|---|
| `capture.tsx` | `jobId` (required), `editDocumentId` (optional — signals image replacement mode) |
| `classify.tsx` | `jobId`, `imageUri` (URI-encoded), `editDocumentId` (optional) |
| `confirmation.tsx` | `jobId`, `documentId` |
| `export.tsx` | `jobId` |
| `edit-document.tsx` | `jobId`, `documentId` |

---

## 4. Known Limitations and Intentionally Unimplemented Features

### Architecture Decisions (Intentional)

- **No backend.** All data lives on the device. There is no API, no cloud sync, no remote auth. This is intentional for the MVP.
- **Local-only auth.** Login stores an email in AsyncStorage. It is not verified against any server. This is a "who is using this device" identifier, not real authentication.
- **Image persistence is implemented.** After capture, images are copied to `FileSystem.documentDirectory/pegasus_images/` before the URI is passed to classify.tsx. See §9 for the hard rule and implementation details.
- **Single JSON blob persistence.** All jobs and all embedded documents are stored as one JSON string in AsyncStorage. This is fine for an MVP with small document counts but will not scale well to hundreds of jobs.
- **No analytics.** `MockTransport` in the logger is a placeholder for Sentry or equivalent. Not wired up.
- **No push notifications.**
- **No OTA updates configured.**

### Known Bugs / Technical Debt (Do Not Work Around — Fix Directly)

See §10 for the complete list.

### Unused Permissions (Must Be Cleaned Up Before Play Store Submission)

The following permissions are declared in `app.json` but **not used anywhere in the codebase**. Do not add code to use them without an explicit feature request. Remove them before submitting to stores:

- `NSLocationWhenInUseUsageDescription` (iOS)
- `ACCESS_FINE_LOCATION` (Android)
- `ACCESS_COARSE_LOCATION` (Android)
- `RECORD_AUDIO` (Android)

### EAS Submission Placeholders

`eas.json` contains placeholder values that must be filled before any iOS store submission:
- `appleId`: currently `"steve@yourcompany.com"`
- `ascAppId`: currently `"PLACEHOLDER"`
- `appleTeamId`: currently `"PLACEHOLDER"`

---

## 5. Coding Standards

### TypeScript

- **Always use TypeScript with strict typing.** The project has `"strict": true` in tsconfig. Do not disable or relax this.
- **No `any` types** without an explicit inline comment justifying why the type cannot be known at compile time. Format: `// eslint-disable-next-line @typescript-eslint/no-explicit-any — <reason>`
- Use the types defined in `src/types/index.ts` (`Job`, `Document`, `DocumentClassification`) everywhere. Do not redefine or inline equivalent types.
- New shared types go in `src/types/index.ts`.
- Screen-local types (e.g., a prop shape used only in one file) may be defined at the top of that file.

### Component Rules

- **Functional components only.** No class components, ever.
- All screen components are `export default function PascalCaseScreen() {...}`. Not arrow functions.
- All layout components follow the same pattern.
- Non-screen components (shared UI) go in `src/components/` (directory does not yet exist — create it when the first shared component is needed).

### File and Directory Conventions

| What | Where | Naming |
|---|---|---|
| Screen files | `app/(auth)/` or `app/(main)/` | `kebab-case.tsx` |
| Layout files | `app/` (any level) | `_layout.tsx` |
| Shared components | `src/components/` | `PascalCase.tsx` |
| Context files | `src/context/` | `PascalCaseContext.tsx` |
| Service files | `src/services/` | `camelCaseService.ts` |
| Hook files | `src/hooks/` | `useHookName.ts` |
| Utility files | `src/utils/` | `camelCase.ts` |
| Type definitions | `src/types/index.ts` | (all in one file unless it grows large) |
| Theme / design tokens | `src/theme/` | `camelCase.ts` |
| Test files | Co-located with source | `SourceFile.test.tsx` or `SourceFile.test.ts` |

**All new files must have a corresponding test file** created at the same time.

### Naming Conventions

**Components:** `PascalCase` with suffix that describes role (`Screen`, `Context`, `Provider`, `Layout`).
Examples: `HomeScreen`, `AuthContext`, `JobProvider`, `MainLayout`

**Functions:** `camelCase`. Event handlers prefixed with `handle`: `handleLogin`, `handleDeleteJob`, `handleTakePhoto`.

**Hooks:** `camelCase` with `use` prefix: `useAuth`, `useJob`.

**Boolean state/props:** prefixed with `is` or `has`: `isLoading`, `isAuthenticated`, `isBusy`, `isSaving`, `isEditingName`, `selectionMode` (exception: `selectionMode` is an existing pattern — do not rename it).

**Service classes:** `PascalCase` with `Service` suffix. Methods are all static. Do not instantiate: `JobService.getJobs()`, never `new JobService()`.

**Constants (module-level):** `SCREAMING_SNAKE_CASE` for true constants: `CLASSIFICATIONS`, `CLASSIFICATION_LABELS`.

**AsyncStorage keys:** prefixed with `@pegasus_`: `@pegasus_session`, `@pegasus_jobs`.

**StyleSheet keys:** `camelCase`, following the pattern: `container`, `content`, `header`, `footer`, `button`, `buttonText`, `buttonDisabled`, `label`, `value`.

### Import Ordering

Always follow this order, with a blank line between each group:

```typescript
// 1. React
import React, { useState, useCallback, useEffect } from 'react';

// 2. React Native core
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';

// 3. Expo Router
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';

// 4. Third-party libraries (Expo SDK, safe-area, etc.)
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

// 5. Internal: contexts
import { useJob } from '../../src/context/JobContext';
import { useAuth } from '../../src/context/AuthContext';

// 6. Internal: services
import { JobService } from '../../src/services/jobService';

// 7. Internal: constants
import { CLASSIFICATIONS, CLASSIFICATION_LABELS } from '../../src/constants/classifications';

// 8. Internal: utilities
import { logger } from '../../src/utils/logger';

// 9. Internal: types
import type { Job, Document, DocumentClassification } from '../../src/types';

// 10. Internal: theme
import { colors, fontSize, spacing, borderRadius, touchTarget } from '../../src/theme/colors';
```

All imports use **relative paths**. The `@/` alias is available in tests only (via `jest.config.js`) and must not be used in source files.

Namespace imports (`* as Name`) are used for: `expo-image-picker` (`* as ImagePicker`), `expo-mail-composer` (`* as MailComposer`), `expo-sharing` (`* as Sharing`). Do not change this pattern.

### String Constants

- **All user-facing strings must be defined as constants, not hardcoded inline.**
- AsyncStorage keys are module-level `const` strings at the top of the file that uses them.
- Classification constants (`CLASSIFICATIONS`, `CLASSIFICATION_LABELS`, `CLASSIFICATION_COLORS`) live in `src/constants/classifications.ts`. Import from there. Do not re-define these inline in any screen file.
- Alert messages, button labels, placeholder text, and header titles that appear in more than one file must be extracted to a constants file.
- One-off strings that appear exactly once in a leaf component may remain inline, but group them at the top of the component function as named constants rather than burying them in JSX.

**Previously duplicated, now resolved:** `CLASSIFICATIONS`, `CLASSIFICATION_LABELS`, and `CLASSIFICATION_COLORS` were copy-pasted across four screen files. They now live exclusively in `src/constants/classifications.ts`. Do not re-introduce inline copies in screen files.

### Theme Usage

- All colors must come from `src/theme/colors.ts`. The only exceptions are `rgba()` variants that cannot be expressed as hex tokens — these must be added to the theme file, not left inline.
- Two known violations exist (see §10). Fix them rather than adding more.
- Do not introduce new color tokens without a concrete use — the seven legacy status/shadow tokens (`pending`, `inTransit`, `delivered`, `cancelled`, `primaryDark`, `shadow`, `borderDark`) were removed in chore(colors) after being confirmed unused.
- All spacing, font sizes, border radii, and touch targets must use the exported design tokens.

---

## 6. Testing Requirements

Every change, no matter how small, must pass through all three levels before being considered complete. **Never skip a level.**

### Level 1: Unit Tests

Test individual functions and pure logic in complete isolation. No React rendering, no file I/O, no AsyncStorage.

What to unit test:
- All functions in `src/services/jobService.ts`: `createJob`, `addDocument`, `updateDocument`, `deleteDocument`, `renameJob`, `deleteJob`, `deleteJobs`, `formatTimestampLocal`, `generateCsvExport`, `generateId` (via its observable effects)
- All functions in `src/utils/logger.ts`: transport selection based on env, each log level, each breadcrumb helper
- Any new utility functions added to `src/utils/`
- Any pure data transformation logic

Document what each test validates and why. Example:
```typescript
// Validates that generateCsvExport produces the correct header row,
// because the CSV header is the contract between this app and downstream tools.
it('generates CSV with correct header row', () => { ... });
```

Mock AsyncStorage for all jobService tests using the mock already registered in `jest.setup.js`.

### Level 2: Integration Tests

Test that components interact correctly with context and that context interacts correctly with AsyncStorage. Mount real components with mocked native modules.

What to integration test:
- `AuthContext`: login writes to AsyncStorage, logout removes it, checkSession restores state on mount
- `JobContext`: startJob populates documents, addDocument appends and updates currentJob, deleteDocument removes and updates state
- Screen + context wiring: `HomeScreen` renders jobs from `JobService`, `ExportScreen` reflects state changes after rename, `CreateJobScreen` calls `JobService.createJob` and `startJob`

Use `@testing-library/react-native`. Wrap components under test in the appropriate providers.

Mock AsyncStorage using the jest.setup.js global mock. Assert on AsyncStorage.setItem call arguments to verify persistence contracts.

If a unit test reveals a logic error, **fix it and re-run the unit test before proceeding to integration tests.**

### Level 3: Acceptance Tests

Test complete user flows end-to-end from the user's perspective. Test that the full sequence produces the expected outcome.

Required acceptance tests for core flows:

1. **Full document capture flow:** Create job → Capture (mock image picker) → Classify → Confirm → Check that job in AsyncStorage has one document with correct classification and auto-generated filename.

2. **CSV export content:** Create job → Add two documents with different classifications → Call `generateCsvExport` → Assert CSV contains correct header, correct rows, correct timestamp format, correct filenames.

3. **Multi-select delete:** Load three jobs → Activate selection mode via long press → Select two → Delete → Assert only one job remains in AsyncStorage.

4. **Edit flow:** Load job with one document → Navigate to edit-document → Change classification → Assert document in AsyncStorage has updated classification and recalculated filename.

5. **Session persistence:** Call login → Simulate app restart (remount AuthProvider) → Assert `isAuthenticated` is true and `driverEmail` matches.

If a change touches a flow not covered above, write the acceptance test for that flow before marking the change complete.

---

## 7. Git Commit Protocol

### Atomicity Rule

Every discrete change must be committed separately. **Never batch unrelated changes into one commit.**

- A single bug fix is one commit.
- A single new component is one commit.
- A new test file for an existing component is one commit.
- A refactor of one module is one commit.
- If you find yourself writing "and" in the commit subject, split the commit.

### Commit Message Format

```
<type>(<scope>): <short description in present tense, imperative mood>

<body>
Explain what changed and exactly why, as if writing to a future developer
who has never seen this codebase. Reference specific function names, file
paths, and the reasoning behind decisions. Do not just describe the diff —
explain the intent.

<footer>
Note any side effects, files affected beyond the obvious, or follow-up
work needed. Example: "Side effect: export.tsx must be updated to use the
new shared constant when CLASSIFICATION_LABELS is extracted."
```

**Types:**
- `feat` — new user-facing feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `chore` — dependency updates, config changes, build scripts
- `docs` — documentation changes only

**Scope:** the primary file or module affected, without extension. Examples: `jobService`, `export`, `classify`, `AuthContext`, `colors`

**Before committing:** state out loud what the commit will contain and why, so the developer can confirm before it's made.

**Never commit broken code.** If a change is incomplete, use:
```
WIP: <type>(<scope>): <description>

Incomplete because: <explain what remains to be done>
Do not merge. Do not deploy.
```

### Example Well-Formed Commit

```
fix(jobService): prevent filename collision when same classification added twice

The filename generation in addDocument used existingDocuments.length + 1 as
the suffix, but this counts all document types rather than only the same
classification. For a job with one proof_of_delivery and one bill_of_lading,
adding a second proof_of_delivery would generate _2.jpg because length is 2,
not _2.jpg based on the count of that specific type.

Changed to filter existingDocuments by classification before counting, so the
suffix always reflects how many of that type already exist.

Side effect: updateDocument also recalculates filename on classification change
using the same count logic — that path already filtered by classification
correctly, but the comment has been updated to make the intent explicit.
```

---

## 8. Change Protocol

### Before Making Any Change

State clearly:
1. What you are about to do
2. Which specific files will be affected (list every file)
3. Why — what problem it solves or what requirement it meets

### After Making a Change

Summarize:
1. What was changed (specific functions, lines, logic)
2. What was tested and what the results were
3. What the commit will contain

### Pause and Confirm Rule

**If a requested change would affect more than 3 files, or touches navigation structure or context/state management, pause and ask for confirmation before proceeding.**

Navigation and state changes have cascading effects that are easy to break and hard to debug. Get explicit approval before touching:
- Any `_layout.tsx` file
- `AuthContext.tsx` or `JobContext.tsx`
- The auth guard logic in `app/_layout.tsx`
- The stack reset in `classify.tsx`
- Any change that adds, removes, or renames a route

### Deletion and Refactoring Rule

**Never delete or refactor existing working code without explicitly flagging it and explaining why.**

Before removing any function, component, or file:
- Confirm it is not referenced anywhere (run a codebase-wide search)
- State what it was doing and why it is no longer needed
- List every file that will change as a result

---

## 9. Expo and React Native Specifics

### Safe Area Insets

Always use `useSafeAreaInsets()` for bottom padding on screens that have fixed bottom buttons or footers. Do not hardcode bottom padding values.

```typescript
const insets = useSafeAreaInsets();
// ...
<View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
```

This is especially critical on iPhone (home indicator) and Android edge-to-edge (`edgeToEdgeEnabled: true` in app.json).

### Navigation

All navigation must use **Expo Router** conventions. Never import directly from `@react-navigation/native` for navigation actions — use `useRouter` from `expo-router`. The one exception is `CommonActions.reset` for stack rebuilds, which requires the `@react-navigation/native` import pattern already established in `classify.tsx`.

### Image Storage (Hard Rule)

**Images captured via `expo-image-picker` must be copied to `FileSystem.documentDirectory` immediately after selection, before the URI is stored in AsyncStorage.**

Picker-assigned `file://` URIs are temporary and may be invalidated by the OS when the cache is cleared. The persistent path format is:

```typescript
import { File, Directory, Paths } from 'expo-file-system';

// In capture.tsx — copyImageToPermanentStorage():
const dir = new Directory(Paths.document, 'pegasus_images');
if (!dir.exists) {
  dir.create();
}
const destFile = new File(Paths.document, `pegasus_images/${imageId}.jpg`);
const srcFile = new File(pickerUri);
srcFile.copy(destFile);
return destFile.uri; // permanent URI passed to classify.tsx
```

**Current state:** Implemented in `app/(main)/capture.tsx` via `copyImageToPermanentStorage()`. Called inside `handleImageSelected()`, which both picker handlers delegate to. The raw picker URI never reaches `classify.tsx` — only the permanent URI does. If the copy fails, an alert is shown and navigation is blocked. Covered by 20 tests in `app/(main)/capture.test.tsx`.

**CSV files (temp, intentional):** The generated CSV export is written to `Paths.cache` in `export.tsx`. This is correct and intentional — CSV files are ephemeral, generated on demand for sharing. Do not move them to document directory.

### AsyncStorage Persistence

**AsyncStorage must be updated immediately and synchronously with every state change.** Never defer a persistence write. The pattern is: write to AsyncStorage first (in the service), then update React state (in the context). If the AsyncStorage write fails, do not update state.

This is the existing pattern in `JobService` — every mutation method reads-mutates-writes before returning. Maintain this pattern.

### After Navigation Structure Changes

Always run `npx expo start --clear` after any change to:
- `_layout.tsx` files
- The route group folder names `(auth)` or `(main)`
- Adding or removing screen files from `app/`
- Changes to `app.json` plugins or scheme

Metro's cache does not reliably detect layout-level changes. Failing to clear it produces confusing routing behavior.

### expo-file-system API Version

This project uses **expo-file-system v19**, which uses a class-based API:

```typescript
import { File, Paths } from 'expo-file-system';

const file = new File(Paths.cache, 'filename.csv');
file.write(content);      // synchronous for text
const uri = file.uri;
```

Do **not** use the legacy functional API (`FileSystem.writeAsStringAsync`, `FileSystem.documentDirectory` as a string). The v19 class-based API is the only correct usage in this project.

### Permissions

Request permissions immediately before the action that requires them — not on screen mount. This is the existing pattern in `capture.tsx` (permission requested in `handleTakePhoto` and `handleChooseFromGallery`, not in `useEffect`).

---

## 10. Known Issues and Technical Debt

This section tracks existing problems. When working on a related feature, fix the relevant issue as part of that work rather than creating new technical debt around it.

### Technical Debt: Vestigial App.tsx / index.ts

**Location:** `App.tsx`, `index.ts`
**Problem:** `package.json` sets `"main": "expo-router/entry"`, so Expo Router handles the real entry point. `index.ts` and `App.tsx` are never executed by the running app. They exist only as the compilation target for `App.test.tsx`. This is misleading.
**Current stance:** Leave in place — removing them would break the only existing test. When a proper test infrastructure is established (tests for actual screens), migrate `App.test.tsx` and then delete these files.

### Technical Debt: Two Hardcoded Colors Outside Theme

**Location 1:** `app/(main)/index.tsx` line ~220 — `'#FFF3ED'` (selected card background)
**Location 2:** `app/(auth)/login.tsx` line ~153 — `'rgba(255, 255, 255, 0.1)'` (hint text background)
**Fix required:** Add named tokens to `colors.ts` and replace inline values.

### Compliance: Unused Permissions in app.json

**See §4.** Must be removed before Play Store or App Store submission.

### Compliance: EAS Placeholder Values

**See §4.** Must be filled before iOS submission.

---

## 11. Keeping CLAUDE.md Current

CLAUDE.md is only useful if it stays accurate. An outdated instruction set is worse than none — it will cause a future session to make decisions based on false information about the codebase.

### The Core Rule

**CLAUDE.md must be updated in the same PR/commit batch as the change that makes it outdated.** Do not defer documentation updates. Do not open a follow-up ticket. If the code changed, the documentation changes with it.

### Triggers That Always Require a CLAUDE.md Update

The following events require a corresponding CLAUDE.md update without exception:

- **A new screen is added or removed from `app/`** — update the App Structure directory listing and the Route Map table in §3. Include the screen component name, file path, and purpose.

- **A new library is added or removed** — update the Tech Stack table in §2 with the exact package name and version. If it is removed, delete its row entirely — do not leave stale entries.

- **A known issue from §10 is resolved** — remove the entry from §10. If the fix introduced a new pattern or convention, add that to the appropriate section (e.g., §5 or §9). Do not leave resolved issues in the list "for historical reference" — that is what git history is for.

- **A new known issue or technical debt is discovered during work** — add it to §10 immediately, in the same commit batch as the work that uncovered it. Do not defer. The format is:
  ```
  ### <Bug|Technical Debt|Compliance>: <Short Title>

  **Location:** <file path(s) and line number(s) if known>
  **Problem:** <what is wrong and what the consequence is>
  **Fix required:** <what needs to be done to resolve it>
  ```

- **A new AsyncStorage key is introduced** — add it to the AsyncStorage keys table in the Data Flow subsection of §3. Include the key string, what it stores, and which file owns it.

- **A coding standard or naming convention is deliberately changed, or a new one is established** — update §5. If the change deprecates an existing pattern, note the old pattern explicitly so the codebase can be searched and updated: "Previously X, now Y — existing uses of X should be migrated."

- **The navigation pattern for any screen changes** — update the Navigation Patterns section in §3. If a new `router.*` method or `CommonActions` usage is introduced, add it to the Navigation Patterns list with an explanation of when to use it.

### Commit Format for CLAUDE.md Updates

The CLAUDE.md update must be a **separate commit** from the feature or fix commit it documents. Use:

```
docs(CLAUDE.md): <describe what changed and why>

<body: explain which section was updated, what the old state was,
and what the new state reflects. Be specific enough that a future
session can understand what triggered the update without reading
the accompanying feature commit.>
```

Example:
```
docs(CLAUDE.md): add capture-to-document-directory route to §3 and close §10 image persistence bug

Updated §3 Data Flow to document the new pegasus_images/ directory path.
Updated §9 Image Storage rule to reflect that the fix is now implemented
and the hard rule is now enforced (previously marked as not yet implemented).
Removed the "Images Not Copied to Persistent Storage" entry from §10 as
the bug is resolved in the accompanying feat(capture) commit.
```

### When in Doubt

If you are unsure whether a change warrants a CLAUDE.md update, **err on the side of updating it.** A spurious documentation update costs nothing. A missing one costs the next session the time it takes to rediscover what changed and why.
