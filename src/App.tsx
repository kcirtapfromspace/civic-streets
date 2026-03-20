import { useStreetStore } from '@/stores/street-store';
import { EditorPage } from '@/features/editor';
import { NewStreetForm } from '@/features/editor/NewStreetForm';
import { TemplateGalleryModal } from '@/features/gallery';

export default function App() {
  const currentStreet = useStreetStore((s) => s.currentStreet);

  if (!currentStreet) {
    return <NewStreetForm />;
  }

  return (
    <>
      <EditorPage />
      <TemplateGalleryModal />
    </>
  );
}
