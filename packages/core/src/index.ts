export { loadConfig, type AppConfig } from './config';
export { type Workspace, type User, type Membership } from './models/workspace';
export { getDb, closeMongo } from './repositories/mongo';
export {
  WorkspaceRepository,
  UserRepository,
  MembershipRepository,
} from './repositories/workspaces';
export { ensureDevSession, type DevSession } from './services/dev-session';
export {
  type Rubric,
  type RubricDimension,
  type RubricDiff,
  type RubricWeightChange,
  type RubricCriteriaChange,
  type Thesis,
} from './models/thesis';
export { ThesisRepository } from './repositories/theses';
export {
  compileThesis,
  diffRubrics,
  matchDimension,
  normalizeWeights,
  rubricFromYaml,
  rubricToYaml,
} from './services/rubric';
export { ThesisService } from './services/thesis';
export {
  type PageRef,
  type Deal,
  type DealStatus,
  type DealDocument,
  type Evidence,
  type DimensionScore,
  type FitScoreBreakdown,
  type FounderContact,
} from './models/deal';
export { DealRepository, DocumentRepository, EvidenceRepository } from './repositories/deals';
export { getRedis, closeRedis, publishProgress, readProgress, type ProgressEntry } from './repositories/redis';
export { LocalObjectStorage, S3ObjectStorage, getStorage, type ObjectStorage } from './storage';
export { scoreDeal } from './services/scoring';
export { DealService, type UploadFile, type CreateDealOptions } from './services/deals';
export { GatekeeperService, type IntakeSubmission, type IntakeGate } from './services/gatekeeper';
export {
  decisionOutcomeSchema,
  realizedTypeSchema,
  type DecisionOutcome,
  type DecisionRow,
  type RealizedType,
  type OutcomeRow,
  type CalibrationRow,
  type AuditRow,
  type RecalibrationDelta,
} from './models/ledger';
export { getLedgerClient, closeClickHouse, LedgerRepository } from './repositories/clickhouse';
export { LedgerService, hashEvidenceSet, provenanceToPdf, type ProvenanceExport } from './services/ledger';
export {
  CalibrationService,
  computeRecalibrationDeltas,
  applyDeltasToRubric,
  type DimensionOutcomeRecord,
} from './services/calibration';
export { canDeliver, FOUNDER_FACING_ACTIONS, type Memo, type Approval, type ApprovalAction } from './models/memo';
export { MemoRepository, ApprovalRepository } from './repositories/approvals';
export { OutboundService, ApprovalService, type DeliveredMessage } from './services/outbound';
export {
  SsoSessionService,
  SettingsService,
  slugify,
  type SessionContext,
  type WorkspaceSettingsPatch,
} from './services/session';
