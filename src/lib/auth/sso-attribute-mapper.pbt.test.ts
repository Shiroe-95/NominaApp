/**
 * Property-Based Tests for SSO Attribute Mapping and JIT Provisioning
 *
 * Feature: platform-improvements
 * Properties: 37 (attribute mapping), 38 (JIT provisioning)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapIdPAttributes, resolveRole, determineJITProvisioning } from './sso-attribute-mapper';
import type { NominaSmartRole, IdPAttributes } from './sso-service';
import { NOMINASMART_ROLES } from './sso-service';

// ─── Generators ─────────────────────────────────────────────────────────────

const roleArb = fc.constantFrom<NominaSmartRole>('admin', 'analyst', 'client');

const emailArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
  fc.constantFrom('example.com', 'corp.io', 'test.org'),
).map(([local, domain]) => `${local}@${domain}`);

const groupNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-_'.split('')),
  { minLength: 1, maxLength: 15 },
);

const groupRoleMappingArb = fc.dictionary(groupNameArb, roleArb, { minKeys: 0, maxKeys: 5 });

const idpAttributesArb = (email: fc.Arbitrary<string> = emailArb) =>
  fc.record({
    email: email,
    name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    groups: fc.option(fc.array(groupNameArb, { minLength: 0, maxLength: 5 }), { nil: undefined }),
  }) as fc.Arbitrary<IdPAttributes>;

// ─── Property 37: SSO attribute mapping ─────────────────────────────────────

describe('Property 37: SSO mapeo de atributos IdP a perfil NominaSmart', () => {
  /**
   * **Validates: Requirements 14.4**
   *
   * For any set of IdP attributes (email, name, group), the SSO service
   * must correctly map them to a NominaSmart user profile and role
   * according to the mapping configuration.
   */
  it('maps IdP attributes to NominaSmart profile correctly', () => {
    fc.assert(
      fc.property(
        idpAttributesArb(),
        groupRoleMappingArb,
        roleArb,
        (attributes, groupRoleMapping, defaultRole) => {
          const config = { groupRoleMapping, defaultRole };
          const result = mapIdPAttributes(attributes, config);

          // Email must be preserved exactly
          expect(result.email).toBe(attributes.email);

          // Name must be the IdP name or email prefix
          if (attributes.name) {
            expect(result.name).toBe(attributes.name);
          } else {
            expect(result.name).toBe(attributes.email.split('@')[0]);
          }

          // Role must be a valid NominaSmart role
          expect(NOMINASMART_ROLES).toContain(result.role);

          // If groups match mapping, role should be the highest-priority match
          const groups = attributes.groups ?? [];
          const matchedRoles = groups
            .map((g) => groupRoleMapping[g])
            .filter((r): r is NominaSmartRole => !!r && NOMINASMART_ROLES.includes(r));

          if (matchedRoles.length > 0) {
            const PRIORITY: Record<NominaSmartRole, number> = { admin: 3, analyst: 2, client: 1 };
            const maxPriority = Math.max(...matchedRoles.map((r) => PRIORITY[r]));
            expect(PRIORITY[result.role]).toBe(maxPriority);
          } else {
            expect(result.role).toBe(defaultRole);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 38: JIT provisioning ──────────────────────────────────────────

describe('Property 38: SSO JIT provisioning crea perfil con rol predeterminado', () => {
  /**
   * **Validates: Requirements 14.6**
   *
   * For any user authenticating for the first time via SSO, the system
   * must create a profile with the default role configured by the admin.
   */
  it('creates profile with correct role for first-time SSO users', () => {
    fc.assert(
      fc.property(
        idpAttributesArb(),
        roleArb,
        (attributes, defaultRole) => {
          // First-time user: no existing user IDs
          const result = determineJITProvisioning({
            attributes,
            config: { groupRoleMapping: {}, defaultRole },
            existingUserIds: [],
          });

          // Should create a new user
          expect(result.shouldCreate).toBe(true);

          // Email must match
          expect(result.email).toBe(attributes.email);

          // With no group mapping, role should be the default
          expect(result.role).toBe(defaultRole);

          // Name must be set
          expect(result.name).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('does not create profile for existing SSO users', () => {
    fc.assert(
      fc.property(
        idpAttributesArb(),
        roleArb,
        fc.uuid(),
        (attributes, defaultRole, existingId) => {
          const result = determineJITProvisioning({
            attributes,
            config: { groupRoleMapping: {}, defaultRole },
            existingUserIds: [existingId],
          });

          // Should NOT create a new user
          expect(result.shouldCreate).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
