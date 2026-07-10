import { randomUUID } from 'node:crypto';
import type { Rubric, RubricDiff, Thesis } from '../models/thesis';
import type { ThesisRepository } from '../repositories/theses';
import { compileThesis, diffRubrics, rubricFromYaml, rubricToYaml } from './rubric';

export class ThesisService {
  constructor(private readonly theses: ThesisRepository) {}

  /** Compiles an artifact and persists it as the next rubric version for the workspace. */
  async compileAndSave(workspaceId: string, artifact: string): Promise<Thesis> {
    const rubric = compileThesis(artifact);
    if (rubric.dimensions.length === 0) {
      throw new Error('thesis artifact produced no rubric dimensions');
    }
    const active = await this.theses.findActive(workspaceId);
    return this.theses.insert({
      _id: randomUUID(),
      workspaceId,
      yaml: rubricToYaml(rubric),
      version: (active?.version ?? 0) + 1,
      createdAt: new Date(),
    });
  }

  async getActive(workspaceId: string): Promise<Thesis | null> {
    return this.theses.findActive(workspaceId);
  }

  async listVersions(workspaceId: string): Promise<Thesis[]> {
    return this.theses.listVersions(workspaceId);
  }

  rubricOf(thesis: Thesis): Rubric {
    return rubricFromYaml(thesis.yaml);
  }

  diff(before: Thesis, after: Thesis): RubricDiff {
    return diffRubrics(this.rubricOf(before), this.rubricOf(after));
  }
}
