import { useProject } from "../project/ProjectProvider";

export function StoryView() {
  const { project } = useProject();

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-auto px-6 py-8">
      <p className="text-sm tracking-[0.2em] text-[#9a8f7e] uppercase">Planned journey</p>
      <p className="text-xl leading-relaxed">{project.story}</p>
      <p className="text-sm text-[#9a8f7e]">
        Loop: A → B → C → D → E → A. F is another occurrence of A, not a sixth generated world.
      </p>
      <ol className="grid grid-cols-5 gap-3">
        {project.destinations.map((destination) => (
          <li key={destination.id} className="min-w-0">
            <img
              src={destination.image}
              alt={`Destination ${destination.label}`}
              className="aspect-video w-full rounded object-cover"
            />
            <p className="mt-2 text-center text-sm tracking-[0.18em]">{destination.label}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
