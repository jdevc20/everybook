/**
 * ConditionEngine
 *
 * A small utility engine for evaluating simple EveryBook conditions.
 *
 * This is used to control story logic such as:
 * - Showing or hiding choices
 * - Unlocking pages
 * - Checking story variables
 * - Validating branching paths
 *
 * Supported condition formats:
 *
 * 1. Boolean variable check:
 *    "hasKey"
 *
 * 2. Negated boolean variable check:
 *    "!hasKey"
 *
 * 3. Comparison checks:
 *    "coins >= 10"
 *    "health < 50"
 *    "ending == 'good'"
 *    "isAlive == true"
 *
 * Supported operators:
 * - ==
 * - !=
 * - >
 * - <
 * - >=
 * - <=
 */
export class ConditionEngine {
  /**
   * Evaluates a single condition against the provided variables.
   *
   * If the condition is undefined, empty, or only whitespace,
   * it returns true by default.
   *
   * This allows EveryBook entries without conditions to be shown normally.
   *
   * @param condition - The condition string to evaluate.
   * @param variables - The current story variables/state.
   * @returns true if the condition passes, otherwise false.
   *
   * @example
   * ConditionEngine.evaluate("hasKey", { hasKey: true });
   * // true
   *
   * @example
   * ConditionEngine.evaluate("coins >= 10", { coins: 15 });
   * // true
   *
   * @example
   * ConditionEngine.evaluate("ending == 'good'", { ending: "bad" });
   * // false
   */
  static evaluate(
    condition: string | undefined,
    variables: Record<string, unknown>
  ): boolean {
    // If no condition is provided, treat it as always valid.
    if (!condition || condition.trim() === "") {
      return true;
    }

    // Remove unnecessary whitespace from the condition.
    const normalized = condition.trim();

    /**
     * Boolean variable condition.
     *
     * Supports:
     * - "hasKey"
     * - "!hasKey"
     *
     * This checks if a variable is truthy or falsy.
     */
    const booleanVariableMatch = normalized.match(
      /^!?[a-zA-Z_][a-zA-Z0-9_]*$/
    );

    if (booleanVariableMatch) {
      // Handles negated variable conditions like "!hasKey".
      if (normalized.startsWith("!")) {
        const key = normalized.slice(1);
        return !Boolean(variables[key]);
      }

      // Handles direct variable conditions like "hasKey".
      return Boolean(variables[normalized]);
    }

    /**
     * Comparison condition.
     *
     * Supports:
     * - key == value
     * - key != value
     * - key > value
     * - key < value
     * - key >= value
     * - key <= value
     *
     * Example:
     * - "coins >= 10"
     * - "status == 'open'"
     * - "isAlive == true"
     */
    const comparisonMatch = normalized.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/
    );

    // If the condition does not match any supported format, fail safely.
    if (!comparisonMatch) {
      console.warn(`Unsupported EveryBook condition: ${condition}`);
      return false;
    }

    // Extract the variable name, operator, and comparison value.
    const [, key, operator, rawValue] = comparisonMatch;

    // Left side comes from the current story variables.
    const left = variables[key];

    // Right side is parsed from the condition string.
    const right = this.parseValue(rawValue);

