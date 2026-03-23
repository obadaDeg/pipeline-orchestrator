# Research: Dashboard UI Redesign

**Date**: 2026-03-23 | **Branch**: `006-dashboard-ui-redesign`

---

## 1. Icon Library — Lucide React

**Decision**: Lucide React (`lucide-react`)
**Rationale**: Tree-shakeable individual React components; excellent TypeScript types; consistent 24px stroke-width-2 style that matches the intended aesthetic; 1400+ icons covering all needed use cases.
**Alternatives considered**: Heroicons (fewer icons, Tailwind-official), Phosphor (heavier), inline SVGs (tedious at scale).

**Installation**:
```bash
cd dashboard && npm install lucide-react
```

**Usage pattern**:
```tsx
import { GitBranch, Briefcase, User, LogOut, ChevronRight, Users, Clock, Copy, Trash2, Pencil, CheckCircle2, XCircle, Loader2, Zap, AlertCircle } from 'lucide-react';

// In JSX:
<GitBranch size={20} className="text-gray-500" />
<Loader2 size={16} className="animate-spin" />  // spinner
```

**Recommended icon assignments**:
| UI Element | Icon |
|-----------|------|
| Pipelines nav | `Zap` |
| Jobs nav | `Briefcase` |
| Account nav | `User` |
| Logout | `LogOut` |
| Card link chevron | `ChevronRight` |
| Subscriber count | `Users` |
| Timestamp | `Clock` |
| Copy webhook URL | `Copy` |
| Delete | `Trash2` |
| Edit | `Pencil` |
| Success status | `CheckCircle2` |
| Failed status | `XCircle` |
| Loading spinner | `Loader2` |
| Empty state (pipelines) | `Zap` |
| Empty state (jobs) | `Briefcase` |
| Warning/error | `AlertCircle` |

---

## 2. JSON Syntax Highlighting — highlight.js (JSON language only)

**Decision**: highlight.js core + JSON language pack only
**Rationale**: ~5KB gzipped for JSON-only import; no React-specific adapter needed; works reliably with `useEffect` + DOM ref; widely used.
**Alternatives considered**: Prism.js (similar size, less straightforward Vite integration), react-json-view (much heavier, interactive — not needed), hand-coded (error-prone for nested JSON).

**Installation**:
```bash
cd dashboard && npm install highlight.js
```

**Usage in React**:
```tsx
// CodeBlock.tsx
import { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github.css';  // light theme

hljs.registerLanguage('json', json);

export function CodeBlock({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = code;           // set textContent (not innerHTML) — avoids XSS
      ref.current.className = 'language-json';  // reset class before re-highlighting
      hljs.highlightElement(ref.current);
    }
  }, [code]);

  return (
    <pre className="rounded-lg overflow-x-auto text-sm border border-gray-200">
      <code ref={ref} />
    </pre>
  );
}
```

**Vite note**: The CSS import (`highlight.js/styles/github.css`) works natively in Vite — no special configuration needed.

---

## 3. Animations — Tailwind CSS Transitions Only

**Decision**: CSS transitions via Tailwind utility classes
**Rationale**: Zero bundle overhead; sufficient for slide-over (translate-x) and toast (opacity + translate-y) animations; no new abstraction.
**Alternatives considered**: Framer Motion (~30KB), Headless UI Transition (~8KB) — both rejected as overkill for two simple animations.

**Slide-over animation pattern**:
```tsx
// Panel classes controlled by `open` prop:
const panelClass = `fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50
  flex flex-col transform transition-transform duration-300 ease-in-out
  ${open ? 'translate-x-0' : 'translate-x-full'}`;

// Backdrop:
const backdropClass = `fixed inset-0 bg-black/40 z-40
  transition-opacity duration-300
  ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`;
```

**Toast animation pattern**:
```tsx
// Each toast animates in via:
// Initial: opacity-0 translate-y-2
// Mounted: opacity-100 translate-y-0 (transition-all duration-300)
// Dismissing: opacity-0 translate-y-2 (before removal from DOM)
```

