import { isDeclared } from '@wakaru/ast-utils/scope'
import { wrapAstTransformation } from '@wakaru/ast-utils/wrapAstTransformation'
import type { ASTTransformation } from '@wakaru/ast-utils/wrapAstTransformation'

/**
 * Converts `void 0` to `undefined`.
 *
 * @example
 * void 0 -> undefined
 * void 99 -> undefined
 *
 * @see https://babeljs.io/docs/babel-plugin-transform-undefined-to-void
 * @see Terser: `unsafe_undefined`
 */
export const transformAST: ASTTransformation = (context) => {
    const { root, j } = context

    root
        .find(j.UnaryExpression, {
            operator: 'void',
            argument: { type: 'NumericLiteral' },
        })
        .forEach((p) => {
            if (p.scope && isDeclared(p.scope, 'undefined')) return

            p.replace(j.identifier('undefined'))
        })
}

export default wrapAstTransformation(transformAST)
