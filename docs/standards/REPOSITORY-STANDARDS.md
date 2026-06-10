# Repository Standards

This file contains the enforceable repository standards for Odin.

## No God Classes / God Components

- **Why it's wrong**: Files that accumulate many unrelated responsibilities become hard to review, hard to test, and hard to change safely. They create tight coupling, increase merge conflicts, and make small changes risky because unrelated behavior lives in the same place.
- **Anti-pattern examples**:
  ```ts
  class OrderManager {
    validateOrder() {}
    calculateTax() {}
    calculateShipping() {}
    chargePayment() {}
    sendConfirmationEmail() {}
    generateInvoice() {}
    updateInventory() {}
  }
  ```
  ```tsx
  export function UserDashboard() {
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({});
    const [analytics, setAnalytics] = useState(null);

    async function fetchUsers() {}
    async function fetchAnalytics() {}
    function validateFilters() {}
    function exportCsv() {}

    return <View>{/* 200+ lines of JSX */}</View>;
  }
  ```
- **Correct approach**: Split responsibilities by concern, keep orchestrators thin, and move validation, data access, formatting, and rendering into focused units.
  ```ts
  class OrderValidator {
    validate() {}
  }

  class PaymentService {
    charge() {}
  }

  class InventoryService {
    update() {}
  }

  class OrderProcessor {
    process() {}
  }
  ```
  ```tsx
  import { useUsers } from "./hooks/useUsers";
  import { UserFilters } from "./UserFilters";
  import { UserTable } from "./UserTable";

  export function UserDashboard() {
    const { users, isLoading } = useUsers();

    if (isLoading) {
      return <Text>Loading...</Text>;
    }

    return (
      <View>
        <UserFilters />
        <UserTable users={users} />
      </View>
    );
  }
  ```

## Don't Repeat Yourself (DRY)

- **Why it's wrong**: Duplicated logic diverges over time. One copy gets fixed while another is forgotten, creating inconsistent behavior and bugs that are difficult to trace.
- **Anti-pattern examples**:
  ```ts
  if (!email || !email.includes("@") || email.length > 255) {
    throw new Error("Invalid email");
  }
  ```
  ```ts
  if (!email || !email.includes("@") || email.length > 255) {
    throw new Error("Invalid email");
  }
  ```
- **Correct approach**: Extract shared logic into a reusable function, helper, module, or package at the correct boundary once it is clearly repeated.
  ```ts
  export function validateEmail(email: string) {
    if (!email || !email.includes("@") || email.length > 255) {
      throw new Error("Invalid email");
    }
  }
  ```
  ```ts
  validateEmail(email);
  ```

## No Sensitive Data in Logs

- **Why it's wrong**: Logs are widely accessible operational artifacts. Logging secrets, tokens, credentials, or PII creates security risk, compliance problems, and long-lived exposure far beyond the request lifecycle.
- **Anti-pattern examples**:
  ```ts
  logger.info("User created", user);
  console.log("Request body", req.body);
  ```
  ```ts
  logger.debug("API key", { key: process.env.STRIPE_SECRET_KEY });
  console.log("Auth response", authResponse);
  ```
- **Correct approach**: Log only safe identifiers and operational context, and redact or omit sensitive fields.
  ```ts
  logger.info("User created", {
    user_id: user.id,
    role: user.role,
  });
  ```
  ```ts
  logger.error("Auth failed", {
    user_id: userId,
    reason: "invalid_credentials",
  });
  ```

## Always Add Confirmation for Destructive Actions

- **Why it's wrong**: One-click destructive actions lead to accidental data loss, broken trust, and unnecessary support work. This is worse when the action is irreversible or affects external systems.
- **Anti-pattern examples**:
  ```tsx
  <Button onPress={() => deleteWorkout(workout.id)}>Delete</Button>
  ```
  ```tsx
  <Pressable onPress={() => detachPaymentMethod(method.id)}>
    <Text>Remove card</Text>
  </Pressable>
  ```