**Note**: To animate toast exit (before `removeToast`), use a two-step: set a `dismissing` flag on the toast → wait 300ms for animation → then remove from array.

---

## 4. Tailwind Sidebar Pattern

**Fixed sidebar structure**:
```tsx
<aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">
  {/* Logo area */}
  <div className="h-16 flex items-center px-6 border-b border-gray-200">
    <Zap size={22} className="text-indigo-600" />
    <span className="ml-2 font-semibold text-gray-900 text-sm">Pipeline Orchestrator</span>
  </div>

  {/* Nav links */}
  <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
    {navItems.map(item => (
      <NavLink key={item.to} to={item.to}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
           ${isActive
             ? 'bg-indigo-50 text-indigo-700'
             : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
           }`
        }
      >
        <item.icon size={18} />
        {item.label}
      </NavLink>
    ))}
  </nav>

  {/* User section */}
  <div className="border-t border-gray-200 p-4">
    <p className="text-xs text-gray-500 truncate mb-2">{userEmail}</p>
    <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
      <LogOut size={16} /> Logout
    </button>
  </div>
</aside>
```

**Content area offset**:
```tsx
<main className="ml-60 min-h-screen bg-gray-50">
  <div className="p-8">{children}</div>
</main>
```

---

## 5. Card Grid Pattern

```tsx
{/* Grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
  {pipelines.map(p => (
    <Link key={p.id} to={`/pipelines/${p.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
        <Badge variant={p.actionType} />
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <Users size={14} />
          {subscriberCount} subscribers
        </span>
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {formatRelative(p.createdAt)}
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <ChevronRight size={16} className="text-gray-400" />
      </div>
    </Link>
  ))}
</div>
```

---

## 6. Skeleton Loaders

```tsx
// SkeletonCard
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="h-5 bg-gray-200 rounded-full w-20" />
      </div>
      <div className="flex gap-4">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-4 bg-gray-200 rounded w-20" />
      </div>
    </div>
  );
}
```

---

## 7. Toast Notification System

**Pattern**: React Context + useReducer + auto-dismiss via setTimeout

```tsx
// ToastContext.tsx
type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'ADD': return [action.toast, ...state];
    case 'REMOVE': return state.filter(t => t.id !== action.id);
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString();
    dispatch({ type: 'ADD', toast: { id, message, type } });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}
```

**ToastContainer positioning**:
```tsx
<div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
  {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={removeToast} />)}
</div>
```

---

## 8. Design Token Decisions

**Primary palette** (indigo-based, consistent with Linear aesthetic):

| Token | Tailwind Class | Hex |
|-------|---------------|-----|
| Primary | `indigo-600` | #4F46E5 |
| Primary hover | `indigo-700` | #4338CA |
| Primary light | `indigo-50` | #EEF2FF |
| Surface | `white` | #FFFFFF |
| Page bg | `gray-50` | #F9FAFB |
| Border | `gray-200` | #E5E7EB |
| Text primary | `gray-900` | #111827 |
| Text secondary | `gray-500` | #6B7280 |

**Inter font** — add to `tailwind.config.ts`:
```ts
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
};
```

**Add to `src/index.css`**:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

---

## 9. Badge Color Mapping

```ts
const BADGE_STYLES: Record<string, string> = {
  // Action types
  field_extractor: 'bg-blue-100 text-blue-700',
  payload_filter:  'bg-amber-100 text-amber-700',
  http_enricher:   'bg-violet-100 text-violet-700',
  // Job statuses
  pending:    'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
  // Delivery attempt statuses
  success: 'bg-green-100 text-green-700',
};

const BADGE_LABELS: Record<string, string> = {
  field_extractor: 'Field Extractor',
  payload_filter:  'Payload Filter',
  http_enricher:   'HTTP Enricher',
  pending:    'Pending',
  processing: 'Processing',
  completed:  'Completed',
  failed:     'Failed',
  success:    'Success',
};
```
