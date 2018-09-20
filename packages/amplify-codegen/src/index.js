const generateTypes = require('./commands/types');
const generateStatements = require('./commands/statements');
const generate = require('./commands/generateStatementsAndType');
const add = require('./commands/add');
const configure = require('./commands/configure');

const prePushAddGraphQLCodegenHook = require('./callbacks/prePushAddCallback');
const prePushUpdateGraphQLCodegenHook = require('./callbacks/prePushUpdateCallback');
const postPushGraphQLCodegenHook = require('./callbacks/postPushCallback');

module.exports = {
  configure,
  generate,
  generateTypes,
  generateStatements,
  add,
  prePushAddGraphQLCodegenHook,
  prePushUpdateGraphQLCodegenHook,
  postPushGraphQLCodegenHook,
};
