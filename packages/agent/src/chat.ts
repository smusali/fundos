import { anthropic } from '@ai-sdk/anthropic';
import { stepCountIs, ToolLoopAgent } from 'ai';
import { loadConfig } from '@fundos/core';
import { buildToolRegistry, type RegistryContext } from './registry';

const CHAT_MODEL = 'claude-sonnet-5';
const MAX_CHAT_STEPS = 8;

const INSTRUCTIONS = `You are the deal agent for a venture fund running on fundos.
Ground every answer in this deal's data via your tools: evidence with document and page citations, the rubric version, the ledger, and CRM context.
Cite documents and pages when you reference claims. State assumptions plainly.
Drafting tools only create pending drafts in the partner approval queue; you cannot send anything, write to the CRM, or record decisions. Say so when asked.`;

export function isChatEnabled(): boolean {
  return loadConfig().ANTHROPIC_API_KEY !== undefined;
}

/** The deal chat fronts the orchestra: one agent surface over the shared registry. */
export function buildDealChatAgent(context: RegistryContext) {
  return new ToolLoopAgent({
    id: 'deal-chat',
    model: anthropic(CHAT_MODEL),
    instructions: INSTRUCTIONS,
    tools: buildToolRegistry(context),
    stopWhen: stepCountIs(MAX_CHAT_STEPS),
  });
}
