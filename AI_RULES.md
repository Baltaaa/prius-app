# Prius - AI Rules & Tech Stack

## Tech Stack
- **React 19**: Core library for building the user interface.
- **TypeScript**: For type safety and better developer experience.
- **Vite**: Fast build tool and development server.
- **Tailwind CSS 3**: Utility-first CSS framework for styling.
- **React Router DOM v7**: For client-side routing and navigation.
- **Supabase**: Backend-as-a-Service for Authentication and Database.
- **Lucide React**: Standard icon library for the application.

## Library Usage Rules
- **Styling**: Use Tailwind CSS with the tokens of `design/DESIGN.md`, the design source of truth. Run `pnpm audit:design` before finishing UI work.
- **Components**: Reuse the primitives in `src/components/brand/` and the shared inputs in `src/components/inputs/`. Create small, focused components in `src/components/`.
- **Icons**: Use `lucide-react` for all interface icons.
- **Animations**: Do NOT use external animation libraries (like Framer Motion). Use pure CSS transitions and keyframes (e.g., for the partners carousel).
- **Routing**: Keep all route definitions in `src/App.tsx`. Use `PrivateRoute` for dashboard protection.
- **State Management**: Use React hooks (`useState`, `useEffect`) and Supabase hooks for data fetching.
- **Images**: Store all public assets in `public/images/` and reference them with relative paths.