    // Evaluate the condition based on the detected operator.
    switch (operator) {
      case "==":
        // Strict equality comparison.
        return left === right;

      case "!=":
        // Strict inequality comparison.
        return left !== right;

      case ">":
      case "<":
      case ">=":
      case "<=": {
        const leftNumber = this.toNumber(left);
        const rightNumber = this.toNumber(right);

        if (leftNumber === null || rightNumber === null) {
          console.warn(
            `Invalid numeric EveryBook condition: ${condition}`
          );
          return false;
        }

        if (operator === ">") return leftNumber > rightNumber;
        if (operator === "<") return leftNumber < rightNumber;
        if (operator === ">=") return leftNumber >= rightNumber;
        return leftNumber <= rightNumber;
      }

      default:
        // This should not normally happen because the regex already validates operators.
        return false;
    }
  }

  /**
   * Evaluates multiple conditions and returns true only if all conditions pass.
   *
   * This is useful when a page, choice, or event requires multiple requirements.
   *
   * @param conditions - A list of condition strings.
   * @param variables - The current story variables/state.
   * @returns true if every condition passes, otherwise false.
   *
   * @example
   * ConditionEngine.evaluateAll(
   *   ["hasKey", "coins >= 10"],
   *   { hasKey: true, coins: 15 }
   * );
   * // true
   */
  static evaluateAll(
    conditions: Array<string | undefined>,
    variables: Record<string, unknown>
  ): boolean {
    return conditions.every((condition) =>
      this.evaluate(condition, variables)
    );
  }

  /**
   * Evaluates multiple conditions and returns true if at least one condition passes.
   *
   * This is useful when a page, choice, or event can be unlocked by different paths.
   *
   * @param conditions - A list of condition strings.
   * @param variables - The current story variables/state.
   * @returns true if any condition passes, otherwise false.
   *
   * @example
   * ConditionEngine.evaluateAny(
   *   ["hasKey", "coins >= 100"],
   *   { hasKey: false, coins: 150 }
   * );
   * // true
   */
  static evaluateAny(
    conditions: Array<string | undefined>,
    variables: Record<string, unknown>
  ): boolean {
    return conditions.some((condition) =>
      this.evaluate(condition, variables)
    );
  }

  /**
   * Parses the right-side value of a condition into the correct JavaScript type.
   *
   * Supported conversions:
   * - "true" becomes boolean true
   * - "false" becomes boolean false
   * - "null" becomes null
   * - "undefined" becomes undefined
   * - "'text'" becomes string "text"
   * - '"text"' becomes string "text"
   * - "10" becomes number 10
   * - "open" becomes string "open"
   *
   * @param value - The raw value from the condition string.
   * @returns The parsed JavaScript value.
   *
   * @example
   * parseValue("'good'");
   * // "good"
   *
   * @example
   * parseValue("10");
   * // 10
   */
  private static parseValue(value: string): unknown {
    const trimmed = value.trim();

    // Convert boolean-like string values.
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    // Convert special JavaScript-like values.
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;

    // Remove quotation marks from quoted strings.
    if (this.isQuoted(trimmed)) {
      return trimmed.slice(1, -1);
    }

    // Convert numeric values to actual numbers.
    if (this.isNumeric(trimmed)) {
      return Number(trimmed);
    }

    // Fallback: treat the value as a plain string.
    return trimmed;
  }

  /**
   * Checks if a string is wrapped in single or double quotes.
   *
   * @param value - The value to check.
   * @returns true if the value is quoted, otherwise false.
   *
   * @example
   * isQuoted("'hello'");
   * // true
   *
   * @example
   * isQuoted('"hello"');
   * // true
   */
  private static isQuoted(value: string): boolean {
    return (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    );
  }

  /**
   * Checks if a string can be safely converted into a number.
   *
   * @param value - The value to check.
   * @returns true if the value is numeric, otherwise false.
   *
   * @example
   * isNumeric("10");
   * // true
   *
   * @example
   * isNumeric("hello");
   * // false
   */
  private static isNumeric(value: string): boolean {
    return value.trim() !== "" && !Number.isNaN(Number(value));
  }

  /**
   * Converts an unknown value into a number for numeric comparisons.
   *
   * If the value cannot be converted into a valid number,
   * it returns 0 as a safe fallback.
   *
   * @param value - The value to convert.
   * @returns The numeric value, or 0 if conversion fails.
   *
   * @example
   * toNumber("10");
   * // 10
   *
   * @example
   * toNumber("abc");
   * // 0
   */
  private static toNumber(value: unknown): number | null {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return null;
    }

    return numberValue;
  }
}
