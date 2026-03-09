/**
 * SDK Deprecation Utilities
 *
 * Provides tools for marking SDK methods as deprecated with version info
 * and migration hints. Deprecated methods emit console warnings at runtime.
 *
 * @example
 * ```typescript
 * // Using the decorator
 * class MyClient {
 *   @deprecated({ since: "0.2.0", message: "Use newMethod() instead" })
 *   oldMethod() { ... }
 * }
 *
 * // Using the function wrapper
 * const result = warnDeprecated("oldMethod", { since: "0.2.0", message: "Use newMethod() instead" });
 * ```
 */

/** Options for marking a method as deprecated. */
export interface DeprecationOptions {
  /** The SDK version in which this method was deprecated. */
  since: string;
  /** Migration hint explaining what to use instead. */
  message: string;
  /** Optional version in which this method will be removed. */
  removeIn?: string;
}

/** Internal set tracking which warnings have already been emitted (to avoid spam). */
const emittedWarnings = new Set<string>();

/**
 * Emit a deprecation warning for a method call.
 * Each unique method name only warns once per process lifetime.
 *
 * @param methodName - The name of the deprecated method
 * @param options - Deprecation details (version, migration hint)
 */
export function warnDeprecated(
  methodName: string,
  options: DeprecationOptions,
): void {
  if (emittedWarnings.has(methodName)) return;
  emittedWarnings.add(methodName);

  const removeNotice = options.removeIn
    ? ` It will be removed in v${options.removeIn}.`
    : "";

  console.warn(
    `[Magic Apps Cloud SDK] DEPRECATED: ${methodName}() is deprecated since v${options.since}.${removeNotice} ${options.message}`,
  );
}

/**
 * TypeScript method decorator that marks a method as deprecated.
 * When the decorated method is called, a console warning is emitted (once per method).
 *
 * @param options - Deprecation details (version, migration hint)
 * @returns A method decorator
 *
 * @example
 * ```typescript
 * class Client {
 *   @deprecated({ since: "0.2.0", message: "Use getAppInfo() instead" })
 *   fetchApp() { ... }
 * }
 * ```
 */
export function deprecated(options: DeprecationOptions) {
  return function <T extends (...args: unknown[]) => unknown>(
    target: T,
    context: ClassMethodDecoratorContext,
  ): T {
    const methodName = String(context.name);

    const replacement = function (this: unknown, ...args: unknown[]) {
      warnDeprecated(methodName, options);
      return target.apply(this, args);
    } as unknown as T;

    return replacement;
  };
}

/**
 * Reset emitted warnings (useful for testing).
 * @internal
 */
export function _resetDeprecationWarnings(): void {
  emittedWarnings.clear();
}
