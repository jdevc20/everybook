export class ConditionEngine {
  static evaluate(
    condition: string | undefined,
    variables: Record<string, unknown>
  ): boolean {
    if (!condition || condition.trim() === "") {
      return true;
    }

    const normalized = condition.trim();

    /**
     * Supports:
     * hasKey
     * !hasKey
     */
    const booleanVariableMatch = normalized.match(
      /^!?[a-zA-Z_][a-zA-Z0-9_]*$/
    );

    if (booleanVariableMatch) {
      if (normalized.startsWith("!")) {
        const key = normalized.slice(1);
        return !Boolean(variables[key]);
      }

      return Boolean(variables[normalized]);
    }

    /**
     * Supports:
     * key == value
     * key != value
     * key > value
     * key < value
     * key >= value
     * key <= value
     */
    const comparisonMatch = normalized.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/
    );

    if (!comparisonMatch) {
      console.warn(`Unsupported EveryBook condition: ${condition}`);
      return false;
    }

    const [, key, operator, rawValue] = comparisonMatch;

    const left = variables[key];
    const right = this.parseValue(rawValue);

    switch (operator) {
      case "==":
        return left === right;

      case "!=":
        return left !== right;

      case ">":
        return this.toNumber(left) > this.toNumber(right);

      case "<":
        return this.toNumber(left) < this.toNumber(right);

      case ">=":
        return this.toNumber(left) >= this.toNumber(right);

      case "<=":
        return this.toNumber(left) <= this.toNumber(right);

      default:
        return false;
    }
  }

  static evaluateAll(
    conditions: Array<string | undefined>,
    variables: Record<string, unknown>
  ): boolean {
    return conditions.every((condition) =>
      this.evaluate(condition, variables)
    );
  }

  static evaluateAny(
    conditions: Array<string | undefined>,
    variables: Record<string, unknown>
  ): boolean {
    return conditions.some((condition) =>
      this.evaluate(condition, variables)
    );
  }

  private static parseValue(value: string): unknown {
    const trimmed = value.trim();

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;

    if (this.isQuoted(trimmed)) {
      return trimmed.slice(1, -1);
    }

    if (this.isNumeric(trimmed)) {
      return Number(trimmed);
    }

    return trimmed;
  }

  private static isQuoted(value: string): boolean {
    return (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    );
  }

  private static isNumeric(value: string): boolean {
    return value.trim() !== "" && !Number.isNaN(Number(value));
  }

  private static toNumber(value: unknown): number {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return 0;
    }

    return numberValue;
  }
}