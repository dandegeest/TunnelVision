import { ProjectProvider } from "./project/ProjectProvider";
import { Shell } from "./app/Shell";

export default function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
