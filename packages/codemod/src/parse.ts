import * as recast from "recast";
import * as babelParser from "@babel/parser";

/**
 * Parse TS/TSX source with recast so that printing only reprints touched nodes
 * (formatting of everything else is preserved verbatim). We drive recast with
 * the @babel/parser so locations match what the babel-plugin-tapsource captured:
 * 1-based lines, 0-based columns.
 */
export function parse(code: string) {
  return recast.parse(code, {
    parser: {
      parse(source: string) {
        return babelParser.parse(source, {
          sourceType: "module",
          allowReturnOutsideFunction: true,
          tokens: true, // recast needs tokens to preserve formatting
          plugins: ["typescript", "jsx"],
        });
      },
    },
  });
}

export function print(ast: ReturnType<typeof parse>): string {
  return recast.print(ast).code;
}

export const t = recast.types;
export const b = recast.types.builders;
// ast-types nodes are loosely typed; we use `any` for AST params throughout.
export type ASTNode = any;
