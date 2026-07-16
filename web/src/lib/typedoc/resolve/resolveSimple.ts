import type { ApiDeclaration } from '@lib/typedoc/types/typedoc'
import type { ApiReference } from '@lib/typedoc/types/apiReferences'
import { resolveTypeTopLevel } from '@lib/typedoc/resolve/lib'

const resolveSimple = (api: ApiDeclaration, name: string): ApiReference => {
  const simpleDeclaration = api.children.find((child) => child.name === name)
  if (!simpleDeclaration) {
    throw new Error(`Simple declaration not found: ${name}`)
  }

  let type: string
  if (simpleDeclaration.type) {
    type = resolveTypeTopLevel(simpleDeclaration.type)
  } else if (simpleDeclaration.signatures?.[0]?.type) {
    type = resolveTypeTopLevel(
      simpleDeclaration.signatures![0].type,
      undefined,
      [],
    )
  } else if (simpleDeclaration.children) {
    // typedoc 0.28: type alias with inline children — render as object type
    const props = simpleDeclaration.children.map((c: any) => {
      const propType = c.type ? resolveTypeTopLevel(c.type) : 'unknown'
      return `${c.name}${c.flags?.isOptional ? '?' : ''}: ${propType}`
    })
    type = `{ ${props.join('; ')} }`
  } else {
    throw new Error(`Simple declaration not found: ${name}`)
  }

  return {
    name,
    kind: 'simple',
    type: `type ${name} = ${type}`,
  }
}

export default resolveSimple
