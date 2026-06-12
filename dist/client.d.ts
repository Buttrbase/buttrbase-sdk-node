import type { CouponValidation, GiftCardValidation, GiftCardRedemption, MagicLinkSend, MagicLinkVerify, MfaStatus, MfaEnrollment, OrgSignResponse, Jwk, SecretGet, SecretSummary, StepUpResponse, ElevationGrant, SpiffeSvidResponse, AuthEvent, ReencryptResponse, RevokeSessionResponse, OrgMetrics, Credential, CredentialListResponse, CreateCredentialResponse, RotateSecretResponse, SandboxResetResponse, InviteAcceptRequest, InviteAcceptResponse, OrgCheckResponse, SuperuserResponse, CheckOrgNameResponse, TokenPair, FinalizeRegistrationRequest, CreateInvitationRequest, InvitationResponse, InvitationPreview, AcceptInvitationResponse, InvitationListItem, ContactRequest, ContactUsRequest, ContactSubmitResponse, GeoResponse, ExchangeResponse, OAuthProvider, ApiKeySummary, CreatedKeyResponse, CreateApiKeyInput, OAuthConfigSummary, CreateOAuthConfigInput, UpdateOAuthConfigInput, AppRpConfig, UpdateAppRpConfigInput, AuditLogQuery, AuditRow, PasskeyRegistrationChallenge, PasskeyRegistrationComplete, PasskeyRegistrationResult, PasskeyAuthChallenge, PasskeyAuthComplete, PasskeyListItem, WebhookEndpoint, WebhookDelivery } from './types.js';
export interface ButtrbaseClientOptions {
    apiKey: string;
    baseUrl?: string;
    fetch?: typeof fetch;
}
export declare class ButtrbaseClient {
    private apiKey;
    private baseUrl;
    private fetchImpl;
    constructor(opts: ButtrbaseClientOptions);
    private request;
    validateCoupon(code: string, opts?: {
        cartLabels?: string[];
        productId?: number;
    }): Promise<CouponValidation>;
    validateGiftCard(code: string): Promise<GiftCardValidation>;
    redeemGiftCard(code: string, amountCents: number, userId?: number): Promise<GiftCardRedemption>;
    /**
     * POST /api/auth/magic-link/send — send a passwordless magic-link email.
     *
     * BREAKING: previously this accepted an `orgUuid` option; now `appUuid` (a UUID
     * string identifying the app) is required. The backend rejects requests without
     * a valid `app_uuid`.
     */
    sendMagicLink(email: string, appUuid: string, opts?: {
        redirectTo?: string;
    }): Promise<MagicLinkSend>;
    verifyMagicLink(token: string): Promise<MagicLinkVerify>;
    mfaStatus(): Promise<MfaStatus>;
    mfaEnroll(label?: string): Promise<MfaEnrollment>;
    mfaActivate(code: string): Promise<{
        status: string;
    }>;
    orgSign(orgUuid: string, claims: Record<string, unknown>, opts?: {
        ttlSeconds?: number;
    }): Promise<OrgSignResponse>;
    orgJwks(orgUuid: string): Promise<{
        keys: Jwk[];
    }>;
    getSecret(orgUuid: string, name: string): Promise<SecretGet>;
    putSecret(orgUuid: string, name: string, value: string, description?: string): Promise<SecretSummary>;
    /**
     * POST /api/auth/step-up — exchange MFA code for a short-lived elevated
     * access token (~5 min). On success, the SDK's bearer is REPLACED with
     * the returned `access_token` so subsequent admin/JIT calls are elevated.
     */
    authStepUp(code: string, recovery?: boolean): Promise<StepUpResponse>;
    /** POST /api/admin/orgs/{org}/elevation/request */
    elevationRequest(orgUuid: string, scope: string, opts?: {
        reason?: string;
        ttlSeconds?: number;
    }): Promise<ElevationGrant>;
    /**
     * POST /api/admin/orgs/{org}/elevation/{grant}/approve.
     * Server returns 403 if the approver is the same admin as the requester.
     */
    elevationApprove(orgUuid: string, grantUuid: string): Promise<ElevationGrant>;
    /** GET /api/admin/orgs/{org}/elevation */
    elevationList(orgUuid: string, status?: string): Promise<ElevationGrant[]>;
    /** POST /api/admin/orgs/{org}/spiffe/svid — issue an X.509 SVID. */
    spiffeIssueSvid(orgUuid: string, workloadPath: string, opts?: {
        ttlSeconds?: number;
    }): Promise<SpiffeSvidResponse>;
    /** GET /api/admin/orgs/{org}/auth-events — context-aware audit events. */
    listAuthEvents(orgUuid: string, opts?: {
        userUuid?: string;
        limit?: number;
    }): Promise<AuthEvent[]>;
    /** POST /api/admin/orgs/{org}/reencrypt/secrets */
    reencryptSecrets(orgUuid: string): Promise<ReencryptResponse>;
    /** POST /api/admin/orgs/{org}/reencrypt/signing-keys */
    reencryptSigningKeys(orgUuid: string): Promise<ReencryptResponse>;
    /** POST /api/admin/orgs/{org}/reencrypt/mtls-ca */
    reencryptMtlsCa(orgUuid: string): Promise<ReencryptResponse>;
    /** POST /api/admin/sessions/revoke — add `jti` to the revocation list. */
    revokeSession(jti: string, ttlSeconds?: number): Promise<RevokeSessionResponse>;
    /** GET /api/admin/orgs/{org}/metrics */
    getOrgMetrics(orgUuid: string): Promise<OrgMetrics>;
    /** GET /credentials — list all API credentials for the authenticated account. */
    listCredentials(): Promise<CredentialListResponse>;
    /**
     * POST /credentials — create a new API credential.
     * Returns 201 with the full credential including `client_secret` (shown only once).
     */
    createCredential(name: string, description?: string): Promise<CreateCredentialResponse>;
    /** GET /credentials/:id — fetch a credential by ID (no `client_secret`). */
    getCredential(id: string): Promise<Credential>;
    /** DELETE /credentials/:id — permanently delete a credential (returns void on 204). */
    deleteCredential(id: string): Promise<void>;
    /**
     * POST /credentials/:id/rotate-secret — rotate the client secret for a credential.
     * Returns new `client_id` and `client_secret`.
     */
    rotateCredentialSecret(id: string): Promise<RotateSecretResponse>;
    /**
     * POST /api/sandbox/reset — reset the sandbox environment.
     * Optionally scoped to a specific org via `orgUuid`.
     */
    resetSandbox(orgUuid?: string): Promise<SandboxResetResponse>;
    /**
     * POST /api/auth/register — register a new user for an app.
     *
     * BREAKING: previously this accepted an `orgName` slug; now `appUuid` (a UUID
     * string) is required. The backend rejects requests without a valid `app_uuid`.
     *
     * @deprecated Use sendOtpEmail → verifyOtpEmail → finalizeRegistration instead.
     */
    register(email: string, password: string, appUuid: string, opts?: {
        firstName?: string;
        lastName?: string;
    }): Promise<Record<string, unknown>>;
    /**
     * POST /api/auth/login — stores access_token on success.
     *
     * BREAKING: previously this accepted an `orgName` slug; now `appUuid` (a UUID
     * string) is required. The backend rejects requests without a valid `app_uuid`.
     */
    login(email: string, password: string, appUuid: string): Promise<Record<string, unknown>>;
    /**
     * POST /api/auth/organizations/lookup — look up an organization by domain or slug.
     *
     * BREAKING: now requires `appUuid` (a UUID string). The backend rejects requests
     * without a valid `app_uuid`.
     */
    lookupOrganization(appUuid: string, opts?: {
        domain?: string;
        slug?: string;
    }): Promise<Record<string, unknown>>;
    /** GET /api/auth/organizations/{org_uuid}/login-options */
    getLoginOptions(orgUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/auth/status */
    getStatus(): Promise<Record<string, unknown>>;
    /** GET /api/profile */
    getProfile(): Promise<Record<string, unknown>>;
    /** PUT /api/profile */
    updateProfile(data: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/auth/orgs-by-domain/{domain} */
    getOrgByDomain(domain: string): Promise<Record<string, unknown>>;
    /**
     * POST /api/auth/otp — send an OTP code to a phone number.
     *
     * BREAKING: now requires `appUuid` (a UUID string). The backend rejects requests
     * without a valid `app_uuid`.
     */
    sendOtp(phone: string, appUuid: string): Promise<Record<string, unknown>>;
    /**
     * @deprecated Use {@link sendOtp} instead. This alias exists for back-compat
     * during the cross-SDK naming normalisation and will be removed in v1.0.
     */
    otpSend(phone: string, appUuid: string): Promise<Record<string, unknown>>;
    /**
     * POST /api/auth/otp/verify — verify an OTP code.
     *
     * BREAKING: now requires `appUuid` (a UUID string). The backend rejects requests
     * without a valid `app_uuid`.
     */
    verifyOtp(phone: string, code: string, appUuid: string): Promise<Record<string, unknown>>;
    /**
     * @deprecated Use {@link verifyOtp} instead. Removed in v1.0.
     */
    otpVerify(phone: string, code: string, appUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/auth/mfa/totp/verify */
    mfaVerify(code: string): Promise<Record<string, unknown>>;
    /** POST /api/auth/mfa/totp/challenge */
    mfaChallenge(): Promise<Record<string, unknown>>;
    /** DELETE /api/auth/mfa/totp */
    mfaDisable(): Promise<Record<string, unknown>>;
    /** POST /api/auth/mfa/recovery-codes */
    mfaGenerateRecoveryCodes(): Promise<Record<string, unknown>>;
    /** POST /api/auth/mfa/recovery-codes/redeem */
    mfaRedeemRecoveryCode(code: string): Promise<Record<string, unknown>>;
    /**
     * POST /api/passkeys/register/begin — start passkey registration.
     * Requires an authenticated caller (you add a passkey to an existing account).
     * Pass the returned `challenge` to `navigator.credentials.create({publicKey: challenge.publicKey})`
     * and the `registration_state` back to {@link passkeyRegisterComplete}.
     */
    passkeyRegisterBegin(): Promise<PasskeyRegistrationChallenge>;
    /**
     * POST /api/passkeys/register/complete — finish passkey registration.
     * `credential` is the WebAuthn `RegisterPublicKeyCredential` produced by the
     * browser; `registration_state` is the opaque blob returned by
     * {@link passkeyRegisterBegin}.
     */
    passkeyRegisterComplete(body: PasskeyRegistrationComplete): Promise<PasskeyRegistrationResult>;
    /**
     * POST /api/passkeys/authenticate/begin — start passkey authentication.
     * Anonymous; no Authorization header required. Pass the returned `challenge`
     * to `navigator.credentials.get({publicKey: challenge.publicKey})`.
     */
    passkeyAuthenticateBegin(): Promise<PasskeyAuthChallenge>;
    /**
     * POST /api/passkeys/authenticate/complete — finish passkey authentication.
     * Returns the session payload (shape currently unstable on the backend —
     * `unknown` here, callers should narrow at the call site).
     */
    passkeyAuthenticateComplete(body: PasskeyAuthComplete): Promise<unknown>;
    /**
     * GET /api/v1/me/passkeys — list the signed-in user's enrolled passkeys.
     * Returns the rows in descending `created_at` order. Each row carries a
     * `credential_uuid` (for revocation) and a 12-char `credential_id_prefix`
     * for display.
     */
    listMyPasskeys(): Promise<PasskeyListItem[]>;
    /**
     * DELETE /api/v1/me/passkeys/{credentialUuid} — revoke one of the
     * signed-in user's passkeys. The backend enforces the owner check; passing
     * a UUID owned by another user returns 404.
     */
    deleteMyPasskey(credentialUuid: string): Promise<{
        status: string;
    }>;
    /** GET /api/auth/oidc/{connection_uuid}/authorize */
    oidcAuthorizeUrl(connectionUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/auth/saml/{connection_uuid}/authorize */
    samlAuthorizeUrl(connectionUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/users */
    listUsers(filters?: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/users/{user_uuid}/level */
    getUserLevel(userUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/users/{user_uuid}/level */
    setUserLevel(userUuid: string, userType: string): Promise<Record<string, unknown>>;
    /** PUT /api/users/{user_uuid}/status */
    updateUserStatus(userUuid: string, active: boolean): Promise<Record<string, unknown>>;
    /** PUT /api/users/{user_uuid}/role */
    updateUserRole(userUuid: string, role: string): Promise<Record<string, unknown>>;
    /** GET /api/organizations/{org_uuid}/security-settings */
    getSecuritySettings(orgUuid: string): Promise<Record<string, unknown>>;
    /** PUT /api/organizations/{org_uuid}/security-settings */
    updateSecuritySettings(orgUuid: string, settings: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/organizations/{org_uuid}/sso-connections */
    listSsoConnections(orgUuid: string): Promise<unknown[]>;
    /** POST /api/organizations/{org_uuid}/sso-connections */
    createSsoConnection(orgUuid: string, provider: string, name: string, config: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** PUT /api/organizations/{org_uuid}/sso-connections/{connection_uuid} */
    updateSsoConnection(orgUuid: string, connectionUuid: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** DELETE /api/organizations/{org_uuid}/sso-connections/{connection_uuid} */
    deleteSsoConnection(orgUuid: string, connectionUuid: string): Promise<void>;
    /** GET /api/organizations/{org_uuid}/audit-events */
    listAuditEvents(orgUuid: string): Promise<unknown[]>;
    /** GET /api/organizations/{org_uuid}/audit-events/export */
    exportAuditEvents(orgUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/organizations/{org_uuid}/branding */
    getBranding(orgUuid: string): Promise<Record<string, unknown>>;
    /** PUT /api/organizations/{org_uuid}/branding */
    updateBranding(orgUuid: string, branding: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/organizations/{org_uuid}/session-inventory */
    orgSessionInventory(orgUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/organizations/{org_uuid}/revoke-all-sessions */
    orgRevokeAllSessions(orgUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/devices/{device_uuid}/accounts */
    listDeviceAccounts(deviceUuid: string): Promise<unknown[]>;
    /** POST /api/devices/{device_uuid}/accounts */
    addDeviceAccount(deviceUuid: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** DELETE /api/devices/{device_uuid}/accounts */
    deleteDeviceAccounts(deviceUuid: string): Promise<void>;
    /** DELETE /api/devices/{device_uuid}/accounts/{account_uuid} */
    deleteDeviceAccount(deviceUuid: string, accountUuid: string): Promise<void>;
    /** POST /api/devices/{device_uuid}/active-account */
    switchDeviceActiveAccount(deviceUuid: string, accountUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/devices/{device_uuid}/session-inventory */
    deviceSessionInventory(deviceUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/devices/{device_uuid}/revoke-all */
    revokeAllDeviceSessions(deviceUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/v2/organizations/{org_uuid}/api-keys */
    listApiKeysV2(orgUuid: string): Promise<unknown[]>;
    /** POST /api/v2/organizations/{org_uuid}/api-keys */
    createApiKeyV2(orgUuid: string, name: string): Promise<Record<string, unknown>>;
    /** DELETE /api/v2/organizations/{org_uuid}/api-keys/{key_uuid} */
    deleteApiKeyV2(orgUuid: string, keyUuid: string): Promise<void>;
    /** GET /api/organizations/{org_uuid}/service-identities */
    listServiceIdentities(orgUuid: string): Promise<unknown[]>;
    /** POST /api/organizations/{org_uuid}/service-identities */
    createServiceIdentity(orgUuid: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** DELETE /api/organizations/{org_uuid}/service-identities/{key_uuid} */
    deleteServiceIdentity(orgUuid: string, keyUuid: string): Promise<void>;
    /** POST /api/organizations/{org_uuid}/service-identities/automation-token */
    createServiceIdentityAutomationToken(orgUuid: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/entitlements/check */
    entitlementsCheck(feature: string, orgUuid?: string): Promise<Record<string, unknown>>;
    /** POST /api/entitlements/check/batch */
    entitlementsCheckBatch(checks: unknown[]): Promise<Record<string, unknown>>;
    /** GET /api/entitlements/effective */
    entitlementsEffective(): Promise<Record<string, unknown>>;
    /** POST /api/admin/entitlements/explain */
    adminEntitlementsExplain(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/pricing/preview */
    pricingPreview(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/pricing/quote */
    pricingQuote(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/pricing/checkout-session */
    pricingCheckoutSession(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/admin/pricing/explain */
    adminPricingExplain(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/catalog/pricing/preview */
    catalogPricingPreview(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/admin/products/{product_id}/coupons */
    adminListProductCoupons(productId: string): Promise<unknown[]>;
    /** POST /api/admin/products/{product_id}/coupons */
    adminCreateProductCoupon(productId: string, coupon: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** PUT /api/admin/products/{product_id}/coupons/{coupon_id} */
    adminUpdateProductCoupon(productId: string, couponId: string, coupon: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** DELETE /api/admin/products/{product_id}/coupons/{coupon_id} */
    adminDeleteProductCoupon(productId: string, couponId: string): Promise<void>;
    /** PUT /api/admin/coupons/{id}/labels */
    setCouponLabels(couponId: string, labels: string[]): Promise<Record<string, unknown>>;
    /** POST /api/admin/coupons/{id}/labels */
    addCouponLabel(couponId: string, label: string): Promise<Record<string, unknown>>;
    /** DELETE /api/admin/coupons/{id}/labels/{label} */
    removeCouponLabel(couponId: string, label: string): Promise<void>;
    /** PUT /api/admin/products/{id}/tags */
    setProductTags(productId: string, tags: string[]): Promise<Record<string, unknown>>;
    /** POST /api/admin/products/{id}/tags */
    addProductTag(productId: string, tag: string): Promise<Record<string, unknown>>;
    /** DELETE /api/admin/products/{id}/tags/{tag} */
    removeProductTag(productId: string, tag: string): Promise<void>;
    /** POST /api/analytics/events */
    ingestAnalyticsEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/analytics/apps/{app_uuid}/overview */
    analyticsAppOverview(appUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/analytics/organizations/{org_uuid}/overview */
    analyticsOrgOverview(orgUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/teams */
    createTeam(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/organizations/{org_uuid}/teams */
    listOrgTeams(orgUuid: string): Promise<unknown[]>;
    /** GET /api/teams/org/{org_uuid}/inactive */
    listInactiveTeams(orgUuid: string): Promise<unknown[]>;
    /** POST /api/teams/lifecycle/{team_uuid}/reactivate */
    reactivateTeam(teamUuid: string): Promise<Record<string, unknown>>;
    /** DELETE /api/teams/lifecycle/{team_uuid} */
    archiveTeam(teamUuid: string): Promise<void>;
    /** GET /api/teams/{team_uuid}/members */
    listTeamMembers(teamUuid: string): Promise<unknown[]>;
    /** POST /api/teams/{team_uuid}/members */
    addTeamMember(teamUuid: string, userUuid: string): Promise<Record<string, unknown>>;
    /** DELETE /api/teams/{team_uuid}/members/{user_uuid} */
    removeTeamMember(teamUuid: string, userUuid: string): Promise<void>;
    /** GET /api/teams/{team_uuid}/observers */
    listTeamObservers(teamUuid: string): Promise<unknown[]>;
    /** POST /api/teams/{team_uuid}/observers */
    addTeamObserver(teamUuid: string, userUuid: string): Promise<Record<string, unknown>>;
    /** DELETE /api/teams/{team_uuid}/observers/{user_uuid} */
    removeTeamObserver(teamUuid: string, userUuid: string): Promise<void>;
    /** GET /api/users/{user_uuid}/teams */
    getUserTeams(userUuid: string): Promise<unknown[]>;
    /** GET /api/users/{user_uuid}/observed-teams */
    getUserObservedTeams(userUuid: string): Promise<unknown[]>;
    /** GET /api/organizations/{org_uuid}/features */
    listOrgFeatures(orgUuid: string): Promise<unknown[]>;
    /** POST /api/organizations/{org_uuid}/features */
    setOrgFeature(orgUuid: string, feature: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** DELETE /api/organizations/{org_uuid}/features/{feature_id} */
    removeOrgFeature(orgUuid: string, featureId: string): Promise<void>;
    /** GET /api/roles */
    listRoles(): Promise<unknown[]>;
    /** GET /api/roles/permissions */
    listAllPermissions(): Promise<unknown[]>;
    /** GET /api/roles/{role_id}/permissions */
    getRolePermissions(roleId: string): Promise<unknown[]>;
    /** PUT /api/roles/{role_id}/permissions */
    updateRolePermissions(roleId: string, permissions: unknown[]): Promise<Record<string, unknown>>;
    /** GET /api/v2/products/{product_id}/permissions */
    getProductPermissions(productId: string): Promise<unknown[]>;
    /** POST /api/v2/products/{product_id}/roles */
    createProductRole(productId: string, roleData: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/v2/organizations/{org_uuid}/products/{product_id}/roles */
    getAssignableRoles(orgUuid: string, productId: string): Promise<unknown[]>;
    /** PUT /api/v2/organizations/{org_uuid}/users/{user_uuid}/role */
    assignRoleToUser(orgUuid: string, userUuid: string, roleId: string): Promise<Record<string, unknown>>;
    /** POST /api/billing/checkout */
    checkout(priceId: string, couponCode?: string, addOns?: unknown[]): Promise<Record<string, unknown>>;
    /** GET /api/billing/history */
    getBillingHistory(): Promise<Record<string, unknown>>;
    /** GET /api/billing/invoices */
    listInvoices(): Promise<unknown[]>;
    /** GET /api/billing/config/{provider} */
    getProviderConfig(provider: string): Promise<Record<string, unknown>>;
    /** POST /api/billing/subscriptions/add-on */
    addAddOn(addOn: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/wallet */
    getWallet(): Promise<Record<string, unknown>>;
    /** GET /api/environments */
    listEnvironments(): Promise<unknown[]>;
    /** POST /api/plaid/create-link-token */
    plaidCreateLinkToken(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/plaid/exchange-public-token */
    plaidExchangePublicToken(publicToken: string): Promise<Record<string, unknown>>;
    /** GET /api/plaid/accounts */
    plaidAccounts(): Promise<unknown[]>;
    /** POST /api/usage/report */
    usageReport(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/help */
    helpRoot(): Promise<Record<string, unknown>>;
    /** GET /api/help/search?q={query} */
    helpSearch(query: string): Promise<Record<string, unknown>>;
    /** GET /api/help/categories/{slug} */
    helpCategory(slug: string): Promise<Record<string, unknown>>;
    /** GET /api/help/articles/{slug} */
    helpArticle(slug: string): Promise<Record<string, unknown>>;
    /** POST /api/v2/search/index */
    searchIndex(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/v2/search/query */
    searchQuery(q: string, filters?: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/v2/search/chat */
    searchChat(q: string, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST to gateway.buttrbase.com — AI chat completions via org gateway. */
    aiChatCompletions(orgUuid: string, provider: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/signing-keys */
    listSigningKeys(orgUuid: string): Promise<unknown[]>;
    /** POST /api/admin/organizations/{org_uuid}/signing-keys/rotate */
    rotateSigningKeys(orgUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/signing-audit */
    listSigningAudit(orgUuid: string): Promise<unknown[]>;
    /** POST /api/orgs/{org_uuid}/sign-document */
    signDocument(orgUuid: string, document: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/certificate-authority */
    getCa(orgUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/admin/organizations/{org_uuid}/certificate-authority/init */
    initCa(orgUuid: string, config: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/certificates */
    listCertificates(orgUuid: string): Promise<unknown[]>;
    /** POST /api/admin/organizations/{org_uuid}/certificates */
    issueCertificate(orgUuid: string, csr: string): Promise<Record<string, unknown>>;
    /** POST /api/admin/organizations/{org_uuid}/certificates/{serial}/revoke */
    revokeCertificate(orgUuid: string, serial: string): Promise<Record<string, unknown>>;
    /** POST /api/admin/organizations/{org_uuid}/auth-events/purge */
    purgeAuthEvents(orgUuid: string): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/kms-status */
    kmsStatus(orgUuid: string): Promise<Record<string, unknown>>;
    /** PATCH /api/admin/organizations/{org_uuid}/sso/{connection_uuid}/saml-cert */
    samlCertRollover(orgUuid: string, connectionUuid: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** PATCH /api/admin/organizations/{org_uuid}/payment-settings */
    updatePaymentSettings(orgUuid: string, settings: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/secrets */
    listSecrets(orgUuid: string): Promise<unknown[]>;
    /** DELETE /api/admin/organizations/{org_uuid}/secrets/{name} */
    deleteSecret(orgUuid: string, name: string): Promise<void>;
    /** POST /api/admin/organizations/{org_uuid}/admin-portal/issue */
    adminPortalIssue(orgUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/admin-portal/exchange */
    adminPortalExchange(token: string): Promise<Record<string, unknown>>;
    /** GET /api/admin/organizations/{org_uuid}/domains */
    listDomains(orgUuid: string): Promise<unknown[]>;
    /** POST /api/admin/organizations/{org_uuid}/domains */
    createDomain(orgUuid: string, domain: string): Promise<Record<string, unknown>>;
    /** POST /api/admin/organizations/{org_uuid}/domains/{id}/verify */
    verifyDomain(orgUuid: string, domainId: string): Promise<Record<string, unknown>>;
    /** DELETE /api/admin/organizations/{org_uuid}/domains/{id} */
    deleteDomain(orgUuid: string, domainId: string): Promise<void>;
    /** GET /api/admin/organizations/{org_uuid}/webhook-endpoints */
    listWebhookEndpoints(orgUuid: string): Promise<unknown[]>;
    /** POST /api/admin/organizations/{org_uuid}/webhook-endpoints */
    createWebhookEndpoint(orgUuid: string, url: string, events: string[]): Promise<Record<string, unknown>>;
    /** DELETE /api/admin/organizations/{org_uuid}/webhook-endpoints/{id} */
    deleteWebhookEndpoint(orgUuid: string, endpointId: string): Promise<void>;
    /** GET /api/admin/organizations/{org_uuid}/webhook-deliveries */
    listOrgWebhookDeliveries(orgUuid: string): Promise<unknown[]>;
    /** POST /api/admin/organizations/{org_uuid}/scim-tokens */
    issueScimToken(orgUuid: string): Promise<Record<string, unknown>>;
    /** POST /api/payments/checkout */
    createPaymentCheckout(amount: number, currency: string, country: string, orgUuid?: string): Promise<Record<string, unknown>>;
    /** POST /api/payments/invoices/send */
    sendInvoice(amount: number, currency: string, appUuid: string, opts?: {
        memo?: string;
        dueDate?: string;
    }): Promise<Record<string, unknown>>;
    /** POST /api/sms/send_sms */
    sendSms(phone: string, message: string, opts?: {
        from?: string;
        orgUuid?: string;
    }): Promise<Record<string, unknown>>;
    /** POST /api/email/verify-identity */
    verifyEmailIdentity(email: string, awsAccessKeyId: string, awsSecretAccessKey: string, awsRegion?: string): Promise<Record<string, unknown>>;
    /** POST /api/v2/jobs/enqueue */
    enqueueJob(name: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** POST /api/v2/notifications/send */
    sendNotification(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
    /** GET /api/v2/notifications */
    listNotifications(): Promise<unknown[]>;
    /** GET /api/v2/custom-variables/{key} */
    getCustomVariable(key: string): Promise<Record<string, unknown>>;
    /** POST /api/v2/custom-variables */
    setCustomVariable(key: string, value: string, scope?: string): Promise<Record<string, unknown>>;
    /** POST /api/v2/webhooks */
    registerWebhook(url: string, events: string[], orgUuid?: string): Promise<Record<string, unknown>>;
    /** POST /api/auth/invite/accept */
    inviteAccept(req: InviteAcceptRequest): Promise<InviteAcceptResponse>;
    /** GET /api/auth/orgs/check?name={name} */
    checkOrgName(name: string): Promise<OrgCheckResponse>;
    /**
     * Send an email OTP for the 0.3.0 registration flow.
     * POST /api/v1/auth/otp/send
     * Flow: sendOtpEmail → verifyOtpEmail → finalizeRegistration
     */
    sendOtpEmail(email: string, appUuid: string): Promise<void>;
    /**
     * Verify an email OTP. Returns a TokenPair whose `token` is the
     * signup_token for finalizeRegistration.
     * POST /api/v1/auth/otp/verify
     */
    verifyOtpEmail(email: string, otp: string, appUuid: string): Promise<TokenPair>;
    /**
     * Check whether an org name is available before registration.
     * POST /api/v1/auth/check-org-name
     */
    checkOrgNameV2(name: string): Promise<CheckOrgNameResponse>;
    /**
     * Complete user registration after OTP verification.
     * POST /api/v1/auth/finalize-registration
     * req.signup_token must be the token from verifyOtpEmail.
     */
    finalizeRegistration(req: FinalizeRegistrationRequest): Promise<TokenPair>;
    /**
     * Create an org invitation.
     * POST /api/v1/organizations/{orgUuid}/invitations
     * The token in the response is shown once.
     */
    createInvitation(orgUuid: string, req: CreateInvitationRequest): Promise<InvitationResponse>;
    /**
     * Preview an invitation by token (public, no auth).
     * GET /api/v1/invitations/{token}/preview
     */
    previewInvitation(token: string): Promise<InvitationPreview>;
    /**
     * Accept an invitation for an already-authenticated user joining an
     * additional org. New users should use finalizeRegistration with
     * OrgChoice { type: 'accept_invite', invitation_token }.
     * POST /api/v1/invitations/{token}/accept
     */
    acceptInvitation(token: string): Promise<AcceptInvitationResponse>;
    /**
     * List all invitations for an org.
     * GET /api/v1/organizations/{orgUuid}/invitations
     */
    listInvitations(orgUuid: string): Promise<InvitationListItem[]>;
    /**
     * Revoke a pending invitation by its integer ID.
     * DELETE /api/v1/organizations/{orgUuid}/invitations/{invitationId}
     */
    revokeInvitation(orgUuid: string, invitationId: number): Promise<void>;
    /** GET /api/auth/superuser?email={email} */
    getSuperuserFlag(email: string): Promise<SuperuserResponse>;
    /** POST /api/contact */
    postContact(req: ContactRequest): Promise<ContactSubmitResponse>;
    /** POST /api/contact-us */
    postContactUs(req: ContactUsRequest): Promise<ContactSubmitResponse>;
    /** GET /api/geo/ip */
    getClientIp(): Promise<GeoResponse>;
    /**
     * POST /api/v1/auth/api-key/exchange — exchange a raw API key for a pair of
     * short-lived access + refresh tokens. Anonymous (no bearer needed).
     *
     * On success, the SDK's bearer is REPLACED with the returned `access_token`
     * so subsequent calls authenticate as that app.
     */
    exchangeApiKey(apiKey: string): Promise<ExchangeResponse>;
    /**
     * POST /api/v1/auth/api-key/exchange — rotate a refresh token for a fresh
     * access + refresh pair. Anonymous (no bearer needed).
     *
     * On success, the SDK's bearer is REPLACED with the returned `access_token`.
     */
    exchangeRefreshToken(refreshToken: string): Promise<ExchangeResponse>;
    /**
     * Build the OAuth start URL for `GET /api/v1/auth/oauth/{provider}/start`.
     *
     * This is a pure URL builder — the caller is responsible for navigating the
     * browser to the returned URL (the backend responds with a 302 redirect to
     * the upstream identity provider, which `fetch` cannot follow safely).
     */
    oauthStartUrl(provider: OAuthProvider, appUuid: string, returnTo: string): string;
    /** GET /api/v1/apps/{app_uuid}/api-keys — list API keys for an app. */
    listAppApiKeys(appUuid: string): Promise<ApiKeySummary[]>;
    /**
     * POST /api/v1/apps/{app_uuid}/api-keys — mint a new API key.
     *
     * The response includes `raw_key`, which is shown only once. Save it before
     * dropping the response on the floor.
     */
    createAppApiKey(appUuid: string, input: CreateApiKeyInput): Promise<CreatedKeyResponse>;
    /** DELETE /api/v1/apps/{app_uuid}/api-keys/{key_uuid} — revoke an API key. */
    revokeAppApiKey(appUuid: string, keyUuid: string): Promise<void>;
    /**
     * POST /api/v1/apps/{app_uuid}/api-keys/{key_uuid}/rotate — rotate an API key.
     *
     * Returns the new `raw_key`; the previous secret is invalidated immediately.
     */
    rotateAppApiKey(appUuid: string, keyUuid: string): Promise<CreatedKeyResponse>;
    /** GET /api/v1/apps/{app_uuid}/oauth-configs — list configured OAuth providers (no secrets). */
    listOAuthConfigs(appUuid: string): Promise<OAuthConfigSummary[]>;
    /** POST /api/v1/apps/{app_uuid}/oauth-configs — register a new OAuth provider. */
    createOAuthConfig(appUuid: string, input: CreateOAuthConfigInput): Promise<OAuthConfigSummary>;
    /**
     * PATCH /api/v1/apps/{app_uuid}/oauth-configs/{provider} — partially update
     * an OAuth provider config. `client_secret` is only rotated when present.
     */
    updateOAuthConfig(appUuid: string, provider: OAuthProvider, patch: UpdateOAuthConfigInput): Promise<OAuthConfigSummary>;
    /** DELETE /api/v1/apps/{app_uuid}/oauth-configs/{provider} — remove an OAuth provider. */
    deleteOAuthConfig(appUuid: string, provider: OAuthProvider): Promise<void>;
    /**
     * GET /api/v1/apps/{app_uuid}/rp-config — fetch the per-app WebAuthn
     * relying-party config (RP id + allowed origins).
     * `rp_id` is `null` when the app inherits the deployment-wide env-var RP id.
     */
    getAppRpConfig(appUuid: string): Promise<AppRpConfig>;
    /**
     * PATCH /api/v1/apps/{app_uuid}/rp-config — partially update the per-app
     * WebAuthn relying-party config. Omitted fields stay unchanged; `rp_id` set
     * to `null` would fall back to the env var, but this typed input cannot
     * express an explicit-null patch (known limitation — use raw JSON to clear).
     */
    updateAppRpConfig(appUuid: string, patch: UpdateAppRpConfigInput): Promise<AppRpConfig>;
    /** GET /api/v1/apps/{app_uuid}/audit-log — read recent audit rows for an app. */
    readAuditLog(appUuid: string, opts?: AuditLogQuery): Promise<AuditRow[]>;
    /**
     * POST /api/auth/request-password-reset — send a password-reset email.
     * No API key required.
     */
    requestPasswordReset(email: string): Promise<{
        message: string;
    }>;
    /**
     * POST /api/auth/reset-password — complete a password reset using the token
     * from the reset email. No API key required.
     */
    resetPassword(token: string, password: string): Promise<{
        message: string;
    }>;
    /** GET /api/v1/webhooks — list all webhook endpoints. */
    listWebhooks(): Promise<{
        data: WebhookEndpoint[];
    }>;
    /** POST /api/v1/webhooks — register a new webhook endpoint. */
    createWebhook(url: string, opts?: {
        eventTypes?: string[];
        signingSecret?: string;
        description?: string;
    }): Promise<{
        data: WebhookEndpoint;
    }>;
    /** DELETE /api/v1/webhooks/{id} — permanently remove a webhook endpoint. */
    deleteWebhook(id: number): Promise<void>;
    /** GET /api/v1/webhooks/{id}/deliveries — list deliveries for a webhook endpoint. */
    listWebhookDeliveries(webhookId: number): Promise<WebhookDelivery[]>;
    /** POST /api/v1/webhooks/{id}/deliveries/{deliveryId}/retry — retry a failed delivery. */
    retryWebhookDelivery(webhookId: number, deliveryId: number): Promise<{
        status: string;
    }>;
    /**
     * POST /v1/oauth/connections/{provider}/refresh — refresh an OAuth connection's
     * access token for the given provider.
     */
    refreshOAuthConnection(provider: string): Promise<{
        provider: string;
        refreshed: boolean;
        expires_at?: string;
    }>;
    /**
     * POST /api/email/send — send a transactional email via the configured
     * provider. At least one of `htmlBody` or `textBody` should be supplied.
     */
    sendEmail(opts: {
        to: string;
        subject: string;
        htmlBody?: string;
        textBody?: string;
        fromAddress?: string;
        replyTo?: string;
    }): Promise<{
        status: string;
        provider: string;
        message?: string;
        messageId?: string;
    }>;
}
