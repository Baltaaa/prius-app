import BrandSelect from '../ui/BrandSelect'

// Alias del combobox único de la app (BrandSelect.tsx) dentro del sistema de
// diseño nuevo — no se bifurca la lógica de portal/teclado/búsqueda, ya
// restyleada al look claro en Fase 1. Usar siempre este import (o BrandSelect
// directo) para cualquier select, nunca un <select> nativo.
export default BrandSelect
