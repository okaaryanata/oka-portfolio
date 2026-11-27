import { Layout } from '../shared/ui/Layout';
import { ProfileContent } from '../features/portfolio/ProfileContent';
import { ProjectGallery } from '../features/portfolio/ProjectGallery';
import { Contact } from '../features/portfolio/Contact';
export function Home() {
  return (
    <Layout>
      <main id="main" className="wrap">
        <ProfileContent />
        <ProjectGallery />
        <Contact />
      </main>
    </Layout>
  );
}
