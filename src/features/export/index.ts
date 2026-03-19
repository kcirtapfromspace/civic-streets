// Only export the generator function — it dynamically imports @react-pdf/renderer
// Do NOT re-export pdf-document or pdf-styles here, as they pull in @react-pdf
// which uses localStorage at import time and breaks SSR
export { generatePDF } from './pdf-generator';