- **Correct approach**: Add explicit confirmation before destructive actions. Use at least a two-step confirmation, and use stronger confirmation for higher-stakes actions.
  ```tsx
  const [confirming, setConfirming] = useState(false);

  return !confirming ? (
    <Button onPress={() => setConfirming(true)}>Delete</Button>
  ) : (
    <View>
      <Button onPress={() => setConfirming(false)}>Cancel</Button>
      <Button
        onPress={() => {
          deleteWorkout(workout.id);
          setConfirming(false);
        }}
      >
        Confirm Delete
      </Button>
    </View>
  );
  ```

## Don't Store PII in Client-Side Storage Keys

- **Why it's wrong**: Client-side storage keys are easy to inspect through browser devtools, extensions, shared machines, and debugging sessions. If emails, names, phone numbers, or other PII are embedded in key names, that information is exposed even before the stored value is read.
- **Anti-pattern examples**:
  ```ts
  const key = `draft_${user.email}_${slug}`;
  localStorage.setItem(key, content);
  ```
  ```ts
  const key = `profile_${user.phoneNumber}`;
  sessionStorage.setItem(key, JSON.stringify(profile));
  ```
- **Correct approach**: Use opaque identifiers such as internal IDs or slugs in storage keys, and never use email, name, or phone values in the key itself.
  ```ts
  const key = `draft_${user.id}_${slug}`;
  localStorage.setItem(key, content);
  ```
  ```ts
  const key = `profile_${user.id}`;
  sessionStorage.setItem(key, JSON.stringify(profile));
  ```

## Every Mutation Must Scope by Tenant ID

- **Why it's wrong**: Mutations that resolve records by bare IDs allow unauthorized writes when ownership is not enforced. In Odin, this rule maps to `user_id` ownership: every write must be scoped to the authenticated user, even though the app is not multi-tenant.
- **Anti-pattern examples**:
  ```ts
  async function updateWorkout(workoutId: string, payload: UpdateWorkoutInput) {
    return db.workout.update({
      where: { id: workoutId },
      data: payload,
    });
  }
  ```
  ```py
  def delete_plan(plan_id: int):
      plan = repo.get_by_id(plan_id)
      repo.delete(plan)
  ```
- **Correct approach**: Scope every mutation through the authenticated user's ownership boundary before updating, deleting, or inserting related records.
  ```ts
  async function updateWorkout(userId: string, workoutId: string, payload: UpdateWorkoutInput) {
    return db.workout.update({
      where: { id: workoutId, userId },
      data: payload,
    });
  }
  ```
  ```py
  def delete_plan(user_id: int, plan_id: int):
      plan = repo.get_by_user_and_id(user_id=user_id, plan_id=plan_id)
      repo.delete(plan)
  ```

## Whitelist Sort Columns to Prevent SQL Injection

- **Why it's wrong**: User-controlled sort fields and directions can turn into SQL injection or invalid query behavior if they are passed through directly. Even when injection is not possible, unbounded sort inputs produce fragile APIs and inconsistent database access paths.
- **Anti-pattern examples**:
  ```ts
  const sortBy = req.query.sortBy as string;
  const direction = req.query.direction as string;

  const rows = await db.query(
    `SELECT * FROM exercises ORDER BY ${sortBy} ${direction}`,
  );
  ```
  ```ts
  const sortBy = req.query.sortBy as string;
  return prisma.user.findMany({
    orderBy: { [sortBy]: "asc" },
  });
  ```
- **Correct approach**: Whitelist both sortable columns and directions explicitly, and fall back to a safe default when an input is not allowed.
  ```ts
  const allowedColumns = ["createdAt", "name", "status"] as const;
  const allowedDirections = ["asc", "desc"] as const;

  const sortBy = allowedColumns.includes(req.query.sortBy as (typeof allowedColumns)[number])
    ? req.query.sortBy
    : "createdAt";

  const direction = allowedDirections.includes(req.query.direction as (typeof allowedDirections)[number])
    ? req.query.direction
    : "desc";
  ```
  ```ts
  return prisma.user.findMany({
    orderBy: { [sortBy]: direction },
  });
  ```

