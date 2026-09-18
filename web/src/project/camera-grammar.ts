import {
  CAMERA_GRAMMARS,
  CAMERA_GRAMMAR_LABEL,
  DEFAULT_CAMERA_GRAMMAR,
  cameraGrammarFromUnknown,
  isCameraGrammar,
  type CameraGrammar,
} from "../../../media/src/cinematographer/camera-grammar.ts";
import type { Project } from "./types";

export {
  CAMERA_GRAMMARS,
  CAMERA_GRAMMAR_LABEL,
  DEFAULT_CAMERA_GRAMMAR,
  cameraGrammarFromUnknown,
  isCameraGrammar,
};
export type { CameraGrammar };

export function cameraGrammarFromProject(project: Pick<Project, "cameraGrammar">): CameraGrammar {
  return cameraGrammarFromUnknown(project.cameraGrammar);
}

export function projectWithCameraGrammar(project: Project, grammar: CameraGrammar): Project {
  const next = cameraGrammarFromUnknown(grammar);
  if (cameraGrammarFromProject(project) === next && project.cameraGrammar === next) {
    return project;
  }
  return { ...project, cameraGrammar: next };
}
