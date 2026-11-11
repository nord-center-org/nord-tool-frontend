/** Tipos mínimos do motor de fórmulas do Fortune-sheet (o pacote não traz os seus). */
declare module "@fortune-sheet/formula-parser" {
  export class Parser {
    parse(expression: string, options?: unknown): { error: string | null; result: unknown };
    _callFunction(name: string, params?: unknown[]): unknown;
  }
}
