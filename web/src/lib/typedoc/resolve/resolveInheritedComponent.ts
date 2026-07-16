import type { ApiDeclaration, Comment } from '@lib/typedoc/types/typedoc'
import type { ApiReference, Tag } from '@lib/typedoc/types/apiReferences'
import { formatText } from '@lib/typedoc/resolve/lib'
import type { InheritedComponentTypeSpecification } from '@lib/typedoc/types/specifications'

const resolveInheritedComponent = (
  api: ApiDeclaration,
  name: string,
  inheritedComponent: InheritedComponentTypeSpecification,
): ApiReference => {
  let componentDeclaration = api.children.find((child) => child.name === name)
  // typedoc 0.28: sub-components may be inside the default export
  if (!componentDeclaration) {
    const defaultExport = api.children.find((child) => child.name === 'default')
    if (defaultExport?.type?.type === 'intersection') {
      for (const t of (defaultExport.type as any).types) {
        if (t.type === 'reflection' && t.declaration?.children) {
          const found = t.declaration.children.find(
            (c: any) => c.name === name,
          )
          if (found) {
            componentDeclaration = found
            break
          }
        }
      }
    }
  }
  // For inherited components, the declaration is optional — props come from the parent library
  const dataTags = componentDeclaration ? getTags('data', componentDeclaration.comment) : []
  const cssTags = componentDeclaration ? getTags('css', componentDeclaration.comment) : []

  return {
    name,
    kind: 'inherited-component',
    descriptionHtml: componentDeclaration ? formatText(componentDeclaration.comment?.summary) : '',
    inherits: inheritedComponent.inherits,
    data: dataTags,
    css: cssTags,
  }
}

const getTags = (name: 'data' | 'css', comment?: Comment): Tag[] => {
  if (!comment || !comment.blockTags) {
    return []
  }
  const dataTags = comment.blockTags.filter((tag) => tag.tag === `@${name}`)
  return dataTags.map((dataTag) => {
    return {
      name: dataTag.content[0].text.slice(1, -1),
      descriptionHtml: formatText(dataTag.content.slice(1)).replace(' - ', ''),
    }
  })
}

export default resolveInheritedComponent
