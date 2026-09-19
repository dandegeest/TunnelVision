import { describe, expect, it } from "vitest";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { createNewProject } from "./new-project";
import {
  cameraGrammarFromProject,
  cameraGrammarFromUnknown,
  cameraGrammarIsLocked,
  projectWithCameraGrammar,
} from "./camera-grammar";
import { hydrateProject, serializeProjectDocuments } from "./persistence/serialize";

describe("project camera grammar", () => {
  it("defaults new projects to POV", () => {
    const project = createNewProject();
    expect(project.cameraGrammar).toBe("pov");
    expect(cameraGrammarFromProject(project)).toBe("pov");
    expect(cameraGrammarIsLocked(project)).toBe(false);
    expect(cameraGrammarIsLocked(createForestProject())).toBe(true);
  });

  it("treats missing grammar on older projects as POV without requiring stored data", () => {
    const legacy = createNewProject();
    delete legacy.cameraGrammar;
    expect(cameraGrammarFromProject(legacy)).toBe("pov");
    expect(cameraGrammarFromUnknown(undefined)).toBe("pov");
  });

  it("round-trips the selected grammar through project persistence", () => {
    const project = projectWithCameraGrammar(createNewProject(), "lead");
    const documents = serializeProjectDocuments({ project });
    expect(documents.manifest.settings.cameraGrammar).toBe("lead");
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => false,
    });
    expect(hydrated.project.cameraGrammar).toBe("lead");
  });

  it("loads a manifest that omits cameraGrammar as POV", () => {
    const documents = serializeProjectDocuments({ project: createNewProject() });
    delete documents.manifest.settings.cameraGrammar;
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => false,
    });
    expect(hydrated.project.cameraGrammar).toBe("pov");
  });
});
