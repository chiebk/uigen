import { getUser } from "@/actions";
import { getMostRecentProject } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { MainContent } from "./main-content";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getUser();

  // If user is authenticated, redirect to their most recent project
  if (user) {
    const recentProject = await getMostRecentProject();

    if (recentProject) {
      redirect(`/${recentProject.id}`);
    }

    // If no projects exist, create a new one
    const newProject = await createProject({
      name: `New Design #${~~(Math.random() * 100000)}`,
      messages: [],
      data: {},
    });

    redirect(`/${newProject.id}`);
  }

  // For anonymous users, show the main content without a project
  return <MainContent user={user} />;
}
