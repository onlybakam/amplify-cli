import {
  ObjectTypeDefinitionNode, InputObjectTypeDefinitionNode,
  InputValueDefinitionNode, FieldDefinitionNode, Kind, TypeNode,
} from 'graphql'
import {
  makeNamedType,
  makeField,
  makeDirective,
  makeArgument,
  makeValueNode
} from 'graphql-transformer-common'

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
