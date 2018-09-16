import {
  ObjectTypeDefinitionNode, InputObjectTypeDefinitionNode,
  InputValueDefinitionNode, FieldDefinitionNode, Kind, TypeNode, NamedTypeNode,
} from 'graphql'
import {
  makeNamedType,
  makeField,
  makeDirective,
  makeArgument,
  makeValueNode,
  ModelResourceIDs,
  makeInputValueDefinition
} from 'graphql-transformer-common'
import { getTypeName } from './utils';

export function makeSubscriptionField(
  fieldName: string, args: InputValueDefinitionNode[],
  returnTypeName: string, mutations: string[]): FieldDefinitionNode {
  return makeField(
    fieldName,
    args,
    makeNamedType(returnTypeName),
    [
      makeDirective(
        'aws_subscribe',
        [makeArgument('mutations', makeValueNode(mutations))]
      )
    ]
  )
}

export function makeModelConnectionField(field: FieldDefinitionNode): FieldDefinitionNode {
  let typeName = getTypeName(field)
  return makeField(
    field.name.value,
    [...field.arguments,
    makeInputValueDefinition('filter', makeNamedType(ModelResourceIDs.ModelFilterInputTypeName(typeName))),
    makeInputValueDefinition('sortDirection', makeNamedType('ModelSortDirection')),
    makeInputValueDefinition('limit', makeNamedType('Int')),
    makeInputValueDefinition('nextToken', makeNamedType('String'))
    ],
    makeNamedType(ModelResourceIDs.ModelConnectionTypeName(typeName))
  )
}
