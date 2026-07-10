export { loadConfig, type AppConfig } from './config';
export {
  workspaceSchema,
  userSchema,
  membershipSchema,
  type Workspace,
  type User,
  type Membership,
} from './models/workspace';
export { getDb, closeMongo } from './repositories/mongo';
export {
  WorkspaceRepository,
  UserRepository,
  MembershipRepository,
} from './repositories/workspaces';
export { ensureDevSession, type DevSession } from './services/dev-session';
export {
  rubricDimensionSchema,
  rubricSchema,
  thesisSchema,
  type Rubric,
  type RubricDimension,
  type RubricDiff,
  type RubricWeightChange,
  type RubricCriteriaChange,
  type Thesis,
} from './models/thesis';
export { ThesisRepository } from './repositories/theses';
export { compileThesis, diffRubrics, matchDimension, rubricFromYaml, rubricToYaml } from './services/rubric';
export { ThesisService } from './services/thesis';
export {
  pageRefSchema,
  dealSchema,
  dealDocumentSchema,
  evidenceSchema,
  fitScoreBreakdownSchema,
  founderContactSchema,
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
export { LocalObjectStorage, getStorage, type ObjectStorage } from './storage';
export { scoreDeal } from './services/scoring';
export { DealService, type UploadFile, type CreateDealOptions } from './services/deals';
export { GatekeeperService, type IntakeSubmission, type IntakeGate } from './services/gatekeeper';
