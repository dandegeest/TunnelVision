import { Shell } from "./app/Shell";
import { ContinuousCutBridge } from "./playback/continuous-cut";
import { ProjectProvider } from "./project/ProjectProvider";

export default function App() {
  return (
    <ProjectProvider>
      <ContinuousCutBridge>
        <Shell />
      </ContinuousCutBridge>
    </ProjectProvider>
  );
}
