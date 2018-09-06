import { Transformer, TransformerContext, InvalidDirectiveError } from 'graphql-transformer-core'
import {
    DirectiveNode, ObjectTypeDefinitionNode, NamedTypeNode,
    InterfaceTypeDefinitionNode, FieldDefinitionNode, InputObjectTypeDefinitionNode
} from 'graphql'
import { ResourceFactory } from './resources'
import {
    blankObjectExtension, extensionWithFields, ResolverResourceIDs,
    toUpper, getDirectiveArgument, makeInputValueDefinition, makeNamedType, ModelResourceIDs
} from 'graphql-transformer-common'
import Resource from "cloudform/types/resource";
import { makeSubscriptionField } from './definitions';

type blankKeys = 'Mutation' | 'Query' | 'Subscription'
type parentFieldTuple = { parentName: string, fieldName: string }
/**
 * custom transformer includes files from custom/resolvers folder
 */
export class CustomTransformer extends Transformer {

    resources: ResourceFactory
    cleanupList: parentFieldTuple[] = []
    blanks: { [key in blankKeys]: any } = {
        Mutation: blankObjectExtension('Mutation'),
        Query: blankObjectExtension('Query'),
        Subscription: blankObjectExtension('Subscription')
    }

    constructor() {
        super(
            'CustomTransformer',
            `directive @custom(subscription: Boolean, on: String, watchedFields: [String!], skipInput: Boolean) on OBJECT | FIELD_DEFINITION`
        )
        this.resources = new ResourceFactory();
    }

    public after = (ctx: TransformerContext): void => {
        ctx.addObjectExtension(this.blanks.Mutation)
        ctx.addObjectExtension(this.blanks.Query)
        ctx.addObjectExtension(this.blanks.Subscription)
        this.cleanupList.forEach(o => this.cleanUpInputObject(o.parentName, o.fieldName, ctx))
        this.linkResolversToFilePath(ctx);
    }

    private linkResolversToFilePath(ctx: TransformerContext): void {

        const templateResources: { [key: string]: Resource } = ctx.template.Resources

        for (const resourceName of Object.keys(templateResources)) {
            const resource: Resource = templateResources[resourceName]
            if (resource.Type === 'AWS::AppSync::Resolver' && resource.Properties.RequestMappingTemplateS3Location) {
                this.updateParameters(resourceName, ctx)
            }
        }
    }

    private updateParameters(resourceName: string, ctx: TransformerContext): void {
        const resolverResource = ctx.template.Resources[resourceName]

        const reqFileName = resolverResource.Properties.RequestMappingTemplateS3Location
        const respFileName = resolverResource.Properties.ResponseMappingTemplateS3Location
        if (reqFileName && respFileName) {
            const reqTypeName = resolverResource.Properties.TypeName
            const reqFieldName = resolverResource.Properties.FieldName
            const reqFileName = `${reqTypeName}.${reqFieldName}.request`
            const reqParam = this.resources.makeResolverParam(reqFileName);
            ctx.mergeParameters(reqParam.Parameters);

            const respTypeName = resolverResource.Properties.TypeName
            const respFieldName = resolverResource.Properties.FieldName
            const respFileName = `${respTypeName}.${respFieldName}.response`
            const respParam = this.resources.makeResolverParam(respFileName);
            ctx.mergeParameters(respParam.Parameters);
        }
    }

    private cleanUpInputObject(
        parentName: string,
        fieldName: string,
        ctx: TransformerContext
    ): void {
        const inputNames = []
        inputNames.push(ModelResourceIDs.ModelCreateInputObjectName(parentName))
        inputNames.push(ModelResourceIDs.ModelUpdateInputObjectName(parentName))
        inputNames.push(ModelResourceIDs.ModelFilterInputTypeName(parentName))
        inputNames.forEach(inputName => {
            // console.log('skip input', inputName)
            // console.log(Object.keys(ctx.nodeMap))
            const input = ctx.nodeMap[inputName] as InputObjectTypeDefinitionNode
            if (!input) { return }
            // console.log('found input')
            const foundIndex = input.fields.findIndex(f => f.name.value === fieldName)
            // console.log('foundIndex', foundIndex)
            if (foundIndex > -1) {
                const fields = [...input.fields.slice(0, foundIndex), ...input.fields.slice(foundIndex + 1)]
                ctx.nodeMap[inputName] = {
                    kind: 'InputObjectTypeDefinition',
                    name: { kind: 'Name', value: input.name.value },
                    fields,
                    directives: []
                }
            }
        })
    }

    public field = (
        parent: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode,
        field: FieldDefinitionNode,
        directive: DirectiveNode,
        ctx: TransformerContext
    ): void => {
        const defName = parent.name.value
        const fieldName = field.name.value
        let buildSub = getDirectiveArgument(directive)('subscription');
        let watchedFields = getDirectiveArgument(directive)('watchedFields') || [];
        let onWatch = getDirectiveArgument(directive)('on') || [];
        let skipInput = getDirectiveArgument(directive)('skipInput')
        let watchedArgs = []
        let typeNode = field.type
        let typeName = null
        while (!typeName) {
            if (typeNode.kind === 'NamedType') {
                typeName = (typeNode as NamedTypeNode).name.value
            } else {
                typeNode = typeNode.type
            }
        }

        if (skipInput) {
            this.cleanupList.push({ parentName: parent.name.value, fieldName: field.name.value })
            return
        }

        if (defName !== 'Subscription') {
            const resolver = this.resources.makeCustomResolverWithS3(defName, fieldName, typeName)
            ctx.setResource(ResolverResourceIDs.ResolverResourceID(defName, toUpper(fieldName)), resolver)
            // console.log(defName, buildSub)
            if (defName === 'Mutation' && buildSub) {
                watchedFields.forEach(iWatchedField => {
                    const arg = field.arguments.find(a => a.name.value === iWatchedField)
                    // console.log('Found arg >', arg)
                    watchedArgs.push(makeInputValueDefinition(arg.name.value, makeNamedType((arg.type as NamedTypeNode).name.value)))
                })
                const subscription = makeSubscriptionField(
                    'on' + (fieldName[0].toUpperCase()) + fieldName.slice(1),
                    watchedArgs,
                    typeName,
                    [resolver.Properties.FieldName]
                )
                // console.log(subscription)
                this.blanks.Subscription = extensionWithFields(this.blanks.Subscription, [subscription])
            }
        } else {
            if (!onWatch) {
                throw new InvalidDirectiveError(`@custom: specify 'on' for custom subscription`)
            }
            const subscription = makeSubscriptionField(
                field.name.value,
                field.arguments.map(arg => makeInputValueDefinition(arg.name.value, makeNamedType((arg.type as NamedTypeNode).name.value))),
                typeName,
                [onWatch]
            )
            this.blanks.Subscription = extensionWithFields(this.blanks.Subscription, [subscription])
        }


        if (defName === 'Mutation') {
            this.blanks.Mutation = extensionWithFields(this.blanks.Mutation, [field])
        } else if (defName === 'Query') {
            this.blanks.Query = extensionWithFields(this.blanks.Query, [field])
        }
    }

    public object = (def: ObjectTypeDefinitionNode, directive: DirectiveNode, ctx: TransformerContext): void => {
        //no work
    }
}