## Replace N+1 Queries in Loops with Batch Queries

- **Why it's wrong**: Querying inside loops multiplies database round trips, slows down requests, and creates avoidable load spikes. What looks harmless with a few records becomes a serious performance problem as data volume grows.
- **Anti-pattern examples**:
  ```ts
  const summaries = [];

  for (const workout of workouts) {
    const sessions = await db.session.findMany({
      where: { workoutId: workout.id },
    });

    summaries.push({ workout, sessions });
  }
  ```
  ```py
  result = []
  for user in users:
      plans = repo.get_plans_for_user(user.id)
      result.append({"user": user, "plans": plans})
  ```
- **Correct approach**: Fetch related data in batches first, then assemble the result in memory.
  ```ts
  const workoutIds = workouts.map((workout) => workout.id);
  const sessions = await db.session.findMany({
    where: { workoutId: { in: workoutIds } },
  });

  const sessionsByWorkoutId = new Map<string, Session[]>();
  for (const session of sessions) {
    const existing = sessionsByWorkoutId.get(session.workoutId) ?? [];
    existing.push(session);
    sessionsByWorkoutId.set(session.workoutId, existing);
  }

  const summaries = workouts.map((workout) => ({
    workout,
    sessions: sessionsByWorkoutId.get(workout.id) ?? [],
  }));
  ```
  ```py
  user_ids = [user.id for user in users]
  plans = repo.get_plans_for_users(user_ids)
  ```

## Always Include Diagnostic Context in Log Calls

- **Why it's wrong**: Bare log strings are difficult to use in production because they cannot be tied back to a user, request, or record. At the same time, logging too much raw data creates security risk, so the right approach is safe, structured diagnostic context.
- **Anti-pattern examples**:
  ```ts
  logger.warn("Workout not found");
  logger.error("Failed to save plan");
  ```
  ```py
  logger.info("Sync completed")
  logger.error("Request failed")
  ```
- **Correct approach**: Include safe identifiers and operational context such as `user_id`, record IDs, request IDs, counts, and statuses.
  ```ts
  logger.warn("Workout not found", {
    user_id: authUser.id,
    workout_id: workoutId,
  });

  logger.error("Failed to save plan", {
    user_id: authUser.id,
    plan_id: planId,
    request_id: requestId,
  });
  ```
  ```py
  logger.info("Sync completed", {
      "user_id": user_id,
      "result_count": len(results),
  })
  ```

## Strict Comparison Fails Across HTTP Boundaries

- **Why it's wrong**: Values that cross HTTP boundaries usually arrive as strings, while persisted IDs and numeric fields are often stored as numbers. Strict comparison between mismatched types silently fails and can make authorization, branching, and data checks behave incorrectly.
- **Anti-pattern examples**:
  ```ts
  if (req.query.userId === record.userId) {
    allowAccess();
  }
  ```
  ```ts
  if (req.params.planId === currentPlan.id) {
    return currentPlan;
  }
  ```
- **Correct approach**: Convert values to matching types before strict comparison.
  ```ts
  if (Number(req.query.userId) === record.userId) {
    allowAccess();
  }
  ```
  ```ts
  if (Number(req.params.planId) === currentPlan.id) {
    return currentPlan;
  }
  ```

## Write Endpoints Need Authorization Even More Than Read Endpoints

