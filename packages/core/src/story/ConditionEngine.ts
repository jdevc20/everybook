export class ConditionEngine {
  static evaluate(
    condition: string | undefined,
    variables: Record<string, unknown>
  ): boolean {
    if (!condition || condition.trim() === "") {
      return true;
    }

    const normalized = condition.trim();

    const match = normalized.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/
    );

    if (!match) {
      console.warn(`Unsupported condition: ${condition}`);
      return false;
    }

    const [, key, operator, rawValue] = match;

    const left = variables[key];
    const right = this.parseValue(rawValue);

    switch (operator) {
      case "==":
        return left === right;

      case "!=":
        return left !== right;

      case ">":
        return Number(left) > Number(right);

      case "<":
        return Number(left) < Number(right);

      case ">=":
        return Number(left) >= Number(right);

      case "<=":
        return Number(left) <= Number(right);

      default:
        return false;
    }
  }

  private static parseValue(value: string): unknown {
    const trimmed = value.trim();

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;

    if (!Number.isNaN(Number(trimmed))) {
      return Number(trimmed);
    }

    return trimmed.replace(/^["']|["']$/g, "");
  }
}