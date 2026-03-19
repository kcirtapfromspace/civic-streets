'use client';

import { useStreetStore } from '@/stores/street-store';
import { EditorPage } from './EditorPage';
import { NewStreetForm } from './NewStreetForm';
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