- **Why it's wrong**: Read endpoints expose data, but write endpoints change it. Missing authorization on writes creates privilege escalation paths that let authenticated users alter records they should never be able to modify.
- **Anti-pattern examples**:
  ```ts
  app.get("/plans", requirePermission("plan:read"), listPlans);

  app.post("/plans", createPlan);
  app.patch("/plans/:id", updatePlan);
  app.delete("/plans/:id", deletePlan);
  ```
  ```py
  @router.get("/goals")
  def list_goals():
      authorize("goal:read")
      return service.list_goals()

  @router.post("/goals")
  def create_goal(payload: GoalPayload):
      return service.create_goal(payload)
  ```
- **Correct approach**: Enforce authorization explicitly on write endpoints, and do not assume that protecting reads is sufficient.
  ```ts
  app.get("/plans", requirePermission("plan:read"), listPlans);
  app.post("/plans", requirePermission("plan:create"), createPlan);
  app.patch("/plans/:id", requirePermission("plan:update"), updatePlan);
  app.delete("/plans/:id", requirePermission("plan:delete"), deletePlan);
  ```
  ```py
  @router.post("/goals")
  def create_goal(payload: GoalPayload):
      authorize("goal:create")
      return service.create_goal(payload)
  ```

## Frontend App Standards

These rules apply to the frontend application in `odin/apps/app/`.

## Zustand Standards

- **Why it's wrong**: Without clear store boundaries and selector discipline, Zustand becomes a global dumping ground that causes unnecessary re-renders, hidden coupling, and scattered state mutation logic inside components.
- **Anti-pattern examples**:
  ```ts
  export const useAppStore = create((set) => ({
    user: null,
    theme: "light",
    workouts: [],
    modals: {},
    filters: {},
    setUser: (user) => set({ user }),
    setTheme: (theme) => set({ theme }),
    setWorkouts: (workouts) => set({ workouts }),
  }));
  ```
  ```tsx
  const state = useWorkoutStore();

  function handleToggle() {
    state.setIsEditing(!state.isEditing);
  }
  ```
- **Correct approach**: Use one store per domain, keep actions inside the store, use atomic selectors, and subscribe only to the fields a component needs.
  ```ts
  import { create } from "zustand";

  interface WorkoutUiState {
    selectedWorkoutId: string | null;
    isEditing: boolean;
    selectWorkout: (workoutId: string | null) => void;
    setEditing: (value: boolean) => void;
  }

  const initialState = {
    selectedWorkoutId: null,
    isEditing: false,
  };

  export const useWorkoutUiStore = create<WorkoutUiState>((set) => ({
    ...initialState,
    selectWorkout: (selectedWorkoutId) => set({ selectedWorkoutId }),
    setEditing: (isEditing) => set({ isEditing }),
  }));
  ```
  ```tsx
  const isEditing = useWorkoutUiStore((s) => s.isEditing);
  const setEditing = useWorkoutUiStore((s) => s.setEditing);

  function handleToggle() {
    setEditing(!isEditing);
  }
  ```

## Zustand Selectors

- **Why it's wrong**: Subscribing to the whole store or returning fresh objects from selectors causes avoidable re-renders and makes component performance degrade as stores grow.
- **Anti-pattern examples**:
  ```tsx
  const store = useSessionStore();
  ```
  ```tsx
  const { currentPage, pageCount } = useSessionStore((s) => ({
    currentPage: s.currentPage,
    pageCount: s.pageCount,
  }));
  ```
- **Correct approach**: Use atomic selectors for single values, and use `useShallow` when selecting multiple shallow values together.
  ```tsx
  const currentPage = useSessionStore((s) => s.currentPage);
  ```
  ```tsx
  import { useShallow } from "zustand/react/shallow";

  const { currentPage, pageCount } = useSessionStore(
    useShallow((s) => ({
      currentPage: s.currentPage,
      pageCount: s.pageCount,
    })),
  );
  ```

## Zustand Cross-Store Communication

- **Why it's wrong**: Passing one store into another store's definition tightly couples store creation and makes the state graph harder to reason about.
- **Anti-pattern examples**:
  ```ts
  export const useAuthStore = create((set, get) => ({
    logout: () => {
      const workoutStore = useWorkoutStore();
      workoutStore.reset();
      set({ user: null });
    },
  }));
  ```
