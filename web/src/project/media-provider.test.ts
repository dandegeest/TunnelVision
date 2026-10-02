import { describe, expect, it } from "vitest";
import { createNewProject } from "./new-project";
import { mediaProviderFromProject, projectWithMediaProvider } from "./media-provider";
import { hydrateProject, serializeProjectDocuments } from "./persistence/serialize";

describe("generation provider", () => {
  it("defaults an older project to Runway and keeps an explicit Replicate choice", () => {
    const created = createNewProject();
    expect(created.mediaProvider).toBe("runway");
    const legacy = { ...created, mediaProvider: undefined };
    expect(mediaProviderFromProject(legacy)).toBe("runway");
    const replicate = projectWithMediaProvider(created, "replicate");
    expect(replicate.mediaProvider).toBe("replicate");
    expect(projectWithMediaProvider(replicate, "replicate")).toBe(replicate);

    const documents = serializeProjectDocuments({ project: replicate });
    expect(documents.manifest.settings.mediaProvider).toBe("replicate");
    const hydrated = hydrateProject({
      manifest: documents.manifest,
      canonicals: documents.canonicals,
      traversals: documents.traversals,
      assetExists: () => true,
    });
    expect(hydrated.project.mediaProvider).toBe("replicate");
  });
});
