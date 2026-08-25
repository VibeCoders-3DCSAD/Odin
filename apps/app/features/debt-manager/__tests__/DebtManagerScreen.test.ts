jest.mock("react-native", () => ({ View: "View", Text: "Text", ActivityIndicator: "ActivityIndicator" }));
jest.mock("../hooks/useDebtManager", () => ({ useDebtManager: jest.fn() }));
jest.mock("../components/DebtHeader", () => ({ DebtHeader: "DebtHeader" }));
jest.mock("../components/DebtPlanSummary", () => ({ DebtPlanSummary: "DebtPlanSummary" }));
jest.mock("../components/DebtStrategySelector", () => ({ DebtStrategySelector: "DebtStrategySelector" }));
jest.mock("../components/DebtForm", () => ({ DebtForm: "DebtForm" }));
jest.mock("../components/DebtCard", () => ({ DebtCard: "DebtCard" }));

import DebtManagerScreen from "../DebtManagerScreen";
import { useDebtManager } from "../hooks/useDebtManager";

const mockUseDebtManager = useDebtManager as jest.Mock;

describe("DebtManagerScreen", () => {
  beforeEach(() => {
    mockUseDebtManager.mockReturnValue({
      debts: [], priorities: [], strategy: "avalanche", debtBudgetMinor: 0, hasCurrentBudget: false,
      plan: { allocations: [], requiredTotalMinor: 0, surplusMinor: 0, shortfallMinor: 0 }, forecastMonths: null,
      loading: false, error: null, name: "", balance: "", minimum: "", presetKey: "credit_card", editingId: null,
      showCreate: false, confirmDeleteId: null, setName: jest.fn(), setBalance: jest.fn(), setMinimum: jest.fn(),
      setPresetKey: jest.fn(), setConfirmDeleteId: jest.fn(), openCreate: jest.fn(), edit: jest.fn(), cancelForm: jest.fn(),
      save: jest.fn(), confirmDelete: jest.fn(), movePriority: jest.fn(), removePriority: jest.fn(), changeStrategy: jest.fn(),
    });
  });

  test("composes the screen from focused feature components", () => {
    const screen = DebtManagerScreen({ userId: "user-1", deviceId: "device-1" });
    const children = screen.props.children as Array<{ type: unknown; props: { children?: unknown } }>;

    expect(children).toHaveLength(6);
    expect(children[0]!.type).toBe("DebtHeader");
    expect(children[1]!.type).toBe("DebtPlanSummary");
    expect(children[2]!.type).toBe("DebtStrategySelector");
    expect(children[5]!.props.children).toBe("No debts yet.");
  });

  test("wires create and strategy actions to the manager", () => {
    const openCreate = jest.fn();
    const changeStrategy = jest.fn();
    mockUseDebtManager.mockReturnValue({
      debts: [], priorities: [], strategy: "avalanche", debtBudgetMinor: 0, hasCurrentBudget: false,
      plan: { allocations: [], requiredTotalMinor: 0, surplusMinor: 0, shortfallMinor: 0 }, forecastMonths: null,
      loading: false, error: null, name: "", balance: "", minimum: "", presetKey: "credit_card", editingId: null,
      showCreate: false, confirmDeleteId: null, openCreate, changeStrategy,
    });

    const screen = DebtManagerScreen({ userId: "user-1", deviceId: "device-1" });
    const children = screen.props.children as Array<{ props: Record<string, any> }>;
    children[0]!.props.onCreate();
    children[2]!.props.onChange("snowball");

    expect(openCreate).toHaveBeenCalledTimes(1);
    expect(changeStrategy).toHaveBeenCalledWith("snowball");
  });
});