- **Correct approach**: Use `getState()` or `setState()` on the other store explicitly when cross-store coordination is necessary.
  ```ts
  export const useAuthStore = create((set) => ({
    logout: () => {
      useWorkoutStore.setState({ selectedWorkoutId: null, isEditing: false });
      set({ user: null });
    },
  }));
  ```

## Zustand Async Actions

- **Why it's wrong**: Keeping async orchestration outside the store scatters loading and error management across components and makes shared state behavior inconsistent.
- **Anti-pattern examples**:
  ```tsx
  const setPlans = usePlanStore((s) => s.setPlans);
  const setLoading = usePlanStore((s) => s.setLoading);

  useEffect(() => {
    setLoading(true);
    fetchPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, [setPlans, setLoading]);
  ```
- **Correct approach**: Put shared async actions inside the store, manage loading and error state there, and use `get()` for current state checks.
  ```ts
  interface PlanStore {
    plans: Plan[];
    isLoading: boolean;
    fetchPlans: (userId: string) => Promise<void>;
  }

  export const usePlanStore = create<PlanStore>((set, get) => ({
    plans: [],
    isLoading: false,
    fetchPlans: async (userId) => {
      if (get().isLoading) return;

      set({ isLoading: true });
      try {
        const plans = await fetchPlansForUser(userId);
        set({ plans, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },
  }));
  ```

## What Not to Put in Zustand

- **Why it's wrong**: Using Zustand for the wrong kinds of state makes the app harder to reason about and turns shared state into a substitute for normal component boundaries.
- **Anti-pattern examples**:
  ```ts
  export const useAppStore = create((set) => ({
    emailInput: "",
    passwordInput: "",
    tooltipOpen: false,
    hoveredCardId: null,
    setEmailInput: (emailInput) => set({ emailInput }),
  }));
  ```
- **Correct approach**: Put shared client-owned cross-component state in Zustand, but keep form input, hover state, and one-off ephemeral UI local to the component. Keep server data in the appropriate server-state layer once that exists.
  ```tsx
  const [emailInput, setEmailInput] = useState("");
  const [tooltipOpen, setTooltipOpen] = useState(false);
  ```

## Component Architecture Standards

- **Why it's wrong**: Monolithic components become the dumping ground for rendering, data fetching, validation, formatting, and orchestration. They are hard to test, hard to review, and expensive to change because unrelated concerns are coupled together in one file.
- **Anti-pattern examples**:
  ```tsx
  type User = {
    id: string;
    name: string;
    email: string;
  };

  export function UserDashboard() {
    const [users, setUsers] = useState<User[]>([]);
    const [filters, setFilters] = useState({});
    const [analytics, setAnalytics] = useState(null);

    async function fetchUsers() {}
    async function fetchAnalytics() {}
    function validateFilters() {}
    function exportCsv() {}

    return <View>{/* 200+ lines of JSX */}</View>;
  }
  ```
  ```tsx
  function DashboardPage() {
    const [user, setUser] = useState(null);

    return (
      <Layout user={user}>
        <Sidebar user={user}>
          <Navigation user={user}>
            <UserMenu user={user} />
          </Navigation>
        </Sidebar>
      </Layout>
    );
  }
  ```
- **Correct approach**: Keep components focused, colocate component-specific types, extract reusable behavior into hooks, and avoid deep prop drilling by using the appropriate store or context boundary.
  ```tsx
  import type { User } from "../types/user";
  import { useUsers } from "./hooks/useUsers";
  import { UserFilters } from "./UserFilters";
  import { UserTable } from "./UserTable";

  type UserDashboardProps = {
    currentUserId: string;
  };

  export function UserDashboard({ currentUserId }: UserDashboardProps) {
    const { users, isLoading } = useUsers(currentUserId);

    if (isLoading) {
      return <Text>Loading...</Text>;
    }

    return (
      <View>
        <UserFilters />
        <UserTable users={users} />
      </View>
    );
  }
  ```

