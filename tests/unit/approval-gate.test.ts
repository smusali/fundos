import { describe, expect, test } from 'vitest';
import { canDeliver, FOUNDER_FACING_ACTIONS, type Approval } from '@fundos/core';

function approval(overrides: Partial<Approval>): Approval {
  return {
    _id: 'a1',
    workspaceId: 'w1',
    dealId: 'd1',
    actionType: 'pass_note.send',
    payload: { subject: 's', body: 'b', recipient: 'f@example.com' },
    status: 'pending',
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('approval gate predicate', () => {
  test('pending rows never pass', () => {
    expect(canDeliver(approval({}))).toBe(false);
  });

  test('rejected rows never pass', () => {
    expect(canDeliver(approval({ status: 'rejected', decidedBy: 'p@x', decidedAt: new Date() }))).toBe(false);
  });

  test('approved rows without a named decider never pass', () => {
    expect(canDeliver(approval({ status: 'approved' }))).toBe(false);
    expect(canDeliver(approval({ status: 'approved', decidedBy: 'p@x' }))).toBe(false);
    expect(canDeliver(approval({ status: 'approved', decidedAt: new Date() }))).toBe(false);
  });

  test('only a fully decided approval passes', () => {
    expect(canDeliver(approval({ status: 'approved', decidedBy: 'p@x', decidedAt: new Date() }))).toBe(true);
  });

  test('all founder-facing actions are gate-covered', () => {
    expect(FOUNDER_FACING_ACTIONS.has('pass_note.send')).toBe(true);
    expect(FOUNDER_FACING_ACTIONS.has('advance_request.send')).toBe(true);
  });
});
