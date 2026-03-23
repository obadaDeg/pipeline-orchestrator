# Component & Data Model: Dashboard UI Redesign

This document describes the prop interfaces for every new or redesigned component, plus the shared data types consumed from the existing API. Since this is a pure frontend redesign, the "data model" is the component contract layer — the TypeScript types that flow between the API, contexts, and components.

---

## Shared API Types (consumed unchanged from existing backend)

```ts
// From GET /pipelines
interface Pipeline {
  id: string;
  name: string;
  actionType: 'field_extractor' | 'payload_filter' | 'http_enricher';
  actionConfig: Record<string, unknown>;
  subscribers: Array<{ url: string }> | number;
  createdAt: string; // ISO 8601
}

// From GET /jobs
interface Job {
  id: string;
  pipelineId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// From GET /jobs/:id/delivery-attempts
interface DeliveryAttempt {
  id: string;
  jobId: string;
  subscriberUrl: string;
  status: 'success' | 'failed';
  statusCode: number | null;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  attemptNumber: number;
  createdAt: string;
}

// From GET /auth/keys
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

// From GET /auth/audit-log
interface AuditEvent {
  id: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Standard paginated wrapper
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```

---

## Toast System

```ts
// ToastContext
type ToastType = 'success' | 'error';

interface Toast {
  id: string;          // uuid or Date.now() string
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

// Toast component props
interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

// ToastContainer: no props — reads from ToastContext internally
```

---

## Layout & Navigation

```ts
// Layout component — wraps all authenticated pages
interface LayoutProps {
  children: React.ReactNode;
}

// Sidebar — no props; reads from AuthContext for user email and logout
// NavItem — internal to Sidebar
interface NavItemConfig {
  label: string;
  to: string;                       // React Router path
  icon: React.ComponentType<{ size?: number; className?: string }>;
}
```

---

## Badge

```ts
type ActionType = 'field_extractor' | 'payload_filter' | 'http_enricher';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
type AttemptStatus = 'success' | 'failed';

type BadgeVariant = ActionType | JobStatus | AttemptStatus;

interface BadgeProps {
  variant: BadgeVariant;
  // Displays a pill with color-coded background and label text
}

// Color mapping (internal constant):
// field_extractor  → blue-100 / blue-700
// payload_filter   → amber-100 / amber-700
// http_enricher    → violet-100 / violet-700
// pending          → amber-100 / amber-700
// processing       → blue-100 / blue-700
// completed/success→ green-100 / green-700
// failed           → red-100 / red-700
```

---

## Button

```ts
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;  // default: 'primary'
  size?: ButtonSize;        // default: 'md'
  loading?: boolean;        // shows spinner, disables interaction
  children: React.ReactNode;
}
```

---

## Skeleton Loaders

```ts
// SkeletonCard — matches pipeline card dimensions
// No props — fixed card-shaped pulse block

// SkeletonRow — matches table row height
interface SkeletonRowProps {
  columns?: number;   // default: 4 — number of column cells to render
}
```

---

## SlideOver

```ts
interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;          // form body (scrollable)
  footer: React.ReactNode;            // sticky footer (Cancel + Submit)
}
// Renders: fixed backdrop (z-40) + panel (z-50, right-0, translate-x transition)
```

---

## EmptyState

```ts
interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  heading: string;
  body?: string;
  action?: React.ReactNode;           // optional CTA button
}
```

---

## ErrorState

```ts
interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}
```

---

## Tabs

```ts
interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (key: string) => void;
}
// Tab panels rendered as children below the tab bar;
// the parent controls which content is visible based on activeTab.
```

---

## CodeBlock

```ts
interface CodeBlockProps {
  code: string;       // JSON string to highlight
  language?: string;  // default: 'json'
}
// Renders <pre><code> with highlight.js applied via useEffect + ref.
// Imports: hljs core + json language + github.css theme (light).
```

---

## ConfirmDialog

```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;    // default: 'Delete'
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}
```

---

## Pagination

```ts
// Existing interface preserved — minor style update only
interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

---

## Page-Level Data Requirements

| Page | Primary Data | Secondary Data |
|------|-------------|----------------|
| PipelineListPage | GET /pipelines (paginated) | — |
| PipelineDetailPage | GET /pipelines/:id | GET /pipelines/:id/jobs (Jobs tab) |
| JobDetailPage | GET /jobs/:id | GET /jobs/:id/delivery-attempts |
| AccountPage | GET /auth/keys | GET /auth/audit-log (paginated) |
| LoginPage | POST /auth/login | — |
