import type { ApiDeclaration } from '@lib/typedoc/types/typedoc'
import type { ApiReference } from '@lib/typedoc/types/apiReferences'
import { formatText } from '@lib/typedoc/resolve/lib'
import type { InheritedContextTypeSpecification } from '@lib/typedoc/types/specifications'

const resolveInheritedContext = (
  api: ApiDeclaration,
  name: string,
  inheritedContext: InheritedContextTypeSpecification,
): ApiReference => {
  let contextDeclaration = api.children.find((child) => child.name === name)
  // typedoc 0.28: may be inside default export
  if (!contextDeclaration) {
    const defaultExport = api.children.find((child) => child.name === 'default')
    if (defaultExport?.type?.type === 'intersection') {
      for (const t of (defaultExport.type as any).types) {
        if (t.type === 'reflection' && t.declaration?.children) {
          const found = t.declaration.children.find(
            (c: any) => c.name === name,
          )
          if (found) {
            contextDeclaration = found
            break
          }
        }
      }
    }
  }
  // For inherited contexts, the declaration is optional — content comes from parent library
  return {
    name,
    kind: 'inherited-context',
    descriptionHtml: contextDeclaration ? formatText(contextDeclaration.comment?.summary) : '',
    inherits: inheritedContext.inherits,
  }
}

export default resolveInheritedContext
