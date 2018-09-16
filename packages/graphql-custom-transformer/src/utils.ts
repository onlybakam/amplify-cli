import { FieldDefinitionNode, NamedTypeNode } from "graphql"

export function getTypeName(field: FieldDefinitionNode): string {
  let typeName: string = null
  let typeNode = field.type
  while (!typeName) {
    if (typeNode.kind === 'NamedType') {
      typeName = (typeNode as NamedTypeNode).name.value
    } else {
      typeNode = typeNode.type
    }
  }
  return typeName
}