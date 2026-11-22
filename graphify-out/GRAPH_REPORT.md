# Graph Report - seminex  (2026-11-12)

## Corpus Check
- 232 files · ~133,599 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 3, .example 1, .css 1)

## Summary
- 1645 nodes · 5736 edges · 79 communities (59 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `81771ac7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- client.ts
- Skeleton
- ProfileForm.tsx
- useResource
- OrgSeminarDetailsPage.tsx
- cx
- client.ts
- certificates.ts
- storage.ts
- AdminSignInPage.tsx
- registration_concurrency.mjs
- Organization data contracts
- Icon
- HistorySummaryPage.tsx
- MySeminarsPage.tsx
- SignUpPage.tsx
- 20261109000000_evaluation_backend.sql
- ProfileForm.tsx
- SignUpPage.tsx
- SeminarListItem
- IconName
- adviser.ts
- orgOfflineCache.ts
- vitest
- AvailableSeminarsPage.tsx
- SeminarEditorPage.tsx
- offlineCache.ts
- react-router-dom
- offlineCache.ts
- SeminarEditorPage
- Evaluation API
- Menu
- EvaluationPage.tsx
- cx
- AdminSeminarsPage.tsx
- AdminProfilePage.tsx
- useOnlineStatus
- OrgShell.tsx
- CanvasSizeControls
- RegistrationGuidelinesPage.tsx
- OrganizationSignUpPage
- RequestOrganizationAccessPage.tsx
- EvaluationAnswers
- cx.ts
- vite.config.ts
- main.tsx
- VerifyEmailPage.tsx
- OrgSeminarsPage.tsx
- StubPage.tsx
- CertificateDesigner
- CertificateDesigner.tsx
- SurveyForm.tsx
- eslint-plugin-react-hooks
- adviser_management.test.sql
- Menu
- OtpField.tsx
- dependencies
- SeminarHeader.test.tsx
- deno.json
- SignUpPage
- Divider.tsx
- Hosted Edge Function deployment unverified
- scripts

## God Nodes (most connected - your core abstractions)
1. `Icon()` - 175 edges
2. `react` - 94 edges
3. `cx()` - 80 edges
4. `useResource()` - 65 edges
5. `Skeleton()` - 62 edges
6. `react-router-dom` - 59 edges
7. `LoadingRegion()` - 58 edges
8. `getSupabaseClient()` - 54 edges
9. `api` - 51 edges
10. `errorText()` - 51 edges

## Surprising Connections (you probably didn't know these)
- `WorkspaceSwitcherProps` --references--> `OrgIdentity`  [EXTRACTED]
  src/components/shell/org/WorkspaceSwitcher.tsx → src/api/orgTypes.ts
- `BadgeConfig` --references--> `IconName`  [EXTRACTED]
  src/components/ui/StatusBadge.tsx → src/components/ui/icons.ts
- `confirmAttendance()` --calls--> `errorText()`  [EXTRACTED]
  src/features/seminars/pages/SeminarPage.tsx → src/components/ui/errorText.ts
- `submitProof()` --calls--> `errorText()`  [EXTRACTED]
  src/features/seminars/tabs/TicketTab.tsx → src/components/ui/errorText.ts
- `formatYearLevel()` --calls--> `yearLevelLabel()`  [EXTRACTED]
  src/features/seminars/format.ts → src/data/academic.ts

## Import Cycles
- None detected.

## Communities (79 total, 20 thin omitted)

### Community 0 - "client.ts"
Cohesion: 0.06
Nodes (98): acknowledgeAttendance(), apiError(), block(), DbError, failure(), functionErrorCode(), identityFromRow(), isRow() (+90 more)

### Community 1 - "Skeleton"
Cohesion: 0.14
Nodes (32): EvaluationDue, actionSecondary, InlineError(), LoadingRegion(), Skeleton(), buildHistoryRecords(), summarizeHistory(), EvaluationBanner() (+24 more)

### Community 2 - "ProfileForm.tsx"
Cohesion: 0.16
Nodes (21): sanitizeMiddleInitial(), validateRequiredName(), validateSelection(), submit(), ENROLLMENT_TEXT, FieldElement, ProfileForm(), cancelEditing() (+13 more)

### Community 3 - "useResource"
Cohesion: 0.08
Nodes (34): ScanLedgerEntry, PageContainer(), PageContainerProps, WIDTHS, PlaceholderPage(), StateMessage(), ActionKey, actions (+26 more)

### Community 4 - "OrgSeminarDetailsPage.tsx"
Cohesion: 0.18
Nodes (19): lucide-react, PasswordRules(), StudentIdField, StudentIdFieldProps, PasswordFieldProps, TextField, TextFieldProps, ForgotPasswordPage() (+11 more)

### Community 5 - "cx"
Cohesion: 0.15
Nodes (24): ticketPdfFilename(), cx(), Spinner(), useToast(), AttendanceMeter(), AttendanceMeterProps, attendanceDetail(), attendanceHeading() (+16 more)

### Community 6 - "client.ts"
Cohesion: 0.07
Nodes (28): cached(), cachedPage(), cancelRegistration(), createOrgDraft(), createOrgEditDraft(), currentStudent(), getProfile(), getSeminar() (+20 more)

### Community 7 - "certificates.ts"
Cohesion: 0.07
Nodes (23): ApiCode, corsHeaders, JsonObject, Box, DataImage, decodeDataImage(), encodeBase64(), escapeAttribute() (+15 more)

### Community 8 - "storage.ts"
Cohesion: 0.11
Nodes (25): devDependencies, eslint@^10.14.0, jsdom@^29.1.1, jsqr@^1.4.0, @material-symbols/svg-400@0.47.6, supabase@3.0.0, tailwindcss@^4.3.3, @types/react@^19.3.0 (+17 more)

### Community 9 - "AdminSignInPage.tsx"
Cohesion: 0.29
Nodes (9): react, AuthLayout(), AuthLayoutProps, WIDTHS, BrandPanel(), MobileBrandHeader(), BrandMark(), LandingPage() (+1 more)

### Community 10 - "registration_concurrency.mjs"
Cohesion: 0.08
Nodes (65): authenticatedUserId(), AuthError, clientOrError(), completeOrganizationSignup(), completeStudentSignup(), emailForStudentId(), failure(), getCurrentIdentity() (+57 more)

### Community 11 - "Organization data contracts"
Cohesion: 0.06
Nodes (35): Adviser, AuthoredSection, AuthoredSurvey, CancellationRecord, CertificateState, CheckboxQuestion, LedgerKind, Membership (+27 more)

### Community 12 - "Icon"
Cohesion: 0.21
Nodes (16): AcademicYearPill(), Icon(), HistoryMetrics(), Metric(), HistoryToolbar(), PolicyBanner(), countByFilter(), HistoryPage() (+8 more)

### Community 13 - "HistorySummaryPage.tsx"
Cohesion: 0.12
Nodes (19): evaluation_responses_immutable, evaluation_responses_seminar_page_idx, evaluation_responses_student_submitted_idx, evaluation_responses_survey_version_idx, evaluation_responses_sync_registration, private.evaluation_question_aggregates(), private.is_evaluation_eligible(), private.prevent_evaluation_history_mutation() (+11 more)

### Community 14 - "MySeminarsPage.tsx"
Cohesion: 0.07
Nodes (66): Seminar, actionDisabled, actionPrimary, ProgressBar(), ProgressBarProps, TONES, SegmentedControl(), BadgeConfig (+58 more)

### Community 15 - "SignUpPage.tsx"
Cohesion: 0.12
Nodes (23): react-router-dom, OrgIdentity, AppShell(), AttendancePrompt(), Sidebar(), TopBar(), actionTonal, Avatar() (+15 more)

### Community 16 - "20261109000000_evaluation_backend.sql"
Cohesion: 0.10
Nodes (35): SurveyQuestion, ErrorSummary, ErrorSummaryItem, ErrorSummaryProps, ChoiceQuestion(), EvaluationForm(), handleAnswer(), handleSaveDraft() (+27 more)

### Community 17 - "ProfileForm.tsx"
Cohesion: 0.12
Nodes (32): AdminAuditLogPage, AdminMembersPage, AdminProfilePage, AdminSignInPage, AppRoutes(), AvailableSeminarsPage, EvaluationPage, ForgotPasswordPage (+24 more)

### Community 18 - "SignUpPage.tsx"
Cohesion: 0.14
Nodes (19): OrgRegistration, ScannedStudentIdentity, Block, Program, YearLevel, AcademicOption, BLOCKS, PROGRAM_CODES (+11 more)

### Community 19 - "SeminarListItem"
Cohesion: 0.08
Nodes (22): CERTIFICATE_CANVAS_HEIGHT, CERTIFICATE_CANVAS_WIDTH, CertificateTemplate, NameBox, BASE_NAME_BOX, BoxGeometry, CANVAS_PRESETS, CanvasSizeControls() (+14 more)

### Community 20 - "IconName"
Cohesion: 0.11
Nodes (20): IconProps, SIZES, IconName, ICONS, isIconName(), MenuItem, MenuProps, StateMessageProps (+12 more)

### Community 21 - "adviser.ts"
Cohesion: 0.17
Nodes (22): apiError(), DbError, decideAdviserOrgRequest(), directoryMemberFromRow(), failure(), invoke(), isRow(), listAdviserOrgMembers() (+14 more)

### Community 22 - "orgOfflineCache.ts"
Cohesion: 0.22
Nodes (18): getOrgIdentity(), listLedger(), listOrgRoster(), cacheOrgIdentity(), cacheOrgLedger(), cacheOrgListing(), cacheOrgRoster(), clearOrgOfflineCache() (+10 more)

### Community 23 - "vitest"
Cohesion: 0.12
Nodes (18): public.profiles, public.cancel_registration(), public.confirm_registration(), public.register_for_seminar(), attendance_ledger_append_only, attendance_ledger_registration_time_idx, attendance_ledger_seminar_student_time_idx, private.prevent_attendance_ledger_mutation() (+10 more)

### Community 24 - "AvailableSeminarsPage.tsx"
Cohesion: 0.19
Nodes (14): errorText(), filterAndSort(), FilterOptions, getDepartments(), getMetrics(), getOpenItems(), SortKey, DepartmentFilter() (+6 more)

### Community 25 - "SeminarEditorPage.tsx"
Cohesion: 0.14
Nodes (15): AuthoredQuestion, SeminarDraft, ALLOWED_TAGS, richTextToPlainText(), sanitizeRichText(), appendChildren(), createQuestionType(), localDateTime() (+7 more)

### Community 26 - "offlineCache.ts"
Cohesion: 0.18
Nodes (25): uploadAvatar(), cacheEvaluationDraft(), cacheItem(), cacheProfile(), cacheRegisteredItems(), cacheTicket(), clearEvaluationDraft(), clearOfflineCache() (+17 more)

### Community 27 - "react-router-dom"
Cohesion: 0.10
Nodes (11): COVER_TYPES, legacyCoverDataUrlToFile(), fileAsDataUrl(), seminarCoverObjectPath(), SeminarEditorPage(), onImage(), onSignatureImage(), publish() (+3 more)

### Community 28 - "offlineCache.ts"
Cohesion: 0.17
Nodes (23): private.release_expired_registrations(), private.set_updated_at(), private.sync_seminar_registered_count(), public.create_org_edit_draft(), public.get_webinar_join_url(), public.publish_seminar(), public.registration_read_model, public.registrations (+15 more)

### Community 29 - "SeminarEditorPage"
Cohesion: 0.10
Nodes (22): runs-on, steps, timeout-minutes, jobs, identity-db, verify, name, on (+14 more)

### Community 30 - "Evaluation API"
Cohesion: 0.26
Nodes (18): aggregateFromRow(), apiError(), authoredSurveyFromRow(), cursorPageFromRow(), DbError, decodeCursor(), encodeCursor(), failure() (+10 more)

### Community 31 - "Menu"
Cohesion: 0.12
Nodes (32): subscribeAuthState(), ApiResult, SessionIdentity, SessionRole, RequireRole(), RequireRoleProps, apiMock, organizationMember (+24 more)

### Community 32 - "EvaluationPage.tsx"
Cohesion: 0.09
Nodes (36): Registration, SeminarListItem, SeminarContextCard(), SeminarContextCardProps, SubmittedDialog(), EvaluationPage(), HeadingRef, SubmittedPanel() (+28 more)

### Community 33 - "cx"
Cohesion: 0.16
Nodes (16): on_auth_user_created_or_email_changed, organization_memberships_user_id_idx, private.sync_auth_user_profile(), public.organization_memberships, public.organizations, organization_access_requests_one_pending_per_org_idx, organization_access_requests_org_status_idx, organization_access_requests_user_requested_idx (+8 more)

### Community 34 - "AdminSeminarsPage.tsx"
Cohesion: 0.16
Nodes (17): CertificateRecord, AdminSeminarsPage, AdminSeminarsPage(), exportCsv(), attendanceRate(), DateFilter, Fact(), filters (+9 more)

### Community 35 - "AdminProfilePage.tsx"
Cohesion: 0.17
Nodes (16): AdminProfileContent(), discard(), save(), AdminProfilePage(), CharterFact(), Credential(), getPreferences(), loadOversightSummary() (+8 more)

### Community 36 - "useOnlineStatus"
Cohesion: 0.10
Nodes (38): ApiErrorCode, Alert, AlertProps, STYLES, Variant, Button(), ButtonProps, IDLE (+30 more)

### Community 37 - "OrgShell.tsx"
Cohesion: 0.20
Nodes (13): BottomNav(), OfflineBanner(), ADVISER_NAV_ITEMS, ORG_NAV_ITEMS, OrgShell(), ShellFrame(), OrgTopBar(), ActiveToast (+5 more)

### Community 38 - "CanvasSizeControls"
Cohesion: 0.12
Nodes (11): @supabase/supabase-js@2.119.0, @supabase/supabase-js, admin, createdRequestId, organizationId, { url, apiKey, adminKey }, admin, organizationId (+3 more)

### Community 39 - "RegistrationGuidelinesPage.tsx"
Cohesion: 0.24
Nodes (9): RegistrationGuidelinesPage, Accordion(), AccordionItem, AccordionProps, BackLink(), BackLinkProps, CARDS, QUESTIONS (+1 more)

### Community 40 - "OrganizationSignUpPage"
Cohesion: 0.32
Nodes (11): blockLabel(), programLabel(), yearLevelLabel(), OrganizationSignUpPage(), continueStep(), setField(), submitRequest(), validateFields() (+3 more)

### Community 41 - "RequestOrganizationAccessPage.tsx"
Cohesion: 0.28
Nodes (6): SelectField, SelectFieldProps, SelectOption, POSITIONS, AcademicPeriod, getAcademicPeriod()

### Community 42 - "EvaluationAnswers"
Cohesion: 0.29
Nodes (7): EvaluationDraft, SurveyResponse, EvaluationAnswers, SubmitEvaluationResult, Survey, EvaluationFormProps, SurveyFormProps

### Community 43 - "cx.ts"
Cohesion: 0.12
Nodes (14): BrandMarkProps, isNavItemActive(), NAV_ITEMS, NavItem, OrgSidebar(), Options(), TARGETS, Workspace (+6 more)

### Community 44 - "vite.config.ts"
Cohesion: 0.18
Nodes (9): @tailwindcss/vite@^4.3.3, vite-plugin-pwa@^2.0.0, @vitejs/plugin-react@^6.1.2, vitest@^5.1.0, @tailwindcss/vite, vite-plugin-pwa, @vitejs/plugin-react, vitest (+1 more)

### Community 47 - "OrgSeminarsPage.tsx"
Cohesion: 0.07
Nodes (63): api, OrgSeminar, RetryButton(), OrgStatusBadge(), STATUS, WebinarProofReview(), orgActionDanger, orgActionPrimary (+55 more)

### Community 49 - "CertificateDesigner"
Cohesion: 0.13
Nodes (14): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUnusedLocals (+6 more)

### Community 50 - "CertificateDesigner.tsx"
Cohesion: 0.14
Nodes (14): dependencies, @fontsource/dm-sans@^5.3.0, @fontsource/outfit@^5.3.0, jspdf@^4.2.1, lucide-react@^1.52.0, qrcode.react@^4.2.0, react@^19.3.0, react-dom@^19.3.0 (+6 more)

### Community 52 - "SurveyForm.tsx"
Cohesion: 0.28
Nodes (11): FILTERS, HistoryToolbarProps, byRecent(), FILTER_LABELS, HistoryFilter, HistorySort, matchesFilter(), matchesQuery() (+3 more)

### Community 53 - "eslint-plugin-react-hooks"
Cohesion: 0.40
Nodes (4): eslint-plugin-react-hooks@^7.1.1, typescript-eslint@^8.72.1, eslint-plugin-react-hooks, typescript-eslint

### Community 54 - "adviser_management.test.sql"
Cohesion: 0.26
Nodes (11): certificate_issuances_seminar_created_idx, certificate_issuances_student_seminar_idx, evaluation_responses_create_certificate_issuance, private.certificate_serial_from_registration(), private.create_certificate_issuance(), public.certificate_issuances, public.finalize_certificate_issuance(), public.get_certificate_generation_input() (+3 more)

### Community 55 - "Menu"
Cohesion: 0.60
Nodes (5): Menu(), closeAndRestoreFocus(), handleMenuKeyDown(), handleTriggerKeyDown(), openMenu()

### Community 56 - "OtpField.tsx"
Cohesion: 0.14
Nodes (17): otpFailureMessage(), OtpField(), sendOtp(), verifyOtp(), OtpFieldProps, AVATAR_HINT, AVATAR_MAX_BYTES, AVATAR_MAX_LABEL (+9 more)

### Community 58 - "dependencies"
Cohesion: 0.40
Nodes (10): Section(), SignUpPage(), goToStep(), handleBlur(), handleContinue(), handleSubmit(), requestFocus(), setField() (+2 more)

### Community 61 - "SeminarHeader.test.tsx"
Cohesion: 0.22
Nodes (8): @testing-library/react@^16.3.3, @testing-library/user-event@^14.6.8, @testing-library/react, @testing-library/user-event, mocks, registration, renderHeader(), seminar

### Community 63 - "deno.json"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 64 - "SignUpPage"
Cohesion: 0.32
Nodes (7): DraftReadiness, ReadinessItem, SeminarDetailsDraft, getMissingDetails(), isFilled(), isHttpsUrl(), REQUIRED_DETAILS

### Community 65 - "Divider.tsx"
Cohesion: 0.33
Nodes (4): public.create_org_edit_draft(), public.publish_seminar(), public.record_org_scan(), public.review_webinar_proof()

### Community 67 - "Hosted Edge Function deployment unverified"
Cohesion: 0.50
Nodes (3): compilerOptions, strict, nodeModulesDir

## Knowledge Gaps
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Icon()` connect `Icon` to `Skeleton`, `ProfileForm.tsx`, `useResource`, `cx`, `MySeminarsPage.tsx`, `SignUpPage.tsx`, `20261109000000_evaluation_backend.sql`, `SeminarListItem`, `IconName`, `AvailableSeminarsPage.tsx`, `SeminarEditorPage.tsx`, `react-router-dom`, `EvaluationPage.tsx`, `AdminSeminarsPage.tsx`, `AdminProfilePage.tsx`, `OrgShell.tsx`, `RegistrationGuidelinesPage.tsx`, `cx.ts`, `OrgSeminarsPage.tsx`, `SurveyForm.tsx`, `Menu`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0552006552006552 - nodes in this community are weakly interconnected._
- **Why does `react` connect `AdminSignInPage.tsx` to `Skeleton`, `ProfileForm.tsx`, `useResource`, `OrgSeminarDetailsPage.tsx`, `cx`, `storage.ts`, `registration_concurrency.mjs`, `Icon`, `MySeminarsPage.tsx`, `SignUpPage.tsx`, `20261109000000_evaluation_backend.sql`, `ProfileForm.tsx`, `SignUpPage.tsx`, `SeminarListItem`, `IconName`, `AvailableSeminarsPage.tsx`, `SeminarEditorPage.tsx`, `Menu`, `EvaluationPage.tsx`, `AdminSeminarsPage.tsx`, `AdminProfilePage.tsx`, `useOnlineStatus`, `OrgShell.tsx`, `RegistrationGuidelinesPage.tsx`, `RequestOrganizationAccessPage.tsx`, `cx.ts`, `main.tsx`, `OrgSeminarsPage.tsx`, `StubPage.tsx`, `CertificateDesigner.tsx`, `SurveyForm.tsx`, `OtpField.tsx`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `Skeleton` be split into smaller, more focused modules?**
  _Cohesion score 0.14396456256921372 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `SignUpPage.tsx` to `Skeleton`, `useResource`, `OrgSeminarDetailsPage.tsx`, `cx`, `storage.ts`, `AdminSignInPage.tsx`, `Icon`, `MySeminarsPage.tsx`, `ProfileForm.tsx`, `SignUpPage.tsx`, `AvailableSeminarsPage.tsx`, `SeminarEditorPage.tsx`, `Menu`, `EvaluationPage.tsx`, `AdminProfilePage.tsx`, `useOnlineStatus`, `OrgShell.tsx`, `RegistrationGuidelinesPage.tsx`, `RequestOrganizationAccessPage.tsx`, `cx.ts`, `main.tsx`, `VerifyEmailPage.tsx`, `OrgSeminarsPage.tsx`, `StubPage.tsx`, `CertificateDesigner.tsx`, `SeminarHeader.test.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `useResource` be split into smaller, more focused modules?**
  _Cohesion score 0.07862679955703211 - nodes in this community are weakly interconnected._
- **Should `client.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._