## Don't Share Mutation Pending State Across a List

- **Why it's wrong**: A single pending flag for a whole list disables unrelated items and creates misleading UI. Users think the entire list is blocked even though they only acted on one item.
- **Anti-pattern examples**:
  ```tsx
  const deleteMutation = useDeleteWorkout();

  return workouts.map((workout) => (
    <WorkoutCard
      key={workout.id}
      workout={workout}
      isDeleting={deleteMutation.isPending}
      onDelete={() => deleteMutation.mutate(workout.id)}
    />
  ));
  ```
  ```tsx
  const archiveMutation = useArchivePlan();

  plans.map((plan) => (
    <PlanRow
      key={plan.id}
      disabled={archiveMutation.isPending}
      onArchive={() => archiveMutation.mutate(plan.id)}
    />
  ));
  ```
- **Correct approach**: Track pending state per item and clear it on settle so only the active row or card reflects loading.
  ```tsx
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteMutation = useDeleteWorkout();

  return workouts.map((workout) => (
    <WorkoutCard
      key={workout.id}
      workout={workout}
      isDeleting={pendingDeleteId === workout.id}
      onDelete={() => {
        setPendingDeleteId(workout.id);
        deleteMutation.mutate(workout.id, {
          onSettled: () => setPendingDeleteId(null),
        });
      }}
    />
  ));
  ```

## Don't Use Magic Pixel Numbers for Positioning

- **Why it's wrong**: Magic pixel values create invisible coupling between unrelated layout pieces. They usually work only for one exact content height, spacing setup, or screen size, and they silently break when the surrounding UI changes.
- **Anti-pattern examples**:
  ```tsx
  <View className="relative">
    <TextInput placeholder="Password" />
    <Pressable className="absolute right-3 top-[39px]">
      <EyeIcon />
    </Pressable>
  </View>
  ```
  ```tsx
  <View style={{ marginTop: 47 }}>
    <Text>Aligned element</Text>
  </View>
  ```
- **Correct approach**: Use flex layout, alignment primitives, relative wrappers, and explainable spacing derived from the layout system.
  ```tsx
  <View>
    <Text className="mb-2">Password</Text>
    <View className="relative flex-row items-center">
      <TextInput className="flex-1 pr-12" placeholder="Password" />
      <Pressable className="absolute right-3">
        <EyeIcon />
      </Pressable>
    </View>
  </View>
  ```

## Guard Against Auth Hydration Flashes

- **Why it's wrong**: Rendering auth-dependent UI before auth state finishes resolving causes incorrect content to flash briefly. Users can see warnings, redirects, or protected UI in the wrong state for a frame, which makes the app look broken.
- **Anti-pattern examples**:
  ```tsx
  const { user } = useAuth();
  const { data: plans } = usePlans(user?.id ?? "");
  const hasPlans = (plans?.length ?? 0) > 0;

  return !hasPlans ? <EmptyState /> : <PlanList plans={plans ?? []} />;
  ```
  ```tsx
  const { permissions } = usePermissions();
  const canManageUsers = permissions?.includes("user:manage") ?? false;

  return canManageUsers ? <AdminPanel /> : <AccessDenied />;
  ```
- **Correct approach**: Add explicit loading or hydration guards and treat unresolved state as different from loaded-empty or loaded-denied state.
  ```tsx
  const { user, isHydrating } = useAuth();
  const { data: plans, isLoading } = usePlans(user?.id ?? "");

  if (isHydrating || isLoading) {
    return <Text>Loading...</Text>;
  }

  const hasPlans = plans.length > 0;
  return hasPlans ? <PlanList plans={plans} /> : <EmptyState />;
  ```
